/**
 * How a creator's public page looks: a theme and one colour.
 *
 * The creator picks the colour freely, including one of their own, and the
 * page still has to be readable by everyone who opens it. So the colour they
 * pick is the starting point rather than the final value: every colour the
 * page actually paints is derived here and moved, only as far as needed,
 * until it passes the contrast a reader needs — 4.5:1 for text and 3:1 for
 * the edge of a button. A pale yellow still reads as yellow; it simply stops
 * being a button nobody can see.
 *
 * Nothing in this file touches the network or the store, so the studio can
 * run the same arithmetic in the browser for its live preview and the two can
 * never disagree about what the page will look like.
 */

export const THEMES = [
  {
    id: "light",
    label: "Paper",
    description: "Light and quiet. Your colour is on the buttons.",
  },
  {
    id: "sand",
    label: "Sand",
    description: "Warm and soft, like good paper in the sun.",
  },
  {
    id: "night",
    label: "Night",
    description: "Dark, for photos and colours that glow.",
  },
  {
    id: "bold",
    label: "Colour",
    description: "Your colour across the top of the page.",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));

/** Colours to start from. The creator may also type or pick any other one. */
export const ACCENTS = [
  { hex: "#5a36ee", label: "Violet" },
  { hex: "#2f74f5", label: "Blue" },
  { hex: "#0e7c86", label: "Teal" },
  { hex: "#15803d", label: "Green" },
  { hex: "#b45309", label: "Amber" },
  { hex: "#e5533d", label: "Coral" },
  { hex: "#db2777", label: "Pink" },
  { hex: "#9333ea", label: "Plum" },
  { hex: "#be123c", label: "Ruby" },
  { hex: "#15112e", label: "Ink" },
] as const;

export type StoreLook = { theme: ThemeId; accent: string };

export const DEFAULT_LOOK: StoreLook = { theme: "light", accent: "#5a36ee" };

/** Exactly six hex digits after a hash, lower case. Nothing else is a colour here. */
export const HEX_PATTERN = /^#[0-9a-f]{6}$/;

export function isTheme(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.has(value);
}

/** Reads a typed or picked colour: "#AbC123", "abc123" and "#abc" all count. */
export function normaliseHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim().toLowerCase();
  if (!text.startsWith("#")) text = `#${text}`;
  if (/^#[0-9a-f]{3}$/.test(text)) {
    text = `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  }
  return HEX_PATTERN.test(text) ? text : null;
}

/** Whatever came back from storage, made safe to use. */
export function parseLook(raw: unknown): StoreLook {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LOOK };
  const value = raw as Partial<StoreLook>;
  return {
    theme: isTheme(value.theme) ? value.theme : DEFAULT_LOOK.theme,
    accent: normaliseHex(value.accent) ?? DEFAULT_LOOK.accent,
  };
}

type Palette = {
  bg: string;
  card: string;
  item: string;
  text: string;
  muted: string;
  line: string;
  lineStrong: string;
  field: string;
  dark: boolean;
};

const PALETTES: Record<ThemeId, Palette> = {
  light: {
    bg: "#fbfaf7",
    card: "#ffffff",
    item: "#fbfaf7",
    text: "#15112e",
    muted: "#4a4560",
    line: "#e6e1d6",
    lineStrong: "#cbc4b4",
    field: "#ffffff",
    dark: false,
  },
  sand: {
    bg: "#f3ece0",
    card: "#fffdf9",
    item: "#f8f3ea",
    text: "#2a2118",
    muted: "#5c5244",
    line: "#e4d9c6",
    lineStrong: "#c9bba2",
    field: "#fffdf9",
    dark: false,
  },
  night: {
    bg: "#0d0b24",
    card: "#16133a",
    item: "#1d1946",
    text: "#f5f3ff",
    muted: "#bdb8dc",
    line: "#2e2a66",
    lineStrong: "#4d4893",
    field: "#100e2c",
    dark: true,
  },
  bold: {
    bg: "#fbfaf7",
    card: "#ffffff",
    item: "#fbfaf7",
    text: "#15112e",
    muted: "#4a4560",
    line: "#e6e1d6",
    lineStrong: "#cbc4b4",
    field: "#ffffff",
    dark: false,
  },
};

const WHITE = "#ffffff";
const BLACK = "#000000";

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(values: number[]): string {
  return `#${values
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio between two colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A colour a share of the way from one to another. */
export function mix(from: string, to: string, share: number): string {
  const a = channels(from);
  const b = channels(to);
  return toHex(a.map((v, i) => v + (b[i] - v) * share));
}

/**
 * The first colour on the way from `color` to `target` that passes `test`,
 * in small steps, so a colour is moved no further than it has to be.
 */
function nearestPassing(color: string, target: string, test: (c: string) => boolean): string {
  for (let step = 0; step <= 25; step += 1) {
    const candidate = mix(color, target, step / 25);
    if (test(candidate)) return candidate;
  }
  return target;
}

export type LookColours = {
  bg: string;
  card: string;
  item: string;
  text: string;
  muted: string;
  line: string;
  lineStrong: string;
  field: string;
  /** The fill of the buttons: the creator's colour, moved until it can be seen. */
  accent: string;
  /** The words on that fill. */
  onAccent: string;
  /** The creator's colour where it is used as text or as a thin line. */
  accentText: string;
  /** A wash of the colour behind the option a buyer has picked. */
  accentSoft: string;
  /** The far end of the band across the top of the Colour theme. */
  accent2: string;
  dark: boolean;
};

/** Every colour the page paints, worked out from the two things the creator chose. */
export function lookColours(look: StoreLook): LookColours {
  const palette = PALETTES[look.theme] ?? PALETTES.light;
  const picked = normaliseHex(look.accent) ?? DEFAULT_LOOK.accent;
  const away = palette.dark ? WHITE : BLACK;

  // A button has to stand out from the card it sits on.
  const accent = nearestPassing(picked, away, (c) => contrast(c, palette.card) >= 3);

  // The words on it take whichever of white and ink reads better. When
  // neither reaches 4.5, the fill itself moves until white does.
  let fill = accent;
  const onAccent = contrast(fill, WHITE) >= contrast(fill, palette.dark ? "#0d0b24" : "#15112e")
    ? WHITE
    : palette.dark
      ? "#0d0b24"
      : "#15112e";
  if (contrast(fill, onAccent) < 4.5) {
    const towards = onAccent === WHITE ? BLACK : WHITE;
    fill = nearestPassing(fill, towards, (c) => contrast(c, onAccent) >= 4.5);
  }

  const accentText = nearestPassing(
    picked,
    palette.text,
    (c) => contrast(c, palette.card) >= 4.5 && contrast(c, palette.item) >= 4.5,
  );

  const accentSoft = nearestPassing(
    mix(fill, palette.card, palette.dark ? 0.72 : 0.86),
    palette.card,
    (c) => contrast(c, palette.text) >= 7,
  );

  // The band behind the name on the Colour theme runs from the fill to a
  // shade of it. The shade moves in the direction that helps the words on it.
  const accent2 = onAccent === WHITE ? mix(fill, BLACK, 0.3) : mix(fill, WHITE, 0.35);

  return {
    bg: palette.bg,
    card: palette.card,
    item: palette.item,
    text: palette.text,
    muted: palette.muted,
    line: palette.line,
    lineStrong: palette.lineStrong,
    field: palette.field,
    accent: fill,
    onAccent,
    accentText,
    accentSoft,
    accent2,
    dark: palette.dark,
  };
}

/** The same colours as CSS custom properties, for the page's outermost element. */
export function lookStyle(look: StoreLook): Record<string, string> {
  const c = lookColours(look);
  return {
    "--st-bg": c.bg,
    "--st-card": c.card,
    "--st-item": c.item,
    "--st-text": c.text,
    "--st-muted": c.muted,
    "--st-line": c.line,
    "--st-line-strong": c.lineStrong,
    "--st-field": c.field,
    "--st-accent": c.accent,
    "--st-on-accent": c.onAccent,
    "--st-accent-text": c.accentText,
    "--st-accent-soft": c.accentSoft,
    "--st-accent-2": c.accent2,
    colorScheme: c.dark ? "dark" : "light",
  };
}

/** A name for a colour that is not one of the presets, for screen readers. */
export function accentLabel(hex: string): string {
  return ACCENTS.find((accent) => accent.hex === hex)?.label ?? `Your colour, ${hex}`;
}
