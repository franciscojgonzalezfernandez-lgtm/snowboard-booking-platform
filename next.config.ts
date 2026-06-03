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
