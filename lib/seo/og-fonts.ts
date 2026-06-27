import { readFile } from "node:fs/promises";

import type { ImageResponse } from "next/og";

// Embedded brand fonts for `next/og` (satori) renders. We ship the TTFs in-repo
// instead of fetching Google Fonts at render time so OG generation never depends
// on the network and the bytes are deterministic. Static instances only —
// satori does not reliably resolve variable-font weights.
//
// `new URL(..., import.meta.url)` makes Next trace these assets into the
// serverless function bundle; a bare `process.cwd()` join would not be traced
// and the files would be missing in production.
const ARCHIVO_BLACK = new URL("./fonts/ArchivoBlack-Regular.ttf", import.meta.url);
const ARCHIVO_MEDIUM = new URL("./fonts/Archivo-Medium.ttf", import.meta.url);

type OgFonts = NonNullable<
  NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]
>;

// Read once per server process. `ImageResponse` is invoked per request/route, so
// caching the buffers avoids re-reading the TTFs on every card render.
let cached: Promise<OgFonts> | undefined;

export function loadOgFonts(): Promise<OgFonts> {
  cached ??= (async () => {
    const [black, medium] = await Promise.all([
      readFile(ARCHIVO_BLACK),
      readFile(ARCHIVO_MEDIUM),
    ]);
    return [
      // Display: title lockup, uppercase. Mirrors `--font-archivo-black`.
      { name: "Archivo Black", data: black, weight: 400, style: "normal" },
      // Body: kicker + supporting text. Mirrors `--font-archivo` at medium.
      { name: "Archivo", data: medium, weight: 500, style: "normal" },
    ] satisfies OgFonts;
  })();
  return cached;
}
