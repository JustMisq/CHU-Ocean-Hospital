import "server-only";
import { Circle, Document, Image, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
// Encodeur seul (sans DOM) : renvoie la suite de barres « 1101… ».
// @ts-expect-error -- module interne de jsbarcode, sans types
import { CODE128 } from "jsbarcode/bin/barcodes/CODE128";
import type { Prescription } from "@ocean/db";
import { KIND_LABELS, type PrescriptionItem, type PrescriptionSnapshot } from "./prescription-types";
import { loadStoredImage } from "./prescriptions";
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

function PrescriptionDocument({ p, snap, signature }: {
  p: Prescription;
  snap: PrescriptionSnapshot;
  signature: { data: Buffer; format: "png" | "jpg" } | null;
}) {
  const { patient, prescriber, service } = snap;
  const items = (p.items as PrescriptionItem[]) ?? [];
  const title = KIND_LABELS[p.kind];
  const birth = patient.birthDate ? `${born(patient.sex)} le ${formatDate(new Date(patient.birthDate))} (${age(patient.birthDate, p.createdAt)} ans)` : null;
  const hasValidity = p.kind !== "CERTIFICAT";

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
            <Text style={[s.bold, { fontSize: 10 }]}>{patient.lastName.toUpperCase()} {patient.firstName}</Text>
            <Text style={[s.small, { marginTop: 2 }]}>
              {birth ?? "Date de naissance non renseignée"}
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
              <Text style={[s.bold, { fontSize: 10.5 }]}>{civility(patient.sex)}{patient.firstName} {patient.lastName.toUpperCase()}</Text>
              {birth && <Text style={[s.small, { marginTop: 2 }]}>{birth}</Text>}
            </View>

            {items.map((item, i) => (
              <View key={i} style={s.item} wrap={false}>
                <Text style={[s.bold, { fontSize: 10 }]}>{item.name}</Text>
                {item.instructions && <Text style={s.indent}>{item.instructions}</Text>}
                {item.quantity && <Text style={[s.bold, s.indent, { marginTop: 6 }]}>{item.quantity}</Text>}
              </View>
            ))}

            {p.body && <Text style={{ marginTop: 16 }}>{p.body}</Text>}
            {hasValidity && <Text style={[s.italic, { marginTop: 16 }]}>{p.renewable ? "Renouvelable." : "Non renouvelable."}</Text>}

            <View style={{ flexGrow: 1 }} />

            <View wrap={false} style={{ marginTop: 24 }}>
              <Text style={[s.italic, { textAlign: "right", fontSize: 7.5, color: MUTED }]}>Signature et cachet du prescripteur</Text>
              <View style={s.stampRow}>
                <View style={s.stamp}>
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

export async function renderPrescriptionPdf(p: Prescription) {
  const snap = p.snapshot as PrescriptionSnapshot;
  const image = await loadStoredImage(snap.prescriber.signatureUrl);
  const signature = image && (image.mimeType === "image/png" || image.mimeType === "image/jpeg")
    ? { data: Buffer.from(image.data), format: image.mimeType === "image/png" ? ("png" as const) : ("jpg" as const) }
    : null;
  return renderToBuffer(<PrescriptionDocument p={p} snap={snap} signature={signature} />);
}
