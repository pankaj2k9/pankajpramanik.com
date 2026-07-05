"use client";

import { useState } from "react";
import { inputCls, labelCls } from "./ui";

/** Cover image URL input with live preview. */
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

  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}{" "}
        <span className="text-faint">
          (/uploads/… or https://…)
        </span>
      </label>
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
