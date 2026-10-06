export function Logo({ name, light = false }: { name: string; light?: boolean }) {
  // Le dernier mot du nom est mis en couleur : "Ocean Hospital" → Ocean**Hospital**.
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : null;

  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-ocean-600" />
        <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="white" />
        <path d="M4 24c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2" stroke="#74c9e7" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        {words.join(" ")}
        {last && <span className="text-ocean-500">{" "}{last}</span>}
      </span>
    </span>
  );
}
