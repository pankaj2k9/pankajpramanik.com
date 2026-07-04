"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Floating background-music toggle (bottom-right). Starts paused —
 * browsers block autoplay with sound, and visitors should opt in.
 * Remembers the choice in localStorage and resumes on the next visit
 * after the first interaction anywhere on the page.
 */
export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio("/audio/bg.mp3");
    audio.loop = true;
    audio.volume = 0.35;
    audio.preload = "none";
    audioRef.current = audio;

    // resume on first user gesture if music was on during the last visit
    const resume = () => {
      if (localStorage.getItem("bg-music") === "on") {
        audio.play().then(() => setPlaying(true)).catch(() => {});
      }
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);

    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
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
