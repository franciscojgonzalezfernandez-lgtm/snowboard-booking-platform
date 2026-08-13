import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // F-124: without this the optimizer inherits the `max-age=0,
    // must-revalidate` that Next serves `public/` assets with, so every
    // `/_next/image` response — including the home hero, the LCP element — came
    // back `x-vercel-cache: MISS` and was re-downloaded by every visitor. A year
    // is safe: the query string carries width + quality, and the underlying
    // files are versioned by deployment.
    minimumCacheTTL: 31536000,
    // F-131: CLAUDE.md's perf budget calls for "AVIF + WebP", but `formats` was
    // never set, so the optimizer used its default (WebP only) and prod served
    // the home hero — the LCP element — as WebP. AVIF is listed first so it wins
    // content negotiation where supported.
    formats: ["image/avif", "image/webp"],
    // F-131: Next's default `deviceSizes` is eight widths and the optimizer
    // caches every (width, quality) pair separately, which spreads the cache
    // thin on a site with this little traffic — measured on prod, `w=1920` was a
    // `x-vercel-cache: HIT` while `w=640/750/1080` were all MISS.
    //
    // Trimmed, but NOT aggressively: dropping a width silently promotes every
    // device that used it to the next one up. A first cut of
    // `[640, 828, 1080, 1920, 2560]` did exactly that — a Pixel 5 (393 CSS px ×
    // DPR 2.75 = 1081) fell past 1080 and pulled **1920** instead of the 1200 it
    // gets on the default set. So 1200 stays.
    //
    // The cap is 1920 because `public/brand/hero.jpg` is 1376 px wide: the
    // optimizer never upscales, so 2048/3840 would bill a separate cache entry
    // for bytes identical to 1920's.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    // F-073: instructor photos live on Vercel Blob. Public URLs are
    // `https://<store-id>.public.blob.vercel-storage.com/<pathname>`; allow
    // any subdomain since the store id is environment-specific.
    //
    // The single-`*` wildcard rejected real store hostnames in prod
    // ("Invalid src prop … is not configured under images"); `**` is the
    // robust variant for arbitrary subdomain prefixes and is explicit per the
    // Next.js docs.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // F-073: instructor photo upload accepts up to 5MB
      // (`PHOTO_MAX_BYTES`). Next.js Server Actions default to a 1MB body
      // limit, which silently rejects larger uploads with an opaque
      // "unexpected response" runtime error before our Zod size check fires.
      // Bump to 6MB to leave headroom for the FormData boundary + filename.
      bodySizeLimit: "6mb",
    },
  },
};

// withNextIntl wraps first so the next-intl plugin sees the raw nextConfig;
// withSentryConfig wraps last so Sentry's runtime hooks land on the final
// resolved config object.
export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "fjgf-dt",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
