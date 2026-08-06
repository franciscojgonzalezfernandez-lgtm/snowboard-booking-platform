#!/usr/bin/env node
// F-131 — pre-generates the `/_next/image` variants of above-the-fold images so
// the first real visitor after a deploy doesn't pay for the optimizer.
//
// Why this exists: the optimizer caches per (src, width, quality, format), and
// a deploy invalidates all of it. Measured on prod before this script, the home
// hero answered `x-vercel-cache: MISS` on exactly the widths phones ask for
// (640/750/1080) while the desktop width sat HIT — the site simply doesn't get
// enough mobile traffic to keep them warm on its own. A cold variant is worth
// ~1.9s of mobile LCP in Lighthouse's cold run.
//
// `minimumCacheTTL` (F-124) keeps a variant warm for a year *once it exists*;
// it cannot help the request that creates it. This does.
//
// Usage: node scripts/warm-image-cache.mjs https://rideflumserberg.ch

// Keep in sync with `images.deviceSizes` in next.config.ts.
const DEVICE_SIZES = [640, 828, 1080, 1200, 1920];

// Above-the-fold images worth warming. Add sparingly — each entry costs
// widths × formats requests per deploy.
const CRITICAL_IMAGES = [
  { label: "home hero", src: "/brand/hero.jpg" },
  { label: "about hero", src: "/brand/about.jpg" },
];

// One pass per format: content negotiation means AVIF and WebP are separate
// cache entries, and a visitor on either gets a cold miss otherwise.
const ACCEPTS = [
  { label: "avif", header: "image/avif,image/webp,*/*" },
  { label: "webp", header: "image/webp,*/*" },
];

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error("usage: node scripts/warm-image-cache.mjs <base-url>");
  process.exit(1);
}

let warmed = 0;
let failed = 0;

for (const { label, src } of CRITICAL_IMAGES) {
  for (const width of DEVICE_SIZES) {
    for (const accept of ACCEPTS) {
      const url = `${baseUrl}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
      try {
        const res = await fetch(url, { headers: { Accept: accept.header } });
        const cache = res.headers.get("x-vercel-cache") ?? "n/a";
        if (!res.ok) {
          console.error(`  ✗ ${label} w=${width} ${accept.label}: HTTP ${res.status}`);
          failed++;
          continue;
        }
        // Body must be drained or the connection may be reused before the
        // upstream finishes generating the variant.
        const bytes = (await res.arrayBuffer()).byteLength;
        console.log(
          `  ✓ ${label} w=${width} ${accept.label}: ${Math.round(bytes / 1024)} KB (${cache})`,
        );
        warmed++;
      } catch (error) {
        console.error(`  ✗ ${label} w=${width} ${accept.label}: ${error.message}`);
        failed++;
      }
    }
  }
}

console.log(`warmed ${warmed} variants, ${failed} failed`);

// Never fail the deploy pipeline over this — a cold variant is slow, not broken.
process.exit(0);
