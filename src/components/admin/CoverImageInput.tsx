"use client";

import { useRef, useState } from "react";
import { inputCls, labelCls } from "./ui";
import { UPLOAD_ACCEPT, uploadMedia } from "./upload";

/** Cover image URL input with upload and live preview. */
export default function CoverImageInput({
  name = "coverImage",
  defaultValue = "",
  label = "Cover image URL",
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [broken, setBroken] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setUrl(await uploadMedia(file));
      setBroken(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}{" "}
        <span className="text-faint">
          (upload, /uploads/… or https://…)
        </span>
      </label>
      <div className="flex gap-2">
        <input
          id={name}
          name={name}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setBroken(false);
          }}
          className={inputCls}
          placeholder="/uploads/2026/06/cover.jpg"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="shrink-0 rounded-xl border border-border px-4 text-sm font-medium transition hover:border-accent disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-2 text-xs text-pink">{error}</p>}
      {url && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Cover preview"
          onError={() => setBroken(true)}
          className="mt-3 max-h-44 rounded-xl border border-border object-cover"
        />
      )}
      {url && broken && (
        <p className="mt-2 text-xs text-pink">Image failed to load — check the URL.</p>
      )}
    </div>
  );
}
