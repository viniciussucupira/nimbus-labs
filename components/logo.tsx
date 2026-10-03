import { useId } from "react";

/* The Marktmorgen mark: a golden sun coming up behind a market awning in
   white and coral stripes, on the signature violet. The violet and the warm
   glow behind the sun are drawn by CSS, so they never depend on an id; the
   sun's own gradient takes its id from useId, so two marks on one page (a
   hidden one included) never fight over the same id and vanish. */
export function LogoMark({ size = 32 }: { size?: number }) {
  const sun = useId();
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center overflow-hidden bg-[radial-gradient(48.8%_48.8%_at_50%_54.3%,rgba(255,138,92,0.78)_0%,rgba(255,138,92,0.18)_55%,rgba(255,138,92,0)_100%),linear-gradient(135deg,#7b5cff_0%,#4a2ae0_55%,#2b4fe8_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
      style={{ width: size, height: size, borderRadius: size * 0.227 }}
    >
      <svg width={size} height={size} viewBox="0 0 512 512" focusable="false">
        <defs>
          <linearGradient id={sun} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe072" />
            <stop offset="1" stopColor="#ffb323" />
          </linearGradient>
        </defs>
        <circle cx="256" cy="258" r="92" fill={`url(#${sun})`} />
        <path
          d="M361.7 197l29.4-17M317 152.300l17-29.400M256 136v-34M195 152.300l-17-29.400M150.300 197l-29.400-17"
          stroke="#ffd557"
          strokeWidth="17"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M146 258h44l-43.200 104a36.400 33.500 0 0 1-72.800 0Z" fill="#fff" />
        <path d="M190 258h44l-14.400 104a36.400 33.500 0 0 1-72.800 0Z" fill="#ff7257" />
        <path d="M234 258h44l14.400 104a36.400 33.500 0 0 1-72.800 0Z" fill="#fff" />
        <path d="M278 258h44l43.200 104a36.400 33.500 0 0 1-72.800 0Z" fill="#ff7257" />
        <path d="M322 258h44l72 104a36.400 33.500 0 0 1-72.800 0Z" fill="#fff" />
        <rect x="136" y="248" width="240" height="20" rx="10" fill="#fff" />
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
