"use client";

import { useState } from "react";

export default function CopyLink({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bka-copy">
      {label && <span className="bka-copy-label">{label}</span>}
      <code>{url}</code>
      <button
        type="button"
        className="bka-button-ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            window.prompt("Copy this link", url);
          }
        }}
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
      <a className="bka-link" href={url} target="_blank" rel="noopener noreferrer">
        Open ↗
      </a>
    </div>
  );
}
