"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Floating background-music toggle (bottom-right). Music is ON by
 * default (looping), like the original WordPress site — visitors click
 * to pause. Browsers block unmuted autoplay, so we try immediately and
 * fall back to starting on the first interaction anywhere on the page.
 * An explicit pause is remembered in localStorage and respected on
 * later visits.
 */
export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio("/audio/bg.mp3");
    audio.loop = true;
    audio.volume = 0.35;
    audio.preload = "auto";
    audioRef.current = audio;

    const wantsMusic = localStorage.getItem("bg-music") !== "off";

    const start = () => {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    };

    const startOnGesture = () => {
      if (localStorage.getItem("bg-music") !== "off" && audio.paused) start();
      cleanupGesture();
    };
    const cleanupGesture = () => {
      window.removeEventListener("pointerdown", startOnGesture);
      window.removeEventListener("keydown", startOnGesture);
      window.removeEventListener("scroll", startOnGesture);
    };

    if (wantsMusic) {
      // attempt real autoplay; if the browser blocks it, wait for the
      // first gesture (click, key, or scroll) and start then
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          window.addEventListener("pointerdown", startOnGesture);
          window.addEventListener("keydown", startOnGesture);
          window.addEventListener("scroll", startOnGesture, { passive: true });
        });
    }

    return () => {
      cleanupGesture();
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      localStorage.setItem("bg-music", "off");
    } else {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          localStorage.setItem("bg-music", "on");
        })
        .catch(() => {});
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
        // animated equalizer bars
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
