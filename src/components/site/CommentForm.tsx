"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent";

export default function CommentForm({ postId }: { postId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // spam time-trap: measures form-open → submit
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
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, postId, startedAt: startedAt.current }),
      });
      const json = await res.json().catch(() => ({}));
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
      <div className="card p-6" role="status">
        <p className="font-semibold">Thanks for your comment!</p>
        <p className="mt-1 text-sm text-muted">
          It will appear here once it has been reviewed.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-3 text-sm text-accent hover:underline"
        >
          Write another comment
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="comment-website">Website</label>
        <input id="comment-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="comment-name" className="mb-1.5 block text-sm font-medium">
            Name <span className="text-pink">*</span>
          </label>
          <input id="comment-name" name="name" required minLength={2} maxLength={80} autoComplete="name" className={inputCls} />
        </div>
        <div>
          <label htmlFor="comment-email" className="mb-1.5 block text-sm font-medium">
            Email <span className="text-pink">*</span>{" "}
            <span className="font-normal text-faint">(never published)</span>
          </label>
          <input id="comment-email" name="email" type="email" required maxLength={200} autoComplete="email" className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="comment-body" className="mb-1.5 block text-sm font-medium">
          Comment <span className="text-pink">*</span>
        </label>
        <textarea id="comment-body" name="body" required minLength={3} maxLength={3000} rows={5} className={`${inputCls} resize-y`} />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Comments are moderated.{" "}
          <a href="/privacy-policy" className="underline">Privacy policy</a>.
        </p>
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-xl bg-accent-strong px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {status === "sending" ? "Posting…" : "Post comment"}
        </button>
      </div>
    </form>
  );
}
