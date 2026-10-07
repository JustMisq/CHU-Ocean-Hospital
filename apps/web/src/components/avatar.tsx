/* eslint-disable @next/next/no-img-element */
const SIZES = { sm: "size-8 text-xs", md: "size-12 text-sm", lg: "size-20 text-2xl" };

export function Avatar({ name, src, size = "sm", className = "" }: { name: string; src?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const cls = `${SIZES[size]} ${className}`;
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
