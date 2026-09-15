"use client";

import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/** Share bar for a blog post: social networks, email, copy link, native share. */
export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const targets = [
    { label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, icon: "M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.8-6.3L6.4 22H3.3l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: "M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z" },
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, icon: "M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.8.4 3.5 3.5 0 0 0-1.1 2.6 6 6 0 0 0 1.3 3.2 13.8 13.8 0 0 0 5.3 4.7c2 .8 2.7.9 3.7.8.6-.1 1.8-.8 2.1-1.5s.3-1.3.2-1.5-.3-.2-.6-.3ZM12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.6A11.8 11.8 0 0 0 24 12.2a11.7 11.7 0 0 0-3.6-8.6Z" },
    { label: "Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}`, icon: "M24 11.8a2.6 2.6 0 0 0-4.4-1.9 12.8 12.8 0 0 0-7-2.2l1.2-5.6 3.9.8a1.9 1.9 0 1 0 .2-1l-4.4-.9a.5.5 0 0 0-.6.4l-1.3 6.3a12.8 12.8 0 0 0-7.1 2.2 2.6 2.6 0 1 0-2.9 4.3 5 5 0 0 0 0 .8c0 4 4.7 7.3 10.5 7.3s10.5-3.3 10.5-7.3a5 5 0 0 0 0-.8 2.6 2.6 0 0 0 1.4-2.4ZM6 13.7a1.9 1.9 0 1 1 1.9 1.9A1.9 1.9 0 0 1 6 13.7Zm10.5 5c-1.3 1.3-3.7 1.4-4.5 1.4s-3.2-.1-4.5-1.4a.5.5 0 0 1 .7-.7c.8.8 2.6 1.1 3.8 1.1s3-.3 3.8-1.1a.5.5 0 0 1 .7.7Zm-.4-3.1a1.9 1.9 0 1 1 1.9-1.9 1.9 1.9 0 0 1-1.9 1.9Z" },
    { label: "Email", href: `mailto:?subject=${t}&body=${u}`, icon: "M2 5h20v14H2V5Zm2 2v.5l8 5 8-5V7H4Zm16 2.8-8 5-8-5V17h16V9.8Z" },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  const btn =
    "flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:border-accent hover:text-accent";

  return (
    <section aria-label="Share this post" className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-8">
      <span className="eyebrow mr-1 text-muted">Share</span>
      {targets.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target={s.label === "Email" ? undefined : "_blank"}
          rel="noopener noreferrer"
          aria-label={`Share on ${s.label}`}
          title={`Share on ${s.label}`}
          className={btn}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
            <path d={s.icon} />
          </svg>
        </a>
      ))}
      <button type="button" onClick={copy} className={`${btn} w-auto px-4 text-sm`} aria-live="polite">
        {copied ? "Link copied ✓" : "Copy link"}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title, url }).catch(() => {})}
          className={`${btn} w-auto px-4 text-sm`}
        >
          More…
        </button>
      )}
    </section>
  );
}
