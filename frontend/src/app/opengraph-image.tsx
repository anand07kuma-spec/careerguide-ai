import { ImageResponse } from "next/og";

import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * The site's OpenGraph card image: `/opengraph-image`.
 *
 * It is a real image rather than a static file because there is nothing to
 * hand-draw and keep in sync — the copy on it is the copy in the metadata, so
 * both are generated from `SITE_NAME` and `DEFAULT_DESCRIPTION` and a change to
 * one cannot leave the other behind.
 *
 * Two rules hold it to what the project is allowed to claim:
 *
 * * The text is English-only. The card is shown to someone on WhatsApp or
 *   Twitter who has not chosen an interface language, and a Devanagari string
 *   here would need a bundled font file for `ImageResponse` — an asset that can
 *   silently render as empty boxes on a deployment.
 * * The line at the bottom is the app's own disclaimer. A share card is the one
 *   surface where a stranger forms an expectation of this product in half a
 *   second, so the expectation set there is "a guide, not a test and not a
 *   prediction" — the same sentence the landing page uses.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME}: a voice and chat career guide for Indian students from class 6 to 12, in Hindi, English or Hinglish.`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0b1730 0%, #12294f 55%, #1b3b6b 100%)",
          color: "#f2f6ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 46,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              background: "#5b8cff",
              color: "#0b1730",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: 0.5 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.12 }}>
            Explore careers, one conversation at a time
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.4, color: "#b9c9e8", maxWidth: 1000 }}>
            {DEFAULT_DESCRIPTION}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 24, color: "#8fb0ff", fontWeight: 600 }}>
            <span>Hindi</span>
            <span>·</span>
            <span>English</span>
            <span>·</span>
            <span>Hinglish</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 32,
            borderTop: "2px solid rgba(185, 201, 232, 0.35)",
            paddingTop: 22,
            fontSize: 21,
            color: "#93a8cc",
          }}
        >
          <span>Class 6 to 12, and the parents who help</span>
          <span>Not an aptitude test. It does not predict a future.</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
