import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import path from "node:path";
import { site } from "@/lib/site";
import { resolveUpload } from "@/lib/storage";

/**
 * Link-preview image (1200x630) for WhatsApp, LinkedIn, Facebook, X and
 * Slack. pageMetadata points every page here, so each shared link shows its
 * own title on a branded card instead of one generic picture.
 *
 *   /og?title=…&section=Service&cover=/uploads/…jpg
 *
 * `cover` is optional and only used for JPEG/PNG uploads (the formats the
 * renderer reads); other formats fall back to the text-only card.
 */
const SIZE = { width: 1200, height: 630 };
const COVER_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/** Reads an upload as a data URL, or null when it is missing or unsupported. */
async function readUpload(url: string | null): Promise<string | null> {
  if (!url?.startsWith("/uploads/")) return null;
  const type = COVER_TYPES[path.extname(url).toLowerCase()];
  const file = type && resolveUpload(url.slice("/uploads/".length).split("/"));
  if (!file) return null;
  try {
    return `data:${type};base64,${(await fs.readFile(file)).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Shrinks long titles so they fit in three lines. */
function titleSize(title: string, narrow: boolean) {
  const n = title.length * (narrow ? 1.5 : 1);
  return n <= 34 ? 76 : n <= 56 ? 64 : n <= 80 ? 54 : 46;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = (params.get("title") || site.title).slice(0, 120);
  const section = (params.get("section") || "").slice(0, 40);
  const [cover, portrait] = await Promise.all([
    readUpload(params.get("cover")),
    readUpload(site.photo),
  ]);
  const domain = site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(135deg, #0b1324 0%, #15213b 55%, #22213f 100%)",
        color: "#f4f6fb",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not HTML
            <img
              src={portrait}
              alt=""
              width={72}
              height={72}
              style={{ borderRadius: 36, border: "3px solid #f0452e", objectFit: "cover" }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{site.name}</div>
            <div style={{ fontSize: 22, color: "#9fb0cc" }}>AI &amp; Data Engineer</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {section && (
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "#ff7a5c",
              }}
            >
              {section}
            </div>
          )}
          <div
            style={{
              display: "block",
              fontSize: titleSize(title, Boolean(cover)),
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: -1,
              lineClamp: 3,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 24 }}>
          <div style={{ display: "flex", width: 44, height: 6, borderRadius: 3, background: "#f0452e" }} />
          <div style={{ color: "#c9d3e6" }}>{domain}</div>
          <div style={{ color: "#6f81a3" }}>Data · AI · Automation</div>
        </div>
      </div>

      {cover && (
        <div style={{ display: "flex", width: 430, height: "100%", padding: "48px 48px 48px 0" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not HTML */}
          <img
            src={cover}
            alt=""
            width={382}
            height={534}
            style={{ borderRadius: 28, objectFit: "cover" }}
          />
        </div>
      )}
    </div>,
    {
      ...SIZE,
      // Social crawlers fetch this once per share; the content only changes on deploy.
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    },
  );
}
