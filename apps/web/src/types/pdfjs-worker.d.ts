// Le worker de pdf.js n'a pas de types : seul son WorkerMessageHandler est utilisé (voir lib/pdf-to-png.ts).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
