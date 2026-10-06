export function GradeBadge({ grade }: { grade: { name: string; color: string } | null }) {
  if (!grade) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: grade.color, backgroundColor: `${grade.color}1a` }}
    >
      {grade.name}
    </span>
  );
}