"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Floating background-music control (bottom-right).
 *
 * The <audio> element is a module-level singleton: the player component
 * mounts in both the homepage layout and the site layout, and during
 * route transitions two instances can briefly coexist. With a shared
 * element there is only ever ONE playback pipeline, so pause always
 * pauses the sound the visitor hears.
 *
 * Music is opt-in and downloaded only when the visitor presses play.
 *
 * Pause and mute are separate on purpose. Pausing stops the track and
 * remembers the position; muting silences it while it keeps running, which is
 * what someone wants when a call starts.
 */

const TRACK = { title: "Ambient", subtitle: "background loop" };

const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;

/** Web Audio graph, built lazily and only once. */
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let graphFailed = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio("/audio/bg.mp3");
    audio.loop = true;
    const savedVolume = Number(localStorage.getItem("bg-music-vol"));
    audio.volume = savedVolume > 0 && savedVolume <= 1 ? savedVolume : 0.35;
    audio.preload = "none";
    audio.muted = localStorage.getItem("bg-music-muted") === "yes";
    for (const ev of ["play", "pause", "volumechange"] as const) {
      audio.addEventListener(ev, () => listeners.forEach((l) => l()));
    }
    // resume where the visitor left off on the previous visit
    const saved = Number(localStorage.getItem("bg-music-pos"));
    if (saved > 0) {
      audio.addEventListener(
        "loadedmetadata",
        () => {
          if (audio && saved < audio.duration) audio.currentTime = saved;
        },
        { once: true },
      );
    }
    // persist position so a reload resumes instead of restarting
    audio.addEventListener("timeupdate", () => {
      if (audio)
        localStorage.setItem("bg-music-pos", String(audio.currentTime));
    });
  }
  return audio;
}

/**
 * Attach an analyser so the meter reflects the actual track rather than a
 * fixed CSS loop.
 *
 * `createMediaElementSource` can only be called once per element and it
 * re-routes the audio through the graph, so it must connect on to the
 * destination or playback goes silent. If anything here throws — an older
 * browser, a locked-down context — we give up permanently and the CSS
 * equalizer takes over.
 */
function getAnalyser(): AnalyserNode | null {
  // Only ever built from the play click (see toggle): a context created
  // outside a user gesture starts suspended, and Safari/iOS then route the
  // element into a silent graph — the track "plays" but nothing is heard.
  if (analyser || graphFailed) return analyser;
  try {
    const el = getAudio();
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) throw new Error("no AudioContext");

    audioCtx = new Ctor();
    // resume() settles asynchronously; re-render so the meter attaches once
    // the context is actually running.
    audioCtx.addEventListener("statechange", () =>
      listeners.forEach((l) => l()),
    );
    const source = audioCtx.createMediaElementSource(el);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    return analyser;
  } catch {
    graphFailed = true;
    analyser = null;
    audioCtx = null;
    return null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function readState() {
  const el = audio;
  return `${!!el && !el.paused}|${!!el && el.muted}|${audioCtx?.state === "running"}`;
}

/**
 * `expandable` (homepage) reveals a volume slider while the loop plays.
 */
export default function MusicPlayer({
  expandable = false,
}: {
  expandable?: boolean;
}) {
  const state = useSyncExternalStore(
    subscribe,
    readState,
    () => "false|false|false",
  );
  const [playing, muted, graphRunning] = state
    .split("|")
    .map((v) => v === "true");
  const barsRef = useRef<HTMLDivElement>(null);

  // Audio starts only from the explicit play button.

  // Drive the meter from real audio levels while playing.
  //
  // No React state here: the bars are written to directly. An inline `height`
  // and `animation: none` override the CSS equalizer classes, and clearing both
  // on cleanup hands playback back to the fallback loop.
  useEffect(() => {
    if (!playing || muted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The graph is built in toggle(); never create it here, outside a gesture.
    const node = analyser;
    const bars = barsRef.current;
    if (!node || !bars || audioCtx?.state !== "running") return;

    const spectrum = new Uint8Array(node.frequencyBinCount);
    const children = Array.from(bars.children) as HTMLElement[];
    let frame = 0;

    const tick = () => {
      // `as never` only satisfies the DOM lib's ArrayBuffer generic; at
      // runtime this is a plain Uint8Array.
      node.getByteFrequencyData(spectrum as never);
      for (let i = 0; i < children.length; i++) {
        // Low bins carry the body of an ambient track, so spread the taps out
        // rather than letting all four bars read the same frequency.
        const v = spectrum[i * 2 + 1] ?? 0;
        children[i].style.animation = "none";
        children[i].style.height = `${Math.max(22, (v / 255) * 100)}%`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      for (const c of children) {
        c.style.height = "";
        c.style.animation = "";
      }
    };
  }, [playing, muted, graphRunning]);

  function toggle() {
    const el = getAudio();
    if (!el.paused) {
      el.pause();
      localStorage.setItem("bg-music", "off");
      return;
    }
    localStorage.setItem("bg-music", "on");
    // Pressing play means "I want to hear it": a mute left over from an
    // earlier visit would otherwise make the button look broken.
    if (el.muted) {
      el.muted = false;
      localStorage.setItem("bg-music-muted", "no");
    }
    // Everything below runs synchronously inside the click, so the browser
    // counts it as user-initiated. The analyser is skipped for reduced motion
    // (the meter is not animated then), keeping playback on the plain path.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      getAnalyser();
      if (audioCtx && audioCtx.state !== "running") {
        audioCtx.resume().catch(() => {});
      }
    }
    el.play().catch((error: unknown) => {
      // The player stays in its paused state; the reason goes to the console.
      console.warn("Background music could not start:", error);
    });
  }

  function toggleMute() {
    const el = getAudio();
    el.muted = !el.muted;
    localStorage.setItem("bg-music-muted", el.muted ? "yes" : "no");
  }

  return (
    <div
      data-playing={playing || undefined}
      className="music-pill fixed bottom-5 left-5 z-50 flex items-center gap-1 rounded-full border border-border-strong bg-surface/95 p-1 shadow-lg shadow-accent-strong/10 backdrop-blur
                 supports-[backdrop-filter]:bg-surface/80"
    >
      <button
        type="button"
        onClick={toggle}
        data-cursor={playing ? "Pause" : "Play"}
        aria-label={
          playing ? "Pause background music" : "Play background music"
        }
        aria-pressed={playing}
        title={playing ? "Pause music" : "Play music"}
        className="flex h-10 w-10 items-center justify-center rounded-full text-accent transition hover:bg-accent-strong hover:text-white"
      >
        {playing ? (
          <div
            ref={barsRef}
            className="flex h-4 items-end gap-[3px]"
            aria-hidden
          >
            {/* The CSS loop is the baseline; the analyser overrides it inline
                when Web Audio is available. */}
            {[0, 0.25, 0.5, 0.75].map((delay) => (
              <span
                key={delay}
                style={{ animationDelay: `${delay}s` }}
                className="h-[30%] w-[3px] animate-[eq_1s_ease-in-out_infinite] rounded-full bg-accent transition-[height] duration-75"
              />
            ))}
          </div>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )}
      </button>

      {/* Title is decoration for a control that is already labelled, so it is
          hidden from assistive tech and from narrow screens. */}
      <span className="hidden pr-1 leading-tight sm:block" aria-hidden>
        <span className="block font-mono text-[11px] font-semibold tracking-wide text-foreground">
          {TRACK.title}
        </span>
        <span className="block font-mono text-[10px] text-faint">
          {TRACK.subtitle}
        </span>
      </span>

      {expandable && playing && (
        <label className="music-volume">
          <span className="sr-only">Background music volume</span>
          <input
            type="range"
            min={0}
            max={100}
            ref={(el) => {
              if (el && audio)
                el.value = String(Math.round(audio.volume * 100));
            }}
            onInput={(event) => {
              const el = getAudio();
              el.volume = Number(event.currentTarget.value) / 100;
              localStorage.setItem("bg-music-vol", String(el.volume));
            }}
          />
        </label>
      )}

      <button
        type="button"
        onClick={toggleMute}
        data-cursor={muted ? "Unmute" : "Mute"}
        aria-label={muted ? "Unmute background music" : "Mute background music"}
        aria-pressed={muted}
        title={muted ? "Unmute" : "Mute"}
        className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition hover:bg-surface-raised hover:text-foreground"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M11 5 6 9H2v6h4l5 4z" />
          {muted ? (
            <path d="m22 9-6 6M16 9l6 6" />
          ) : (
            <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
          )}
        </svg>
      </button>
    </div>
  );
}
