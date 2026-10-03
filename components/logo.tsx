/* The Marktmorgen mark: the sun coming up over a market awning, white on the
   signature gradient. The gradient is drawn by CSS rather than an SVG
   <linearGradient>, so two marks on one page (a hidden one included) never
   fight over the same id and vanish. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center bg-[linear-gradient(135deg,#6a47ff_0%,#4526d6_55%,#2f6cf5_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" focusable="false">
        <path d="M7.4 11.6a4.6 4.6 0 0 1 9.2 0Z" fill="#fff" />
        <path d="M3 13.8h18V17a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" fill="#fff" />
        <path d="M12 3.4v1.6M6.2 5.8l1.13 1.13M17.8 5.8l-1.13 1.13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}

export function Logo({
  tone = "dark",
  size = 32,
}: {
  tone?: "dark" | "light";
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span
        className={`whitespace-nowrap text-[1.125rem] font-semibold tracking-[-0.03em] ${
          tone === "light" ? "text-white" : "text-ink"
        }`}
      >
        Marktmorgen
      </span>
    </span>
  );
}
