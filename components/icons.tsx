/*
 * One icon set for the whole site: 24px grid, 1.75 stroke, round ends.
 * Drawn in the same line language so a menu, a card and a button never mix
 * three styles. Every icon is decorative by default (aria-hidden); a label
 * belongs on the control that holds it, not on the drawing.
 */

export type IconName =
  | "arrow-right"
  | "arrow-up-right"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-right"
  | "menu"
  | "close"
  | "plus"
  | "minus"
  | "store"
  | "tag"
  | "bolt"
  | "bank"
  | "link"
  | "user"
  | "users"
  | "mail"
  | "file"
  | "download"
  | "card"
  | "lock"
  | "shield"
  | "chart"
  | "calendar"
  | "book"
  | "gauge"
  | "scale"
  | "calculator"
  | "flask"
  | "chat"
  | "handshake"
  | "list"
  | "globe"
  | "palette"
  | "dumbbell"
  | "utensils"
  | "cap"
  | "camera"
  | "music"
  | "gamepad"
  | "clock"
  | "refresh"
  | "gift"
  | "percent"
  | "sparkle"
  | "phone"
  | "door"
  | "key"
  | "eye"
  | "target"
  | "window"
  | "pin"
  | "receipt"
  | "ladder"
  | "basket"
  | "video"
  | "plug"
  | "scroll"
  | "type"
  | "repeat"
  | "trash"
  | "mic"
  | "ban"
  | "party"
  | "notebook"
  | "info"
  | "alert"
  | "external";

const PATHS: Record<IconName, React.ReactNode> = {
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-up-right": <path d="M7 17 17 7M9 7h8v8" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.3 2.6 2.6 5-5.2" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  store: (
    <>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-6.7 6.7a1.5 1.5 0 0 1-2.1 0Z" />
      <circle cx="8.2" cy="8.2" r="1.4" />
    </>
  ),
  bolt: <path d="M13 3 5 13.5h6L10.5 21 19 10.5h-6L13 3Z" />,
  bank: (
    <>
      <path d="M3.5 9 12 4l8.5 5" />
      <path d="M5.5 10v7M9.8 10v7M14.2 10v7M18.5 10v7M3.5 20h17" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.9M17.4 13.9a6.2 6.2 0 0 1 3.8 5.6" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </>
  ),
  file: (
    <>
      <path d="M13.5 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z" />
      <path d="M13.5 3.5v5h5M9 13h6M9 16.5h4" />
    </>
  ),
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6Z" />
      <path d="m9 12 2.2 2.2L15.3 10" />
    </>
  ),
  chart: <path d="M4 20V4M4 20h16M8.5 16v-4M12.5 16V8M16.5 16v-6.5" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v14H6.5a2 2 0 0 0-2 2Z" />
      <path d="M4.5 19.5a2 2 0 0 0 2 2H19v-4" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0" />
      <path d="m12 13.5 4-5" />
      <circle cx="12" cy="14" r="1.3" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7.5 20h9M5 7.5h14" />
      <path d="M5 7.5 2.8 13a3 3 0 0 0 4.4 0Z M19 7.5 16.8 13a3 3 0 0 0 4.4 0Z" />
    </>
  ),
  calculator: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3.5h5M10.5 3.5v5.8L5.2 18a1.8 1.8 0 0 0 1.6 2.5h10.4a1.8 1.8 0 0 0 1.6-2.5l-5.3-8.7V3.5" />
      <path d="M7.5 14.5h9" />
    </>
  ),
  chat: <path d="M5 18.5V6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.5Z" />,
  handshake: (
    <>
      <path d="m3 11 3.5-3.5 3 1.5 3-2 4.5 1L21 11" />
      <path d="m7 13.5 3.2 3.2a1.6 1.6 0 0 0 2.3 0l4-4" />
      <path d="m10 10.5 2.5 2.5M3 11l3 3M21 11l-3 3" />
    </>
  ),
  list: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5Z" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.8-.9 1.4-2l-.3-.8c-.5-1.2.4-2.2 1.6-2.2h2c2.1 0 3.8-1.6 3.8-3.7 0-4.6-3.8-8.3-8.5-8.3Z" />
      <circle cx="7.8" cy="11" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="15" cy="8" r="1" />
    </>
  ),
  dumbbell: <path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11" />,
  utensils: (
    <>
      <path d="M6.5 3.5v6.5a2 2 0 0 0 4 0V3.5M8.5 10v10.5" />
      <path d="M17.5 20.5V3.5c-2 1-3 3.3-3 6v4h3" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14Z" />
      <path d="M6.5 11.5v4.3c1.4 1.3 3.3 2 5.5 2s4.1-.7 5.5-2v-4.3M21.5 9.5v5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V5.5l10.5-2v12" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17" cy="15.5" r="2.5" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7 7.5h10a4 4 0 0 1 3.9 4.8l-.8 3.9a2.3 2.3 0 0 1-4 1l-1.8-2.2h-4.6L7.9 17.2a2.3 2.3 0 0 1-4-1l-.8-3.9A4 4 0 0 1 7 7.5Z" />
      <path d="M8 10.5v3M6.5 12h3M15.5 11.5h.01M17.5 13h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15" />,
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v8.5h14V12M12 8v12.5M12 8C10.5 4 6.5 4.5 7.5 7c.4 1 2.5 1 4.5 1Zm0 0c1.5-4 5.5-3.5 4.5-1-.4 1-2.5 1-4.5 1Z" />
    </>
  ),
  percent: (
    <>
      <path d="M18.5 5.5 5.5 18.5" />
      <circle cx="7" cy="7" r="2.3" />
      <circle cx="17" cy="17" r="2.3" />
    </>
  ),
  sparkle: <path d="M12 3.5c.6 4.5 3.9 7.9 8.5 8.5-4.6.6-7.9 3.9-8.5 8.5-.6-4.6-3.9-7.9-8.5-8.5 4.6-.6 7.9-4 8.5-8.5Z" />,
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  door: (
    <>
      <path d="M5.5 20.5V4.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v16M3.5 20.5h17" />
      <path d="M14.5 12.5h.01" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4" />
      <path d="m11 12.5 8.5-8.5M16.5 7l2.5 2.5M14 9.5l2 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  window: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17M7 6.8h.01M9.5 6.8h.01" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.3 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2.5-1.6L8 20.5l-2-1.3Z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </>
  ),
  ladder: <path d="M8 3.5v17M16 3.5v17M8 7.5h8M8 12h8M8 16.5h8" />,
  basket: (
    <>
      <path d="M3.5 10h17l-1.6 8.5a2 2 0 0 1-2 1.5H7.1a2 2 0 0 1-2-1.5Z" />
      <path d="m8 10 3-6M16 10l-3-6M9.5 14v2.5M14.5 14v2.5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </>
  ),
  plug: <path d="M9 3.5V8M15 3.5V8M6.5 8h11v3a5.5 5.5 0 0 1-11 0Zm5.5 8.5v4" />,
  scroll: (
    <>
      <path d="M7.5 20.5h10a2 2 0 0 0 2-2V5.5a2 2 0 0 0-2-2h-10" />
      <path d="M7.5 3.5a2 2 0 0 0-2 2v13a2 2 0 1 0 4 0v-1h10M10 8h6M10 11.5h6" />
    </>
  ),
  type: <path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6" />,
  repeat: <path d="M4.5 11V9a3 3 0 0 1 3-3h12l-3-3M19.5 13v2a3 3 0 0 1-3 3h-12l3 3" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  party: (
    <>
      <path d="m4 20 5.5-14 8.5 8.5Z" />
      <path d="M14 4.5c.5 1.5.3 2.8-.5 4M18.5 9c1.3-.4 2.5-.3 3 .2M16 3.5h.01M20.5 5.5h.01M20 13h.01" />
    </>
  ),
  notebook: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5v17M12 8h4M12 11.5h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.3 2.9 17.5a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4.5M12 17h.01" />
    </>
  ),
  external: <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />,
};

export function Icon({
  name,
  size = 20,
  className = "",
  strokeWidth = 1.75,
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/*
 * Older content (the topic pages, the menus) was written with emoji. Rather
 * than rewrite every entry, each emoji maps to the icon that says the same
 * thing, so the page draws one consistent set.
 */
const FROM_EMOJI: Record<string, IconName> = {
  "🙋": "user",
  "⚡": "bolt",
  "🎨": "palette",
  "✉️": "mail",
  "✉": "mail",
  "🧾": "receipt",
  "🔗": "link",
  "🏦": "bank",
  "🍅": "utensils",
  "🎉": "party",
  "💬": "chat",
  "🏷️": "tag",
  "🏷": "tag",
  "📦": "file",
  "🛍️": "basket",
  "🛍": "basket",
  "🚪": "door",
  "🚀": "gauge",
  "🧪": "flask",
  "🏪": "store",
  "🔒": "lock",
  "🧮": "calculator",
  "💸": "percent",
  "🛠️": "sparkle",
  "📓": "notebook",
  "🔑": "key",
  "🪟": "window",
  "🎯": "target",
  "👀": "eye",
  "📩": "mail",
  "💳": "card",
  "🙅": "ban",
  "🗑️": "trash",
  "🗑": "trash",
  "🎤": "mic",
  "🎓": "cap",
  "🥗": "utensils",
  "🏋️": "dumbbell",
  "🏋": "dumbbell",
  "📊": "chart",
  "⚖️": "scale",
  "⚖": "scale",
  "🤝": "handshake",
  "📄": "file",
  "📌": "pin",
  "🔤": "type",
  "🪜": "ladder",
  "🗓️": "calendar",
  "🗓": "calendar",
  "🧺": "basket",
  "📱": "phone",
  "🔁": "repeat",
  "📹": "video",
  "🌐": "globe",
  "📜": "scroll",
  "🔌": "plug",
  "⏱️": "clock",
  "⏱": "clock",
};

export function iconFor(emoji: string | undefined, fallback: IconName = "sparkle"): IconName {
  if (!emoji) return fallback;
  return FROM_EMOJI[emoji.trim()] ?? FROM_EMOJI[emoji.trim().replace(/️/g, "")] ?? fallback;
}
