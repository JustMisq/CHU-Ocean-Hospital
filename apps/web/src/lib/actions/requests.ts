"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DOCUMENT_KINDS, logAction, prisma, type DocumentKind, type Prisma } from "@ocean/db";
import type { FormState } from "@/components/forms";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { parseFields, readValues } from "@/lib/form-fields";
import { GENERIC_REQUEST, PRIORITY_LABELS, TRANSFER, requestTitle, snapshotOf, type TypeSnapshot } from "@/lib/request-labels";
import { presetsFor } from "@/lib/request-presets";
import { canHandleRequest, createRequestWithNumber, myServiceIds, notify, serviceRecipients } from "@/lib/requests";
import { requireStaff, requireUser } from "@/lib/session";

const linkOf = (id: string) => `/pro/demandes/${id}`;
const patientName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`;

function refresh(id: string, characterId?: string) {
  revalidatePath(linkOf(id));
  revalidatePath("/pro/demandes");
  revalidatePath("/pro", "layout");
  if (characterId) revalidatePath(`/pro/patients/${characterId}`);
}

// ─── Envoi ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  kind: z.enum(["DEMANDE", "TRANSFERT"]),
  characterId: z.string().min(1, "Choisissez un patient."),
  toServiceId: z.string().min(1, "Choisissez le service destinataire."),
  typeId: z.string().optional().transform((v) => v || null),
  fromServiceId: z.string().optional().transform((v) => v || null),
  recipientId: z.string().optional().transform((v) => v || null),
  priority: z.enum(["NORMAL", "URGENT", "VITAL"]).default("NORMAL"),
  message: z.string().trim().max(2000).default(""),
});

export async function createRequest(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff();
  const parsed = createSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const [character, toService] = await Promise.all([
    prisma.character.findUnique({ where: { id: v.characterId }, select: { id: true, firstName: true, lastName: true, deceasedAt: true } }),
    prisma.service.findUnique({ where: { id: v.toServiceId }, select: { id: true, name: true } }),
  ]);
  if (!character) return { error: "Dossier patient introuvable." };
  if (!toService) return { error: "Service introuvable." };
  if (v.kind === "TRANSFERT" && character.deceasedAt) return { error: "Ce patient est déclaré décédé : pas de transfert possible." };

  // Type de demande : configuré pour ce service (et actif), ou demande libre.
  let snapshot: TypeSnapshot = v.kind === "TRANSFERT" ? TRANSFER : GENERIC_REQUEST;
  let typeId: string | null = null;
  if (v.kind === "DEMANDE" && v.typeId) {
    const type = await prisma.requestType.findFirst({ where: { id: v.typeId, serviceId: toService.id, active: true } });
    if (!type) return { error: "Ce type de demande n'existe plus pour ce service." };
    typeId = type.id;
    snapshot = {
      name: type.name,
      fields: parseFields(type.fields),
      acceptFields: parseFields(type.acceptFields),
      responseFields: parseFields(type.responseFields),
      responseDocument: type.responseDocument,
    };

    // Prérequis : documents déjà émis pour ce patient, demandes déjà traitées.
    const docs = type.requiredDocuments.split(",").filter((k): k is DocumentKind => DOCUMENT_KINDS.includes(k as DocumentKind));
    for (const kind of docs) {
      const has = await prisma.medicalDocument.count({ where: { characterId: character.id, kind, revokedAt: null } });
      if (!has) return { error: `Il faut d'abord émettre pour ce patient : ${DOCUMENT_TYPES[kind].label}.` };
    }
    const prereqIds = type.requiredTypes.split(",").filter(Boolean);
    if (prereqIds.length) {
      const prereqs = await prisma.requestType.findMany({ where: { id: { in: prereqIds } }, select: { id: true, name: true, service: { select: { name: true } } } });
      for (const p of prereqs) {
        const done = await prisma.serviceRequest.count({ where: { characterId: character.id, typeId: p.id, status: "COMPLETED" } });
        if (!done) return { error: `Il faut d'abord une demande traitée : « ${p.name} » (${p.service.name}).` };
      }
    }
  }

  const values = readValues(snapshot.fields, data);
  if ("error" in values) return values;

  // Service d'origine : un des siens. Destinataire nommé : un membre du service destinataire.
  const mine = await myServiceIds(user.staff.id);
  const fromServiceId = v.fromServiceId && (mine.includes(v.fromServiceId) || user.isAdmin) ? v.fromServiceId : null;
  const recipientId = v.recipientId
    ? (await prisma.staffProfile.findFirst({ where: { id: v.recipientId, OR: [{ services: { some: { id: toService.id } } }, { headOf: { some: { id: toService.id } } }] }, select: { id: true } }))?.id ?? null
    : null;

  const request = await createRequestWithNumber(v.kind === "TRANSFERT" ? "TRF" : "DEM", {
    kind: v.kind,
    typeId,
    typeSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    characterId: character.id,
    authorId: user.staff.id,
    fromServiceId,
    toServiceId: toService.id,
    recipientId,
    priority: v.priority,
    message: v.message,
    data: values.values as Prisma.InputJsonValue,
  });
  await prisma.requestEvent.create({ data: { requestId: request.id, staffId: user.staff.id, action: "create", message: v.message } });

  const urgent = v.priority !== "NORMAL" ? `[${PRIORITY_LABELS[v.priority].toUpperCase()}] ` : "";
  await notify(
    await serviceRecipients(toService.id, recipientId),
    {
      title: `${urgent}${v.kind === "TRANSFERT" ? "Transfert" : snapshot.name} — ${patientName(character)}`,
      body: `De ${user.staff.displayName} → ${toService.name}`,
      link: linkOf(request.id),
      requestId: request.id,
    },
    user.id,
  );
  await logAction(user.id, "request.create", `${request.number} : ${snapshot.name} pour ${patientName(character)} → ${toService.name}`);
  refresh(request.id, character.id);
  redirect(linkOf(request.id));
}

// ─── Traitement ──────────────────────────────────────────────────────────────

async function loadRequest(id: string) {
  const user = await requireStaff();
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: { character: { select: { firstName: true, lastName: true } }, toService: { select: { name: true } }, author: { select: { userId: true } }, assignee: { select: { userId: true } } },
  });
  if (!request) return null;
  return { user, request, handler: await canHandleRequest(user, request), title: `${requestTitle(request)} — ${patientName(request.character)}` };
}

export async function acceptRequest(_: FormState, data: FormData): Promise<FormState> {
  const loaded = await loadRequest(String(data.get("id")));
  if (!loaded?.handler) return { error: "Demande introuvable ou non autorisée." };
  const { user, request, title } = loaded;
  if (request.status !== "PENDING") return { error: "Cette demande n'est plus en attente." };
  const values = readValues(snapshotOf(request).acceptFields, data, "a-");
  if ("error" in values) return values;
  const message = String(data.get("message") ?? "").trim().slice(0, 2000);

  await prisma.serviceRequest.update({
    where: { id: request.id },
    data: { status: "ACCEPTED", assigneeId: user.staff.id, acceptedAt: new Date(), acceptData: values.values as Prisma.InputJsonValue },
  });
  await prisma.requestEvent.create({ data: { requestId: request.id, staffId: user.staff.id, action: "accept", message } });
  const transfer = request.kind === "TRANSFERT";
  await notify([request.author.userId], { title: `${transfer ? "Patient pris en charge" : "Demande acceptée"} : ${title}`, body: `Par ${user.staff.displayName} (${request.toService.name})`, link: linkOf(request.id), requestId: request.id }, user.id);
  refresh(request.id, request.characterId);
  return { ok: transfer ? "Patient pris en charge." : "Demande acceptée : vous en êtes responsable." };
}

export async function refuseRequest(_: FormState, data: FormData): Promise<FormState> {
  const loaded = await loadRequest(String(data.get("id")));
  if (!loaded?.handler) return { error: "Demande introuvable ou non autorisée." };
  const { user, request, title } = loaded;
  if (request.status !== "PENDING") return { error: "Cette demande n'est plus en attente." };
  const reason = String(data.get("reason") ?? "").trim().slice(0, 1000);
  if (reason.length < 3) return { error: "Indiquez le motif du refus." };

  await prisma.serviceRequest.update({ where: { id: request.id }, data: { status: "REFUSED", refusalReason: reason, closedAt: new Date(), assigneeId: user.staff.id } });
  await prisma.requestEvent.create({ data: { requestId: request.id, staffId: user.staff.id, action: "refuse", message: reason } });
  await notify([request.author.userId], { title: `Demande refusée : ${title}`, body: reason, link: linkOf(request.id), requestId: request.id }, user.id);
  refresh(request.id, request.characterId);
  return { ok: "Demande refusée : le demandeur voit le motif." };
}

export async function completeRequest(_: FormState, data: FormData): Promise<FormState> {
  const loaded = await loadRequest(String(data.get("id")));
  if (!loaded?.handler) return { error: "Demande introuvable ou non autorisée." };
  const { user, request, title } = loaded;
  if (request.kind !== "DEMANDE" || request.status !== "ACCEPTED") return { error: "Seule une demande acceptée peut être clôturée." };
  const snapshot = snapshotOf(request);
  if (snapshot.responseDocument && !request.responseDocumentId) {
    return { error: `Rédigez d'abord le document attendu (${DOCUMENT_TYPES[snapshot.responseDocument as DocumentKind]?.label ?? "document"}).` };
  }
  const values = readValues(snapshot.responseFields, data, "r-");
  if ("error" in values) return values;
  const response = String(data.get("response") ?? "").trim().slice(0, 4000);

  await prisma.serviceRequest.update({ where: { id: request.id }, data: { status: "COMPLETED", closedAt: new Date(), response, responseData: values.values as Prisma.InputJsonValue } });
  await prisma.requestEvent.create({ data: { requestId: request.id, staffId: user.staff.id, action: "complete", message: response } });
  await notify([request.author.userId], { title: `Réponse reçue : ${title}`, body: `Par ${user.staff.displayName} (${request.toService.name})`, link: linkOf(request.id), requestId: request.id }, user.id);
  refresh(request.id, request.characterId);
  return { ok: "Demande clôturée : le demandeur a la réponse." };
}

export async function cancelRequest(_: FormState, data: FormData): Promise<FormState> {
  const loaded = await loadRequest(String(data.get("id")));
  if (!loaded) return { error: "Demande introuvable." };
  const { user, request, title } = loaded;
  if (request.authorId !== user.staff.id && !user.isAdmin && !user.can("requests.view_all")) return { error: "Seul le demandeur peut annuler." };
  if (request.status !== "PENDING" && request.status !== "ACCEPTED") return { error: "Cette demande est déjà close." };
  if (request.kind === "TRANSFERT" && request.status === "ACCEPTED") return { error: "Le patient a déjà été pris en charge." };
  const reason = String(data.get("reason") ?? "").trim().slice(0, 1000);

  await prisma.serviceRequest.update({ where: { id: request.id }, data: { status: "CANCELLED", closedAt: new Date() } });
  await prisma.requestEvent.create({ data: { requestId: request.id, staffId: user.staff.id, action: "cancel", message: reason } });
  const targets = request.assignee ? [request.assignee.userId] : await serviceRecipients(request.toServiceId, request.recipientId);
  await notify(targets, { title: `Demande annulée : ${title}`, body: reason, link: linkOf(request.id), requestId: request.id }, user.id);
  refresh(request.id, request.characterId);
  return { ok: "Demande annulée." };
}

export async function commentRequest(_: FormState, data: FormData): Promise<FormState> {
  const loaded = await loadRequest(String(data.get("id")));
  if (!loaded) return { error: "Demande introuvable." };
  const { user, request, handler, title } = loaded;
  if (!handler && request.authorId !== user.staff.id) return { error: "Non autorisé." };
  const message = String(data.get("message") ?? "").trim().slice(0, 2000);
  if (!message) return { error: "Message vide." };

  await prisma.requestEvent.create({ data: { requestId: request.id, staffId: user.staff.id, action: "comment", message } });
  // L'autre côté : le demandeur, ou le service (le soignant qui a pris la demande s'il y en a un).
  const others = request.authorId === user.staff.id
    ? request.assignee ? [request.assignee.userId] : await serviceRecipients(request.toServiceId, request.recipientId)
    : [request.author.userId, request.assignee?.userId];
  await notify(others, { title: `Nouveau message : ${title}`, body: `${user.staff.displayName} : ${message}`, link: linkOf(request.id), requestId: request.id }, user.id);
  refresh(request.id);
  return { ok: "Message envoyé." };
}

// ─── Configuration des types de demandes ─────────────────────────────────────

/** Configurer les types d'un service : `requests.configure`, `settings.manage`, ou chef de ce service. */
async function requireTypeConfig(serviceId: string) {
  const user = await requireStaff();
  if (user.isAdmin || user.can("requests.configure") || user.can("settings.manage")) return user;
  const service = await prisma.service.findFirst({ where: { id: serviceId, headId: user.staff.id }, select: { id: true } });
  return service ? user : null;
}

const typeSchema = z.object({
  id: z.string().optional(),
  serviceId: z.string().min(1),
  name: z.string().trim().min(3, "Nom requis.").max(80),
  description: z.string().trim().max(300).default(""),
  order: z.coerce.number().int().default(0),
  active: z.literal("on").optional(),
  responseDocument: z.string().optional(),
});

export async function saveRequestType(_: FormState, data: FormData): Promise<FormState> {
  const parsed = typeSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, serviceId, active, responseDocument, ...v } = parsed.data;
  const user = await requireTypeConfig(serviceId);
  if (!user) return { error: "Seuls la direction et le chef de ce service configurent ses demandes." };

  const fields = parseFields(String(data.get("fields") ?? "[]"));
  const payload = {
    ...v,
    active: active === "on",
    fields: fields as unknown as Prisma.InputJsonValue,
    acceptFields: parseFields(String(data.get("acceptFields") ?? "[]")) as unknown as Prisma.InputJsonValue,
    responseFields: parseFields(String(data.get("responseFields") ?? "[]")) as unknown as Prisma.InputJsonValue,
    requiredDocuments: data.getAll("requiredDocuments").map(String).filter((k) => DOCUMENT_KINDS.includes(k as DocumentKind)).join(","),
    requiredTypes: data.getAll("requiredTypes").map(String).filter((t) => t && t !== id).join(","),
    responseDocument: DOCUMENT_KINDS.includes(responseDocument as DocumentKind) ? (responseDocument as DocumentKind) : null,
  };
  if (id) {
    const existing = await prisma.requestType.findFirst({ where: { id, serviceId } });
    if (!existing) return { error: "Type introuvable." };
    await prisma.requestType.update({ where: { id }, data: payload });
  } else {
    await prisma.requestType.create({ data: { ...payload, serviceId } });
  }
  await logAction(user.id, id ? "request_type.update" : "request_type.create", `Type de demande ${id ? "modifié" : "créé"} : ${v.name}`);
  revalidatePath("/pro/demandes/types");
  return { ok: id ? "Type de demande enregistré." : "Type de demande créé." };
}

export async function deleteRequestType(data: FormData) {
  const type = await prisma.requestType.findUnique({ where: { id: String(data.get("id")) } });
  if (!type) return;
  const user = await requireTypeConfig(type.serviceId);
  if (!user) return;
  // Les demandes déjà envoyées gardent leur formulaire (figé à l'envoi).
  await prisma.requestType.delete({ where: { id: type.id } });
  await logAction(user.id, "request_type.delete", `Type de demande supprimé : ${type.name}`);
  revalidatePath("/pro/demandes/types");
}

/** Ajoute au service un des modèles proposés pour lui (à adapter ensuite). */
export async function addPresetType(data: FormData) {
  const serviceId = String(data.get("serviceId"));
  const user = await requireTypeConfig(serviceId);
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { name: true, slug: true } });
  if (!user || !service) return;
  const preset = presetsFor(service).find((p) => p.name === String(data.get("preset")));
  if (!preset) return;
  const order = await prisma.requestType.count({ where: { serviceId } });
  await prisma.requestType.create({
    data: {
      serviceId,
      name: preset.name,
      description: preset.description,
      order,
      fields: preset.fields as unknown as Prisma.InputJsonValue,
      acceptFields: (preset.acceptFields ?? []) as unknown as Prisma.InputJsonValue,
      responseFields: (preset.responseFields ?? []) as unknown as Prisma.InputJsonValue,
      requiredDocuments: (preset.requiredDocuments ?? []).join(","),
      responseDocument: preset.responseDocument ?? null,
    },
  });
  await logAction(user.id, "request_type.create", `Type de demande ajouté (modèle) : ${preset.name} — ${service.name}`);
  revalidatePath("/pro/demandes/types");
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}
