/* eslint-disable @next/next/no-img-element */
export function Avatar({ name, src, size = "sm" }: { name: string; src?: string | null; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "size-20 text-2xl" : "size-8 text-xs";
  const initials = name
    .replace(/^Dr\.?\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  if (src) return <img src={src} alt="" className={`${cls} shrink-0 rounded-full object-cover`} />;
  return (
    <span className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-ocean-100 font-bold text-ocean-700`}>
      {initials}
    </span>
  );
}
