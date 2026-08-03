// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// F-125 — the SDK is loaded with a dynamic `import()` instead of a static one.
// Statically imported, `@sentry/nextjs` landed in the chunk shared by every
// route: 108 KB gz of the home's 410 KB First Load JS (68 KB core/tracing +
// 40 KB of `replayIntegration`/rrweb), on static marketing pages whose whole
// job is to paint fast. Session Replay was dropped outright — it was never
// consulted for a marketing page, and it is the single most expensive
// integration in the SDK. Error monitoring still covers every route; it just
// arrives off the critical path.
//
// Ordering contract:
//   - listeners below are attached synchronously, so an error thrown during
//     hydration (before the SDK exists) is still buffered and replayed into
//     Sentry once it loads;
//   - anything else waits for the browser to go idle.

import type * as SentryModule from "@sentry/nextjs";

type Sentry = typeof SentryModule;

const TRACES_SAMPLE_RATE = process.env.NODE_ENV === "production" ? 0.1 : 1;

let sentryPromise: Promise<Sentry> | null = null;

function loadSentry(): Promise<Sentry> {
  sentryPromise ??= import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: "https://a41bac9e4df84071a0d07b79fe149b0d@o4511390674452480.ingest.de.sentry.io/4511390674911312",

      // F-125: `replayIntegration()` removed. rrweb is ~40 KB gz and it was
      // being shipped to anonymous marketing traffic. If replay is wanted for
      // the booking funnel later, load it there with
      // `Sentry.lazyLoadIntegration("replayIntegration")` — not here.

      // F-125: was 1 (every pageview traced). Marketing is now statically
      // cached (F-124), so full-rate tracing burns quota describing CDN hits.
      tracesSampleRate: TRACES_SAMPLE_RATE,
      // Enable logs to be sent to Sentry
      enableLogs: true,

      // Enable sending user PII (Personally Identifiable Information)
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
      sendDefaultPii: true,
    });

    return Sentry;
  });

  return sentryPromise;
}

// Errors thrown before the SDK finishes loading would otherwise be lost: the
// global handlers the SDK installs simply are not there yet. Buffer them here
// and hand them over on arrival.
function captureEarly(error: unknown) {
  void loadSentry().then((Sentry) => {
    Sentry.captureException(error);
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    captureEarly(event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    captureEarly(event.reason);
  });

  // Idle is the normal path: monitoring is live within a second of load on a
  // real connection, without competing with hydration for the main thread.
  // `requestIdleCallback` is not in Safari < 16.4, hence the timeout fallback.
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => void loadSentry(), { timeout: 5000 });
  } else {
    window.setTimeout(() => void loadSentry(), 2000);
  }
}

// Next.js calls this on every client-side navigation. It has to exist at module
// scope, so it forwards into whatever state the SDK load is in: the transition
// is recorded if the SDK is already up, and dropped if it is not — which is the
// same trade the idle load makes everywhere else.
export const onRouterTransitionStart = (
  ...args: Parameters<Sentry["captureRouterTransitionStart"]>
) => {
  void loadSentry().then((Sentry) => {
    Sentry.captureRouterTransitionStart(...args);
  });
};
