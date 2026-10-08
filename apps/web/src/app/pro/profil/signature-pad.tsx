"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Eraser } from "lucide-react";

const WIDTH = 600;
const HEIGHT = 200;
const INK = "#1e3a8a";

/**
 * Signature dessinée (souris, doigt ou stylet), envoyée en PNG transparent pour se superposer au cachet.
 * Valeur du champ `signature` : "" = inchangée, "remove" = retirée, sinon data URL PNG.
 */
export function SignaturePad({ currentUrl }: { currentUrl: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [value, setValue] = useState("");
  const [drawn, setDrawn] = useState(false);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WIDTH, y: ((e.clientY - rect.top) / rect.height) * HEIGHT };
  };

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = point(e);
  };

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = point(e);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setDrawn(true);
  };

  const end = () => {
    if (!last.current) return;
    last.current = null;
    setValue(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    canvasRef.current!.getContext("2d")!.clearRect(0, 0, WIDTH, HEIGHT);
    setDrawn(false);
    setValue(currentUrl ? "remove" : "");
  };

  const showCurrent = currentUrl && !drawn && value !== "remove";

  return (
    <div>
      <p className="label">Signature (apposée sur vos ordonnances)</p>
      <input type="hidden" name="signature" value={value} />
      <div className="relative overflow-hidden rounded-xl border border-dashed border-line bg-white">
        {showCurrent && (
          // eslint-disable-next-line @next/next/no-img-element -- image servie par /api/images
          <img src={currentUrl} alt="Signature actuelle" className="pointer-events-none absolute inset-0 size-full object-contain opacity-60" />
        )}
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="relative block aspect-[3/1] w-full cursor-crosshair touch-none"
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
        <span>{showCurrent ? "Signature actuelle — dessinez par-dessus pour la remplacer." : "Signez dans le cadre."}</span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 font-medium hover:text-ink">
          <Eraser className="size-3.5" /> Effacer
        </button>
      </div>
    </div>
  );
}
