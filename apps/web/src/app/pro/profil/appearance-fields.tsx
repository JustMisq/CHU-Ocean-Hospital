"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImageUp, Trash } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Banner } from "@/components/banner";

/** Dimensions finales : l'image est recadrée au centre puis compressée dans le navigateur. */
const FORMATS = {
  photo: { width: 400, height: 400 },
  banner: { width: 1500, height: 500 },
};

type Kind = keyof typeof FORMATS;
/** "" = inchangée, "remove" = retirée, sinon data URL de la nouvelle image (voir updateOwnProfile). */
type Value = string;

async function processImage(file: File, kind: Kind): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Ce fichier n'est pas une image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image trop lourde (15 Mo max).");

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Impossible de lire cette image.");
  });
  const { width, height } = FORMATS[kind];
  // Recadrage « cover » : on garde le centre de l'image au bon ratio.
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const sw = width / scale;
  const sh = height / scale;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  bitmap.close();

  // WebP si le navigateur sait l'encoder, sinon JPEG (jamais PNG : trop lourd).
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

/** Photo + bannière par glisser-déposer, avec aperçu de la fiche en direct. */
export function AppearanceFields({ name, photoUrl, bannerUrl }: {
  name: string;
  photoUrl: string | null;
  bannerUrl: string | null;
}) {
  const [photo, setPhoto] = useState<Value>("");
  const [banner, setBanner] = useState<Value>("");
  const preview = (value: Value, current: string | null) => (value === "remove" ? null : value || current);

  return (
    <div className="space-y-3">
      <p className="label mb-0">Apparence de la fiche</p>
      <div className="overflow-hidden rounded-xl border border-line">
        <Banner src={preview(banner, bannerUrl)} className="h-28" />
        <div className="px-4 pb-4">
          <Avatar name={name} src={preview(photo, photoUrl)} size="lg" className="-mt-10 ring-4 ring-white" />
        </div>
      </div>

      <input type="hidden" name="photo" value={photo} />
      <input type="hidden" name="banner" value={banner} />
      <div className="grid gap-3 sm:grid-cols-2">
        <DropZone
          kind="photo"
          label="Photo"
          hint="Carrée, recadrée au centre (sinon : initiales)"
          hasImage={Boolean(preview(photo, photoUrl))}
          onImage={(v) => setPhoto(v)}
          onRemove={() => setPhoto(photoUrl ? "remove" : "")}
          removeLabel="Retirer la photo"
        />
        <DropZone
          kind="banner"
          label="Bannière"
          hint="Format large (3:1), recadrée au centre"
          hasImage={Boolean(preview(banner, bannerUrl))}
          onImage={(v) => setBanner(v)}
          onRemove={() => setBanner(bannerUrl ? "remove" : "")}
          removeLabel="Retirer la bannière"
        />
      </div>
      {(photo || banner) && <p className="text-xs text-amber-700">Pensez à enregistrer pour appliquer les changements.</p>}
    </div>
  );
}

function DropZone({ kind, label, hint, hasImage, onImage, onRemove, removeLabel }: {
  kind: Kind;
  label: string;
  hint: string;
  hasImage: boolean;
  onImage: (dataUrl: string) => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onImage(await processImage(file, kind));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image invalide.");
    } finally {
      setBusy(false);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    handle(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-4 text-center text-sm transition ${over ? "border-ocean-500 bg-ocean-50" : "border-line hover:border-ocean-300"}`}
      >
        <ImageUp className="size-5 text-ocean-600" />
        <span className="font-medium">{busy ? "Traitement…" : `${label} : glisser ou cliquer`}</span>
        <span className="text-xs text-muted">{hint}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
      {hasImage && (
        <button type="button" onClick={onRemove} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-muted hover:text-red-700">
          <Trash className="size-3.5" /> {removeLabel}
        </button>
      )}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
