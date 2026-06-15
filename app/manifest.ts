import type { MetadataRoute } from "next";

// PWA web manifest. Served at /manifest.webmanifest; Next auto-injects the
// <link rel="manifest">. Icons live in public/ because Next only auto-serves
// app/icon* (not hyphenated names like icon-192). theme/background = charcoal,
// the dark-alpine base (F-089 tokens). Brand: "the drop" (F-088/F-105).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "the drop — private snowboard lessons",
    short_name: "the drop",
    description: "Private snowboard lessons. Flumserberg & beyond.",
    start_url: "/",
    display: "standalone",
    background_color: "#201E1B",
    theme_color: "#201E1B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
