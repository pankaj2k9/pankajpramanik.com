import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const runtime = "edge";
export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #07080f 0%, #131627 100%)",
          color: "#e6e8f2",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: "#10b981",
          }}
        >
          ● Available for new projects
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-2px",
            lineHeight: 1.1,
          }}
        >
          {site.name}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 36,
            background: "linear-gradient(90deg, #818cf8, #a78bfa, #f472b6)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {site.headline}
        </div>
        <div style={{ marginTop: 48, fontSize: 26, color: "#9aa1c0" }}>
          pankajpramanik.com
        </div>
      </div>
    ),
    { ...size }
  );
}
