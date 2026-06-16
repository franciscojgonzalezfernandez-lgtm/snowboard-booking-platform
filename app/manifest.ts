import type { MetadataRoute } from "next";

// PWA manifest for "The Drop". Cream theme; snowflake-free peak mark icons live in
// public/ (generated in F-091). Next auto-links this at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Drop — Private Snowboard Lessons",
    short_name: "The Drop",
    description:
      "Private snowboard lessons in Flumserberg and northern Switzerland.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF6F0",
    theme_color: "#FAF6F0",
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
