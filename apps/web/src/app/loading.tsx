export default function Loading() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Chargement">
      <span className="size-8 animate-spin rounded-full border-4 border-ocean-100 border-t-ocean-600" />
    </div>
  );
}
