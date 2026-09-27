/**
 * Stars, drawn from a number: five outlines, filled as far as the number
 * reaches, in the store's own accent (which lib/store-look.ts has already
 * moved until it reads against the page). One picture with one label, so a
 * screen reader hears "Rated 4.8 out of 5" once rather than five images.
 */
const STAR = "m12 3.8 2.5 5.1 5.6.8-4.05 3.95.96 5.6L12 16.6l-5.01 2.65.96-5.6L3.9 9.7l5.6-.8L12 3.8Z";

export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  const fill = Math.max(0, Math.min(5, value)) / 5;
  const row = (filled: boolean) =>
    Array.from({ length: 5 }, (_, i) => (
      <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="shrink-0">
        <path d={STAR} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    ));
  return (
    <span className="rv-stars" role="img" aria-label={label ?? `Rated ${value.toFixed(1)} out of 5`}>
      <span className="rv-stars-empty">{row(false)}</span>
      <span className="rv-stars-full" style={{ width: `${fill * 100}%` }}>
        {row(true)}
      </span>
    </span>
  );
}
