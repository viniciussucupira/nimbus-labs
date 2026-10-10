/**
 * Music and podcasts played on the store page (lib/audio-embed.ts; added 9
 * October 2026). Checked: only the four services' own addresses, in the
 * shapes their players take, become a player — anything else plays nothing —
 * and the player's address is built here, never taken from what was typed.
 */
import { AUDIO_FRAME_ORIGINS, audioEmbedUrl, audioHeight, readAudio } from "@/lib/audio-embed";
import { parseStoreLinks, playsOnPage } from "@/lib/store-link";
import { done, is, part } from "./check";

function main(): void {
  part("Spotify");
  const track = readAudio("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc");
  is("a song, with the short player", [track, track && audioEmbedUrl(track), track && audioHeight(track)], [
    { provider: "spotify", path: "track/4uLU6hMCjMI75M1A2tKUQC", single: true },
    "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?autoplay=1",
    152,
  ]);
  is("a playlist in another country's address, with the tall one", [readAudio("open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M")?.path, audioHeight(readAudio("open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M")!)], ["playlist/37i9dQZF1DXcBWIGoYBM5M", 352]);
  is("a podcast episode", readAudio("https://open.spotify.com/episode/0Q86acNRm6V9GYx55SXKwf")?.single, true);
  is("not a profile, a short id or another host", [readAudio("https://open.spotify.com/user/abc"), readAudio("https://open.spotify.com/track/short"), readAudio("https://spotify.evil.com/track/4uLU6hMCjMI75M1A2tKUQC")], [null, null, null]);

  part("SoundCloud");
  const sc = readAudio("https://soundcloud.com/Artist-Name/a-track");
  is("a track, by its own address", [sc?.path, sc && audioEmbedUrl(sc)], ["artist-name/a-track", "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist-name%2Fa-track&auto_play=true&visual=false&show_comments=false&show_reposts=false"]);
  is("a set, with the tall player", [readAudio("soundcloud.com/artist/sets/an-album")?.single, audioHeight(readAudio("soundcloud.com/artist/sets/an-album")!)], [false, 450]);
  is("not a profile, a page of it, or a short link", [readAudio("https://soundcloud.com/artist"), readAudio("https://soundcloud.com/artist/tracks"), readAudio("https://on.soundcloud.com/abc123")], [null, null, null]);

  part("Apple Music and Apple Podcasts");
  const song = readAudio("https://music.apple.com/us/album/an-album/1440857781?i=1440857789");
  is("a song in an album", [song && audioEmbedUrl(song), song?.single], ["https://embed.music.apple.com/us/album/an-album/1440857781?i=1440857789", true]);
  is("a playlist", readAudio("https://music.apple.com/us/playlist/a-list/pl.f4d106fed2bd41149aaacabb233eb5eb")?.provider, "applemusic");
  const show = readAudio("https://podcasts.apple.com/gb/podcast/a-show/id1200361736");
  is("a podcast, and one of its episodes", [show && audioEmbedUrl(show), show?.single, readAudio("https://podcasts.apple.com/gb/podcast/a-show/id1200361736?i=1000650000000")?.single], ["https://embed.podcasts.apple.com/gb/podcast/a-show/id1200361736", false, true]);
  is("not an artist page, nor plain http", [readAudio("https://music.apple.com/us/artist/someone/123"), readAudio("http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")], [null, null]);

  part("On a store's links");
  is("music plays on the page like a video does", [playsOnPage("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3"), playsOnPage("https://youtu.be/dQw4w9WgXcQ"), playsOnPage("https://example.com/song")], [true, true, false]);
  is("a kept link keeps playing only when it can", parseStoreLinks([
    { id: "a", title: "My album", url: "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3", addedAt: "", play: true },
    { id: "b", title: "My blog", url: "https://example.com", addedAt: "", play: true },
  ]).map((link) => link.play ?? false), [true, false]);
  is("and the page lets in those four players' frames only", AUDIO_FRAME_ORIGINS, ["https://open.spotify.com", "https://w.soundcloud.com", "https://embed.music.apple.com", "https://embed.podcasts.apple.com"]);
  done();
}

main();
