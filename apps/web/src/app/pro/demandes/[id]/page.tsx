import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRightLeft, FileText, Inbox } from "lucide-react";
import { prisma, type DocumentKind } from "@ocean/db";
import { DynamicFields, ValuesList } from "@/components/dynamic-fields";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { PriorityBadge, RequestStatusBadge } from "@/components/request-badges";
import { acceptRequest, cancelRequest, commentRequest, completeRequest, refuseRequest } from "@/lib/actions/requests";
import { canAccessPatient } from "@/lib/characters";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { displayValues } from "@/lib/form-fields";
import { markRequestRead } from "@/lib/notifications";
import { snapshotOf } from "@/lib/request-labels";
import { canHandleRequest, canViewRequest } from "@/lib/requests";
import { requireStaff } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Demande" };

const EVENT_LABELS: Record<string, string> = {
  create: "a envoyé la demande",
  accept: "a accepté",
  refuse: "a refusé",
  complete: "a clôturé avec sa réponse",
  cancel: "a annulé la demande",
  document: "a rattaché un document",
};

export default async function RequestPage({ params }: PageProps<"/pro/demandes/[id]">) {
  const { id } = await params;
  const user = await requireStaff();
  if (!(await canViewRequest(user, { id }))) notFound();
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      character: true,
      author: { select: { id: true, displayName: true } },
      fromService: { select: { name: true } },
      toService: { select: { name: true } },
      recipient: { select: { displayName: true } },
      assignee: { select: { displayName: true } },
      responseDocument: { select: { id: true, number: true, kind: true, revokedAt: true } },
      events: { orderBy: { createdAt: "asc" }, include: { staff: { select: { displayName: true } } } },
    },
  });
  if (!request) notFound();
  await markRequestRead(user.id, request.id);

  const snapshot = snapshotOf(request);
  const handler = await canHandleRequest(user, request);
  const isAuthor = request.authorId === user.staff.id;
  const patientAccess = await canAccessPatient(user, request.characterId);
  const transfer = request.kind === "TRANSFERT";
  const open = request.status === "PENDING" || request.status === "ACCEPTED";
  const responseKind = snapshot.responseDocument as DocumentKind | null;
  const p = request.character;

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/pro/demandes" className="text-sm font-medium text-ocean-600 hover:underline">← Demandes</Link>

      <header className="card p-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {transfer ? <ArrowRightLeft className="size-4" /> : <Inbox className="size-4" />} {request.number}
        </p>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold">
          {snapshot.name}
          <RequestStatusBadge kind={request.kind} status={request.status} />
          <PriorityBadge priority={request.priority} />
        </h1>
        <p className="mt-2 text-sm">
          Patient :{" "}
          {patientAccess ? <Link href={`/pro/patients/${p.id}`} className="font-semibold text-ocean-700 hover:underline">{p.firstName} {p.lastName}</Link> : <strong>{p.firstName} {p.lastName}</strong>}
          {p.patientNumber && <span className="text-muted"> · {p.patientNumber}</span>}
          {p.allergies && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Allergies : {p.allergies}</span>}
        </p>
        <p className="mt-1 text-sm text-muted">
          De {request.author.displayName}{request.fromService && ` (${request.fromService.name})`} → {request.recipient ? `${request.recipient.displayName}, ` : ""}{request.toService.name}
          {" · "}{formatDateTime(request.createdAt)}
          {request.assignee && ` · pris en charge par ${request.assignee.displayName}`}
        </p>
      </header>

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Demande</h2>
        <ValuesList rows={displayValues(snapshot.fields, request.data)} />
        {request.message && <p className="whitespace-pre-line rounded-xl bg-canvas p-3 text-sm">{request.message}</p>}
        {snapshot.acceptFields.length > 0 && request.acceptedAt && (
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold">{transfer ? "Prise en charge" : "Acceptation"}</h3>
            <ValuesList rows={displayValues(snapshot.acceptFields, request.acceptData)} />
          </div>
        )}
        {request.status === "REFUSED" && request.refusalReason && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-900"><strong>Refusée :</strong> {request.refusalReason}</p>
        )}
        {request.status === "COMPLETED" && (
          <div className="space-y-2 rounded-xl bg-emerald-50/60 p-4">
            <h3 className="text-sm font-semibold text-emerald-900">Réponse</h3>
            <ValuesList rows={displayValues(snapshot.responseFields, request.responseData)} />
            {request.response && <p className="whitespace-pre-line text-sm">{request.response}</p>}
          </div>
        )}
        {request.responseDocument && (
          <p className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-ocean-600" />
            <a href={`/api/documents/${request.responseDocument.id}`} target="_blank" className="font-medium text-ocean-700 hover:underline">
              {DOCUMENT_TYPES[request.responseDocument.kind].label} {request.responseDocument.number}
            </a>
            <a href={`/api/documents/${request.responseDocument.id}?dl=1`} className="text-xs font-medium text-ocean-700 hover:underline">PDF</a>
            <a href={`/api/documents/${request.responseDocument.id}?format=png&dl=1`} className="text-xs font-medium text-ocean-700 hover:underline">PNG</a>
            {request.responseDocument.revokedAt && <span className="text-xs font-semibold text-red-700">ANNULÉ</span>}
          </p>
        )}
      </section>

      {/* Actions du service destinataire. */}
      {handler && request.status === "PENDING" && (
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <ActionForm action={acceptRequest} className="card space-y-4 p-6">
            <h2 className="font-bold">{transfer ? "Prendre le patient en charge" : "Accepter"}</h2>
            <input type="hidden" name="id" value={request.id} />
            <DynamicFields fields={snapshot.acceptFields} prefix="a-" />
            <textarea name="message" rows={2} maxLength={2000} placeholder="Message au demandeur (facultatif)" className="input" />
            <SubmitButton pendingText="…">{transfer ? "Prendre en charge" : "Accepter la demande"}</SubmitButton>
          </ActionForm>
          <ActionForm action={refuseRequest} className="card h-fit space-y-3 p-6">
            <h2 className="font-bold">Refuser</h2>
            <input type="hidden" name="id" value={request.id} />
            <textarea name="reason" required rows={3} maxLength={1000} placeholder="Motif (vu par le demandeur)" className="input" />
            <SubmitButton className="btn-danger" pendingText="…">Refuser</SubmitButton>
          </ActionForm>
        </div>
      )}
      {handler && request.status === "ACCEPTED" && !transfer && (
        <ActionForm action={completeRequest} className="card space-y-4 p-6">
          <h2 className="font-bold">Répondre et clôturer</h2>
          <input type="hidden" name="id" value={request.id} />
          {responseKind && DOCUMENT_TYPES[responseKind] && (
            <div className="rounded-xl bg-canvas p-3 text-sm">
              {request.responseDocument ? (
                <>Document rattaché : <strong>{request.responseDocument.number}</strong>.</>
              ) : user.canWriteDoc(responseKind) ? (
                <>
                  Réponse attendue : <strong>{DOCUMENT_TYPES[responseKind].label}</strong>.{" "}
                  <Link href={`/pro/documents/nouveau?type=${responseKind}&patient=${p.id}&demande=${request.id}`} className="font-medium text-ocean-700 underline">Le rédiger</Link>
                  {" "}— il sera rattaché à cette demande.
                </>
              ) : (
                <>Réponse attendue : <strong>{DOCUMENT_TYPES[responseKind].label}</strong>, que votre grade ne permet pas de rédiger.</>
              )}
            </div>
          )}
          <DynamicFields fields={snapshot.responseFields} prefix="r-" />
          <textarea name="response" rows={3} maxLength={4000} placeholder="Commentaire (facultatif)" className="input" />
          <SubmitButton pendingText="…">Clôturer la demande</SubmitButton>
        </ActionForm>
      )}
      {(isAuthor || user.isAdmin || user.can("requests.view_all")) && open && !(transfer && request.status === "ACCEPTED") && (
        <ActionForm action={cancelRequest} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={request.id} />
          <input name="reason" maxLength={1000} placeholder="Motif de l'annulation (facultatif)" className="input max-w-sm" />
          <ConfirmButton message="Annuler cette demande ?" className="btn-secondary">Annuler la demande</ConfirmButton>
        </ActionForm>
      )}

      {/* Fil : historique et messages entre le demandeur et le service. */}
      <section className="card p-6">
        <h2 className="font-bold">Échanges</h2>
        <ol className="mt-4 space-y-3">
          {request.events.map((e) => (
            <li key={e.id} className={`text-sm ${e.action === "comment" ? "rounded-xl bg-canvas p-3" : "text-muted"}`}>
              <span className="font-semibold text-ink">{e.staff?.displayName ?? "—"}</span>{" "}
              {e.action === "comment" ? "" : EVENT_LABELS[e.action] ?? e.action}
              <span className="ml-2 text-xs text-muted">{formatDateTime(e.createdAt)}</span>
              {e.message && e.action !== "complete" && <p className="mt-1 whitespace-pre-line text-ink">{e.message}</p>}
            </li>
          ))}
        </ol>
        {(handler || isAuthor) && (
          <ActionForm action={commentRequest} className="mt-4 flex flex-col gap-2 sm:flex-row" resetOnSuccess>
            <input type="hidden" name="id" value={request.id} />
            <textarea name="message" required rows={2} maxLength={2000} placeholder="Écrire au demandeur / au service…" className="input" />
            <SubmitButton className="btn-secondary shrink-0" pendingText="…">Envoyer</SubmitButton>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
