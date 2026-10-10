/**
 * Music and podcasts played on the store page itself (added 9 October 2026):
 * a link to a song, an album, a playlist, a show or an episode on Spotify,
 * SoundCloud, Apple Music or Apple Podcasts can be played where it is, the
 * way Linktree's music links are, instead of sending the visitor away.
 *
 * Read the way videos are (lib/sales-page.ts, readVideo): from the address
 * the creator pasted, only on each service's own host and only in the shapes
 * its player takes, and turned into that player's own address here — never
 * a frame from anywhere the creator typed. Nothing loads until the visitor
 * presses play (components/audio-embed.tsx), so a visitor who does not is
 * never seen by the service. Browser-safe.
 */

export type AudioProvider = "spotify" | "soundcloud" | "applemusic" | "applepodcasts";

export type Audio = {
  provider: AudioProvider;
  /** The player's path, built from the address: "track/<id>", "artist/song", "us/album/name/123". */
  path: string;
  /** One song or episode, which gets the short player; anything longer gets the tall one. */
  single: boolean;
};

export const AUDIO_NAMES: Record<AudioProvider, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  applemusic: "Apple Music",
  applepodcasts: "Apple Podcasts",
};

/** The frame origins the page policy lets in (lib/csp.ts), and nothing else. */
export const AUDIO_FRAME_ORIGINS = ["https://open.spotify.com", "https://w.soundcloud.com", "https://embed.music.apple.com", "https://embed.podcasts.apple.com"];

const SPOTIFY_KINDS = new Set(["track", "album", "playlist", "episode", "show", "artist"]);
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SLUG = /^[A-Za-z0-9_-]{1,100}$/;
const COUNTRY = /^[a-z]{2}$/;
const APPLE_ID = /^(?:id)?\d{1,15}$/;
const APPLE_SLUG = /^[A-Za-z0-9%._-]{1,200}$/;
const EPISODE = /^\d{1,20}$/;

/** A song, album, playlist, show or episode on one of the four, from the address as it was pasted; null when it is not one. */
export function readAudio(raw: string): Audio | null {
  const text = (raw ?? "").trim().slice(0, 500);
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "open.spotify.com") {
    // open.spotify.com/track/<id>, open.spotify.com/intl-de/album/<id>, open.spotify.com/embed/show/<id>
    const at = parts.findIndex((part) => SPOTIFY_KINDS.has(part));
    const kind = at >= 0 ? parts[at] : "";
    const id = at >= 0 ? parts[at + 1] ?? "" : "";
    if (!kind || !SPOTIFY_ID.test(id)) return null;
    return { provider: "spotify", path: `${kind}/${id}`, single: kind === "track" || kind === "episode" };
  }
  if (host === "soundcloud.com") {
    // soundcloud.com/<artist>/<track> or soundcloud.com/<artist>/sets/<set>; no short links, no profiles.
    const set = parts.length === 3 && parts[1] === "sets";
    if (!(parts.length === 2 || set) || !parts.every((part) => SLUG.test(part))) return null;
    if (["you", "discover", "stream", "search", "upload", "settings"].includes(parts[0]) || ["tracks", "albums", "reposts", "likes", "followers", "following", "popular-tracks"].includes(parts[1])) return null;
    return { provider: "soundcloud", path: parts.join("/").toLowerCase(), single: !set };
  }
  if (host === "music.apple.com" || host === "podcasts.apple.com") {
    // music.apple.com/us/album/<name>/<id>?i=<song>, music.apple.com/us/playlist/<name>/pl.<id>,
    // podcasts.apple.com/us/podcast/<name>/id<id>?i=<episode>
    const music = host === "music.apple.com";
    const kinds = music ? ["album", "playlist", "song"] : ["podcast"];
    const [country, kind, name, id] = parts;
    const idOk = kind === "playlist" ? /^pl\.[A-Za-z0-9-]{1,80}$/.test(id ?? "") : APPLE_ID.test(id ?? "");
    if (parts.length !== 4 || !COUNTRY.test(country ?? "") || !kinds.includes(kind ?? "") || !APPLE_SLUG.test(name ?? "") || !idOk) return null;
    const episode = url.searchParams.get("i") ?? "";
    const one = EPISODE.test(episode);
    return {
      provider: music ? "applemusic" : "applepodcasts",
      path: `${parts.join("/")}${one ? `?i=${episode}` : ""}`,
      single: one || kind === "song",
    };
  }
  return null;
}

/** The player's own address for it. */
export function audioEmbedUrl(audio: Audio): string {
  if (audio.provider === "spotify") return `https://open.spotify.com/embed/${audio.path}?autoplay=1`;
  if (audio.provider === "soundcloud") {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com/${audio.path}`)}&auto_play=true&visual=false&show_comments=false&show_reposts=false`;
  }
  if (audio.provider === "applemusic") return `https://embed.music.apple.com/${audio.path}`;
  return `https://embed.podcasts.apple.com/${audio.path}`;
}

/** How tall each player is drawn, in pixels, as each service's own embed code sets it. */
export function audioHeight(audio: Audio): number {
  if (audio.provider === "spotify") return audio.single ? 152 : 352;
  if (audio.provider === "soundcloud") return audio.single ? 166 : 450;
  return audio.single ? 175 : 450;
}
