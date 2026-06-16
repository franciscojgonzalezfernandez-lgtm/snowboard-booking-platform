import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Home / marketing OG image: the full "The Drop" logo on cream. F-101 generalises
// dynamic OG (per route + localized tagline); F-091 ships the home card.
export const runtime = "nodejs";
export const alt = "The Drop — Private Snowboard Lessons";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(
    join(process.cwd(), "public/brand/logo-full.png"),
  );
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF6F0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={580} height={511} alt="" />
      </div>
    ),
    size,
  );
}
