"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { AUDIO_NAMES, type Audio, audioEmbedUrl, audioHeight } from "@/lib/audio-embed";
import { blockWords } from "@/lib/buyer-words/blocks";

/**
 * Music or a podcast that loads nothing until it is asked to
 * (lib/audio-embed.ts): a bar with a play button in the store's colors, and
 * only when the visitor presses it the service's own player in its place,
 * the height that service draws it.
 */
export function AudioEmbed({ audio, title, lang = "en" }: { audio: Audio; title: string; lang?: string }) {
  const words = blockWords(lang);
  const [playing, setPlaying] = useState(false);
  const provider = AUDIO_NAMES[audio.provider];
  if (playing) {
    return (
      <iframe
        src={audioEmbedUrl(audio)}
        title={words.audioFrame(title, provider)}
        height={audioHeight(audio)}
        className="st-audio-frame"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    );
  }
  return (
    <button type="button" className="st-audio-play" onClick={() => setPlaying(true)} aria-label={words.audioPlayLabel(title, provider)}>
      <span className="st-audio-disc" aria-hidden="true">
        <Icon name="play" size={20} strokeWidth={2} />
      </span>
      <span className="st-muted text-sm font-semibold">{words.videoPlay(provider)}</span>
    </button>
  );
}
