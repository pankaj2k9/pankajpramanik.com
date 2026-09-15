"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactForm({
  initialSubject = "",
}: {
  initialSubject?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // captured on mount — the spam time-trap measures form-open → submit
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, startedAt: startedAt.current }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "sent") {
    return (
      <div className="card p-8 text-center" role="status">
        <p className="text-3xl">✅</p>
        <h3 className="mt-3 font-display text-xl font-semibold">
          Message sent!
        </h3>
        <p className="mt-2 text-muted">
          Thanks for the brief. I’ll review your message and follow up by email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Honeypot — hidden from humans, tempting for bots */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Name <span className="text-pink">*</span>
          </label>
          <input
            id="name"
            autoComplete="name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email <span className="text-pink">*</span>
          </label>
          <input
            id="email"
            autoComplete="email"
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">
          Subject
        </label>
        <input
          id="subject"
          defaultValue={initialSubject}
          name="subject"
          maxLength={150}
          placeholder="Project inquiry, collaboration…"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          Message <span className="text-pink">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder="Tell me about your project…"
          className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink"
        >
          {error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Your details are used to respond to your inquiry.{" "}
        <a href="/privacy-policy" className="underline">
          Privacy policy
        </a>
        .
      </p>
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl bg-accent-strong px-6 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
