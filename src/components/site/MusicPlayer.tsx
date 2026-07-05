"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Floating background-music toggle (bottom-right).
 *
 * The <audio> element is a module-level singleton: the player component
 * mounts in both the homepage layout and the site layout, and during
 * route transitions two instances can briefly coexist. With a shared
 * element there is only ever ONE playback pipeline, so pause always
 * pauses the sound the visitor hears.
 *
 * Music is on by default (like the original WordPress site). Browsers
 * block unmuted autoplay, so playback starts on the first interaction;
 * an explicit pause is remembered in localStorage.
 */

const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio("/audio/bg.mp3");
    audio.loop = true;
    audio.volume = 0.35;
    audio.preload = "auto";
    for (const ev of ["play", "pause"] as const) {
      audio.addEventListener(ev, () => listeners.forEach((l) => l()));
    }
  }
  return audio;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function isPlaying() {
  return !!audio && !audio.paused;
}

export default function MusicPlayer() {
  const playing = useSyncExternalStore(subscribe, isPlaying, () => false);

  // autoplay attempt + first-gesture fallback (once per page load)
  useEffect(() => {
    const el = getAudio();
    if (localStorage.getItem("bg-music") === "off") return;
    if (!el.paused) return;

    el.play().catch(() => {
      const start = () => {
        if (localStorage.getItem("bg-music") !== "off" && el.paused) {
          el.play().catch(() => {});
        }
        cleanup();
      };
      const cleanup = () => {
        window.removeEventListener("pointerdown", start, true);
        window.removeEventListener("keydown", start, true);
      };
      // capture phase so a click on the pause button itself still counts
      window.addEventListener("pointerdown", start, true);
      window.addEventListener("keydown", start, true);
      return cleanup;
    });
  }, []);

  function toggle() {
    const el = getAudio();
    if (!el.paused) {
      el.pause();
      localStorage.setItem("bg-music", "off");
    } else {
      localStorage.setItem("bg-music", "on");
      el.play().catch(() => {});
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? "Pause background music" : "Play background music"}
      aria-pressed={playing}
      title={playing ? "Pause music" : "Play music"}
      className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface/90 shadow-lg backdrop-blur transition hover:border-accent hover:text-accent"
    >
      {playing ? (
        <span className="flex h-4 items-end gap-[3px]" aria-hidden>
          <span className="w-[3px] animate-[eq_1s_ease-in-out_infinite] rounded-full bg-accent" />
          <span className="w-[3px] animate-[eq_1s_ease-in-out_0.25s_infinite] rounded-full bg-accent" />
          <span className="w-[3px] animate-[eq_1s_ease-in-out_0.5s_infinite] rounded-full bg-accent" />
          <span className="w-[3px] animate-[eq_1s_ease-in-out_0.75s_infinite] rounded-full bg-accent" />
        </span>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      )}
    </button>
  );
}
