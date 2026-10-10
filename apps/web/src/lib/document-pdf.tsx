import "server-only";
import { Circle, ClipPath, Defs, Document, G, Image, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
// Encodeur seul (sans DOM) : renvoie la suite de barres « 1101… ».
// @ts-expect-error -- module interne de jsbarcode, sans types
import { CODE128 } from "jsbarcode/bin/barcodes/CODE128";
import type { ReactNode } from "react";
import type { MedicalDocument } from "@ocean/db";
import { DOCUMENT_TYPES, type DocumentData, type DocumentItem, type DocumentSnapshot } from "./document-types";
import { loadStoredImage } from "./documents";
import { findingText, MODALITIES, techniqueText, type ImagingData } from "./imaging/catalog";
import { regionOfNode } from "./imaging/regions";
import { formatDate, formatLongDate } from "./time";

const BRAND = "#0a6f98";
const MUTED = "#6b7280";
const LINE = "#d1d5db";

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingHorizontal: 40, paddingBottom: 70, fontFamily: "Helvetica", fontSize: 9, color: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  hospital: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BRAND },
  serviceLine: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 1 },
  small: { fontSize: 8, color: MUTED },
  patientBox: { width: 215, borderWidth: 0.75, borderColor: "#9ca3af", borderRadius: 4, padding: 8 },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },
  divider: { marginTop: 18, borderBottomWidth: 1.2, borderBottomColor: "#7fb3cf" },
  body: { flexDirection: "row", flexGrow: 1, marginTop: 14 },
  sidebar: { width: 118, paddingRight: 10, borderRightWidth: 0.75, borderRightColor: LINE, justifyContent: "space-between" },
  sideService: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: BRAND, textTransform: "uppercase" },
  main: { flex: 1, paddingLeft: 22 },
  title: { marginTop: 22, textAlign: "center", fontSize: 15, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  item: { marginTop: 14 },
  indent: { paddingLeft: 10, marginTop: 3 },
  stampRow: { marginTop: 8, height: 78, flexDirection: "row", justifyContent: "flex-end", position: "relative" },
  stamp: { width: 150, borderWidth: 1.5, borderColor: "#3157b5", padding: 3, marginRight: 90, alignSelf: "center" },
  stampInner: { borderWidth: 0.5, borderColor: "#3157b5", paddingVertical: 5, paddingHorizontal: 4, alignItems: "center" },
  stampText: { color: "#3157b5", fontSize: 6, textAlign: "center" },
  signature: { position: "absolute", right: 0, top: 0, width: 175, height: 78, objectFit: "contain" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
  watermark: { position: "absolute", top: 300, left: 185, width: 260, height: 260 },
  revoked: { position: "absolute", top: 380, left: 60, width: 480, textAlign: "center", fontSize: 72, fontFamily: "Helvetica-Bold", color: "#dc2626", opacity: 0.25, transform: "rotate(-28deg)" },
});

function Cross({ size, color, background }: { size: number; color: string; background: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="20" fill={background} />
      <Path d="M16 9h8v7h7v8h-7v7h-8v-7H9v-8h7z" fill={color} />
    </Svg>
  );
}

function Barcode({ value, width, height }: { value: string; width: number; height: number }) {
  const bars: string = new CODE128(value, {}).encode().data;
  const unit = width / bars.length;
  return (
    <Svg width={width} height={height}>
      {[...bars].map((bit, i) => (bit === "1" ? <Rect key={i} x={i * unit} y={0} width={unit + 0.05} height={height} fill="#000" /> : null))}
    </Svg>
  );
}

function age(birthIso: string, at: Date) {
  const birth = new Date(birthIso);
  let years = at.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = at.getUTCMonth() < birth.getUTCMonth() || (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years--;
  return years;
}

const born = (sex: string | null) => (sex === "M" ? "Né" : sex === "F" ? "Née" : "Né(e)");
const civility = (sex: string | null) => (sex === "M" ? "M. " : sex === "F" ? "Mme " : "");

/** "2026-10-09" → "09/10/2026" ; "2026-10-09T21:40" → "09/10/2026 à 21:40" (heure du serveur, saisie telle quelle). */
const localDate = (v: unknown) => String(v ?? "").slice(0, 10).split("-").reverse().join("/");
const localDateTime = (v: unknown) => `${localDate(v)} à ${String(v ?? "").slice(11, 16)}`;

function inclusiveDays(start: string, end: string) {
  const day = (v: string) => Date.UTC(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
  return Math.round((day(end) - day(start)) / 86_400_000) + 1;
}

const optionLabel = (kind: MedicalDocument["kind"], field: string, value: unknown) =>
  DOCUMENT_TYPES[kind].fields?.find((f) => f.name === field)?.options?.find(([v]) => v === value)?.[1] ?? String(value ?? "");

/** Paragraphe ; `first` : plus d'espace après le nom du patient ; `bold` : phrase à mettre en évidence. */
function Para({ children, first = false, bold = false }: { children: ReactNode; first?: boolean; bold?: boolean }) {
  return <Text style={{ marginTop: first ? 18 : 12, fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>{children}</Text>;
}

function Quote({ children }: { children: ReactNode }) {
  return <Text style={{ marginTop: 4, marginLeft: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: "#7fb3cf", fontFamily: "Helvetica-Bold" }}>{children}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginTop: 6 }} wrap={false}>
      <Text style={{ width: 130, color: MUTED }}>{label}</Text>
      <Text style={[s.bold, { flex: 1 }]}>{value}</Text>
    </View>
  );
}

/** Corps du document, propre à chaque type. */
function DocumentBody({ doc, snap, patientName }: { doc: MedicalDocument; snap: DocumentSnapshot; patientName: string }) {
  const d = (doc.data ?? {}) as DocumentData;
  const items = (doc.items as DocumentItem[]) ?? [];
  const prescriber = `${snap.prescriber.name}${snap.prescriber.title ? `, ${snap.prescriber.title}` : ""}`;

  switch (doc.kind) {
    case "ORDONNANCE":
    case "EXAMENS":
      return items.map((item, i) => (
        <View key={i} style={s.item} wrap={false}>
          <Text style={[s.bold, { fontSize: 10 }]}>{item.name}</Text>
          {item.instructions && <Text style={s.indent}>{item.instructions}</Text>}
          {item.quantity && <Text style={[s.bold, s.indent, { marginTop: 6 }]}>{item.quantity}</Text>}
        </View>
      ));

    case "ARRET_TRAVAIL": {
      const days = inclusiveDays(String(d.start), String(d.end));
      return (
        <View>
          <Para first>
            Je soussigné(e) {prescriber}, certifie que l&apos;état de santé de {patientName} nécessite un arrêt de travail{" "}
            {d.type === "prolongation" ? "en prolongation" : "initial"} :
          </Para>
          <View style={{ marginTop: 10, padding: 10, backgroundColor: "#f1f7fb", borderRadius: 4 }} wrap={false}>
            <Text style={[s.bold, { fontSize: 11, textAlign: "center" }]}>
              du {localDate(d.start)} au {localDate(d.end)} inclus, soit {days} jour{days > 1 ? "s" : ""}
            </Text>
          </View>
          <InfoRow label="Sorties" value={optionLabel(doc.kind, "outings", d.outings)} />
          {d.job && <InfoRow label="Profession / employeur" value={String(d.job)} />}
          <InfoRow label="Motif médical" value={String(d.reason)} />
        </View>
      );
    }

    case "DECES":
      return (
        <View>
          <Para first>Je soussigné(e) {prescriber}, certifie avoir constaté le décès de {patientName}.</Para>
          <View style={{ marginTop: 8 }}>
            <InfoRow label="Date et heure du décès" value={localDateTime(d.deathAt)} />
            <InfoRow label="Lieu du décès" value={String(d.place)} />
            <InfoRow label="Cause du décès" value={String(d.cause)} />
            <InfoRow label="Circonstances" value={optionLabel(doc.kind, "manner", d.manner)} />
            <InfoRow label="Obstacle médico-légal" value={d.forensic ? "OUI — à signaler aux autorités" : "Non"} />
          </View>
        </View>
      );

    case "REFUS_SOINS":
      return (
        <View>
          <Para first>
            Je soussigné(e) {patientName}, reconnais avoir été informé(e) par {prescriber} de la nécessité des soins suivants :
          </Para>
          <Quote>{String(d.care)}</Quote>
          <Para>ainsi que des risques encourus en cas de refus :</Para>
          <Quote>{String(d.risks)}</Quote>
          <Para>
            Je refuse ces soins en toute connaissance de cause et dégage {snap.hospitalName} et son personnel de toute responsabilité quant
            aux conséquences de ce refus.
          </Para>
          {d.place && <InfoRow label="Lieu" value={String(d.place)} />}
          {d.witnesses && <InfoRow label="Témoin(s)" value={String(d.witnesses)} />}
        </View>
      );

    case "REFUS_SIGNATURE":
      return (
        <View>
          <Para first>Je soussigné(e) {prescriber}, atteste avoir proposé à {patientName} les soins suivants :</Para>
          <Quote>{String(d.care)}</Quote>
          <Para>et l&apos;avoir informé(e) des risques encourus en cas de refus :</Para>
          <Quote>{String(d.risks)}</Quote>
          <Para bold>
            Le patient a refusé ces soins et a refusé de signer la décharge de responsabilité. Ce refus a été constaté en présence du ou des
            témoin(s) ci-dessous.
          </Para>
          {d.place && <InfoRow label="Lieu" value={String(d.place)} />}
          <InfoRow label="Témoin(s)" value={String(d.witnesses)} />
        </View>
      );

    case "IMAGERIE": {
      const img = doc.data as unknown as ImagingData;
      const section = (title: string) => <Text style={[s.bold, { marginTop: 14, fontSize: 8, color: BRAND, textTransform: "uppercase" }]}>{title}</Text>;
      return (
        <View>
          {section("Indication")}
          <Text style={{ marginTop: 4 }}>{img.indication}</Text>
          {section("Technique")}
          <Text style={{ marginTop: 4 }}>{techniqueText(img)}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              {section("Résultats")}
              {img.findings.length === 0 && !img.results && <Text style={{ marginTop: 4 }}>Pas d&apos;anomalie décelable.</Text>}
              {img.findings.map((f, i) => (
                <View key={f.id} style={{ flexDirection: "row", marginTop: 4 }} wrap={false}>
                  <Text style={[s.bold, { width: 14, color: "#dc2626" }]}>{i + 1}.</Text>
                  <Text style={{ flex: 1 }}>{findingText(f)}</Text>
                </View>
              ))}
              {img.results && <Text style={{ marginTop: 6 }}>{img.results}</Text>}
            </View>
            <Planche data={img} />
          </View>
          {section("Conclusion")}
          <View style={{ marginTop: 4, padding: 8, backgroundColor: "#f1f7fb", borderRadius: 4 }} wrap={false}>
            <Text style={s.bold}>{img.conclusion}</Text>
          </View>
        </View>
      );
    }

    default:
      return null;
  }
}

/** Planche schématique de la zone examinée, lésions numérotées (même numérotation que les résultats). */
function Planche({ data }: { data: ImagingData }) {
  const region = regionOfNode(data.zone);
  if (!region) return null;
  const mirrored = region.bilateral && data.side === "G";
  const [x, y, w, h] = region.frameOf(data.zone, mirrored, region.aspect);
  const width = 105;
  const unit = w / 60;
  const bones = Object.entries(region.bones);
  return (
    <View style={{ width, marginTop: 14 }}>
      <Svg width={width} height={width / region.aspect} viewBox={`${x} ${y} ${w} ${h}`}>
        <Defs>
          {bones.filter(([, b]) => b.clip).map(([id, b]) => (
            <ClipPath key={id} id={`bclip-${id}`}>
              <Rect x={b.clip![0]} y={b.clip![1]} width={b.clip![2]} height={b.clip![3]} />
            </ClipPath>
          ))}
        </Defs>
        <G transform={mirrored ? `translate(${region.mirror},0) scale(-1,1)` : undefined}>
          {/* Contour extérieur seul : trait large dessous, remplissage par-dessus. */}
          <Path d={region.skin} fill="none" stroke="#d6b49a" strokeWidth={unit * 0.8} />
          <Path d={region.skin} fill="#f6e3d3" />
          {bones.map(([id, bone]) => (
            <G key={id} clipPath={bone.clip ? `url(#bclip-${id})` : undefined}>
              <G transform={bone.transform}>
                {bone.paths.map((p, i) => <Path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />)}
              </G>
            </G>
          ))}
        </G>
        {data.findings.map((f, i) => {
          const [mx, my] = region.markerOf(f.structure);
          const cx = mirrored ? region.mirror - mx : mx;
          return (
            <G key={f.id}>
              <Circle cx={cx} cy={my} r={unit * 2.4} fill="#dc2626" stroke="#ffffff" strokeWidth={unit * 0.4} />
              <Text x={cx - unit * 0.9} y={my + unit * 1} style={{ fontSize: unit * 2.6, fill: "#ffffff", fontFamily: "Helvetica-Bold" }}>{String(i + 1)}</Text>
            </G>
          );
        })}
      </Svg>
      <Text style={{ fontSize: 6.5, color: MUTED, textAlign: "center", marginTop: 2 }}>
        {region.byId.get(data.zone)?.label}{region.bilateral && data.side ? (data.side === "G" ? " gauche" : " droit") : ""}
      </Text>
      <Text style={{ fontSize: 5, color: MUTED, textAlign: "center", marginTop: 1 }}>Dessins : LadyofHats, Servier Medical Art (CC BY 4.0)</Text>
    </View>
  );
}
/** Zone de signature du patient (refus de soins) : à gauche, en face du cachet du soignant. */
function PatientSignature({ signed, patientName }: { signed: boolean; patientName: string }) {
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: 150 }}>
      <Text style={[s.italic, { fontSize: 7.5, color: MUTED }]}>Signature du patient (« Lu et approuvé »)</Text>
      <View style={{ marginTop: 8, height: 60, borderWidth: 0.75, borderColor: LINE, borderRadius: 3, padding: 6, justifyContent: "center" }}>
        {signed && <Text style={[s.italic, { color: "#1e3a8a" }]}>Lu et approuvé — {patientName}</Text>}
      </View>
      {signed && <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 2 }}>Décharge signée par le patient.</Text>}
    </View>
  );
}

function MedicalDocumentPdf({ p, snap, signature }: {
  p: MedicalDocument;
  snap: DocumentSnapshot;
  signature: { data: Buffer; format: "png" | "jpg" } | null;
}) {
  const { patient, prescriber, service } = snap;
  const type = DOCUMENT_TYPES[p.kind];
  const data = (p.data ?? {}) as DocumentData;
  // Imagerie : « Compte rendu — Radiographie / Scanner / IRM ».
  const title = p.kind === "IMAGERIE" ? `Compte rendu — ${MODALITIES[(data as unknown as ImagingData).modality]?.title ?? "Imagerie"}` : type.label;
  const birth = patient.birthDate
    ? `${born(patient.sex)} le ${formatDate(new Date(patient.birthDate))} (${age(patient.birthDate, p.createdAt)} ans)`
    : patient.apparentAge
      ? `Âge apparent : ${patient.apparentAge}`
      : null;
  const hasValidity = Boolean(type.validity);
  // Non identifié : « le patient non identifié X-0003 » plutôt que « M. X-0003 INCONNU ».
  const patientName = patient.unidentified
    ? `le patient non identifié ${patient.firstName}`
    : `${civility(patient.sex)}${patient.firstName} ${patient.lastName.toUpperCase()}`;
  const boxName = patient.unidentified ? `NON IDENTIFIÉ — ${patient.firstName}` : `${patient.lastName.toUpperCase()} ${patient.firstName}`;

  return (
    <Document title={`${title} ${p.number}`} author={prescriber.name} creator={snap.hospitalName}>
      <Page size="A4" style={s.page}>
        <View style={s.watermark} fixed>
          <Cross size={260} color="#ffffff" background="#f1f5f9" />
        </View>

        <View style={s.header}>
          <View style={s.brand}>
            <Cross size={40} color="#ffffff" background={BRAND} />
            <View>
              <Text style={s.hospital}>{snap.hospitalName}</Text>
              {service && <Text style={s.serviceLine}>{service.name}</Text>}
              <Text style={s.small}>{snap.hospitalAddress}</Text>
            </View>
          </View>
          <View style={s.patientBox}>
            <Text style={[s.bold, { fontSize: 10 }]}>{boxName}</Text>
            <Text style={[s.small, { marginTop: 2 }]}>
              {birth ?? "Date de naissance inconnue"}
              {patient.sex && ` — Sexe : ${patient.sex}`}
            </Text>
            <Text style={s.small}>N° patient : {patient.number}</Text>
            <View style={{ marginTop: 5, alignItems: "center" }}>
              <Barcode value={patient.number} width={195} height={24} />
              <Text style={{ fontSize: 6, marginTop: 1 }}>{patient.number}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.body}>
          <View style={s.sidebar}>
            <View>
              {service && <Text style={s.sideService}>{service.name}</Text>}
              {service?.head && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[s.italic, { fontSize: 7, color: MUTED }]}>Chef de service</Text>
                  <Text style={[s.bold, { fontSize: 8 }]}>{service.head.name}</Text>
                  {service.head.title && <Text style={{ fontSize: 7 }}>{service.head.title}</Text>}
                </View>
              )}
            </View>
            <View>
              <Text style={{ fontSize: 7 }}>{snap.hospitalName}</Text>
              <Text style={{ fontSize: 7 }}>{snap.hospitalAddress}</Text>
            </View>
          </View>

          <View style={s.main}>
            <Text style={{ textAlign: "right" }}>{snap.hospitalCity}, le {formatLongDate(p.createdAt)}</Text>
            <Text style={s.title}>{title}</Text>
            <Text style={[s.small, { textAlign: "center", fontSize: 7, marginTop: 3 }]}>N° {p.number}</Text>

            <View style={{ marginTop: 26 }}>
              <Text style={[s.bold, { fontSize: 10.5 }]}>{patient.unidentified ? `Patient non identifié ${patient.firstName}` : patientName}</Text>
              {birth && <Text style={[s.small, { marginTop: 2 }]}>{birth}</Text>}
            </View>

            <DocumentBody doc={p} snap={snap} patientName={patientName} />

            {p.body && <Text style={{ marginTop: 16 }}>{p.body}</Text>}
            {type.renewable && <Text style={[s.italic, { marginTop: 16 }]}>{p.renewable ? "Renouvelable." : "Non renouvelable."}</Text>}

            <View style={{ flexGrow: 1 }} />

            <View wrap={false} style={{ marginTop: 24 }}>
              {p.kind === "REFUS_SOINS" && <PatientSignature signed={data.signed === true} patientName={patientName} />}
              <Text style={[s.italic, { textAlign: "right", fontSize: 7.5, color: MUTED }]}>Signature et cachet du soignant</Text>
              <View style={s.stampRow}>
                {/* Avec une signature patient à gauche, le cachet se décale à droite (la signature du soignant le recouvre). */}
                <View style={p.kind === "REFUS_SOINS" ? [s.stamp, { marginRight: 25 }] : s.stamp}>
                  <View style={s.stampInner}>
                    <Text style={s.stampText}>{snap.hospitalName.toUpperCase()} — {snap.hospitalCity.toUpperCase()}</Text>
                    {service && <Text style={[s.stampText, s.bold]}>{service.name.toUpperCase()}</Text>}
                    <Text style={[s.stampText, s.bold, { fontSize: 8, marginTop: 2 }]}>{prescriber.name}</Text>
                    {prescriber.title && <Text style={s.stampText}>{prescriber.title}</Text>}
                  </View>
                </View>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf, pas une balise HTML */}
                {signature && <Image src={signature} style={s.signature} />}
              </View>
              <Text style={[s.bold, { textAlign: "right", fontSize: 9.5, marginTop: 4 }]}>{prescriber.name}</Text>
              {prescriber.title && <Text style={{ textAlign: "right", fontSize: 8 }}>{prescriber.title}</Text>}
              {prescriber.role && <Text style={{ textAlign: "right", fontSize: 8 }}>{prescriber.role}</Text>}
            </View>
          </View>
        </View>

        {p.revokedAt && <Text style={s.revoked} fixed>ANNULÉE</Text>}

        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text>{hasValidity ? `Validité : ${p.validityMonths} mois à compter du ${formatDate(p.createdAt)}` : ""}</Text>
            <Text render={({ pageNumber, totalPages }) => `${title} n° ${p.number} — Page ${pageNumber}/${totalPages}`} />
          </View>
          <Text style={{ fontSize: 6.5, color: MUTED, textAlign: "center", marginTop: 4 }}>
            {[snap.hospitalName, service?.name, snap.hospitalAddress].filter(Boolean).join(" — ")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(p: MedicalDocument) {
  const snap = p.snapshot as DocumentSnapshot;
  const image = await loadStoredImage(snap.prescriber.signatureUrl);
  const signature = image && (image.mimeType === "image/png" || image.mimeType === "image/jpeg")
    ? { data: Buffer.from(image.data), format: image.mimeType === "image/png" ? ("png" as const) : ("jpg" as const) }
    : null;
  return renderToBuffer(<MedicalDocumentPdf p={p} snap={snap} signature={signature} />);
}
