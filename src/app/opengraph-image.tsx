import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #e3ecf8 0%, #c7d7ec 100%)",
        color: "#233b58",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 28,
          color: "#976554",
        }}
      >
        DATA → INTELLIGENCE → AUTOMATION
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
          color: "#526e91",
        }}
      >
        {site.headline}
      </div>
      <div style={{ marginTop: 48, fontSize: 26, color: "#516780" }}>
        pankajpramanik.com
      </div>
    </div>,
    { ...size },
  );
}
