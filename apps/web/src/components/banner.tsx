/* eslint-disable @next/next/no-img-element */
/** Bannière d'une fiche soignant : image choisie, sinon dégradé aux couleurs de l'hôpital. */
export function Banner({ src, className = "h-32" }: { src?: string | null; className?: string }) {
  if (src) return <img src={src} alt="" className={`${className} w-full object-cover`} />;
  return (
    <div
      aria-hidden
      className={`${className} w-full bg-ocean-700`}
      style={{ background: "radial-gradient(30rem 12rem at 90% 120%, #35a9d3, transparent), radial-gradient(20rem 10rem at 0% 0%, #0a2738, transparent), #0b5a7c" }}
    />
  );
}
