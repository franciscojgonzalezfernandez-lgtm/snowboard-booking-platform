"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { AuthNavLinks } from "./AuthNavLinks";

type AuthNavProps = {
  /**
   * What to render while the client session is still resolving. Marketing and
   * auth chrome leave this `false` (anonymous is the overwhelmingly common case
   * there); the dashboard passes `true` because its own auth gate already
   * guarantees a signed-in visitor, so the CTA must never flash "sign in".
   */
  initialSignedIn?: boolean;
};

const AuthNavSession = dynamic(
  () => import("./AuthNavSession").then((m) => m.AuthNavSession),
  { ssr: false },
);

/**
 * Desktop auth CTA (F-124). This is a client island on purpose: reading the
 * session on the server made `SiteNav` — and therefore every marketing route
 * that mounts it — dynamic, which meant Vercel answered `no-store` + a cache
 * MISS on every request. That TTFB was 45% of the home's LCP.
 *
 * The wrapper reserves the width of the signed-out CTA and right-aligns its
 * content, so the anonymous first paint (the case Lighthouse and ~all marketing
 * traffic hit) settles with zero layout shift. A visitor who turns out to be
 * signed in swaps to the wider account cluster once the session resolves.
 *
 * F-125: the session read itself now waits for the browser to go idle, so the
 * Better Auth client leaves the critical path. The pre-resolution markup is
 * unchanged — it is the same `initialSignedIn` contract, just held a beat
 * longer — so the no-layout-shift promise above still holds.
 */
export function AuthNav({ initialSignedIn = false }: AuthNavProps) {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(() => setSessionReady(true), {
        timeout: 2000,
      });
      return () => window.cancelIdleCallback(handle);
    }

    const handle = window.setTimeout(() => setSessionReady(true), 1000);
    return () => window.clearTimeout(handle);
  }, []);

  return (
    <div className="hidden min-w-[190px] items-center justify-end gap-5 lg:flex">
      {sessionReady ? (
        <AuthNavSession initialSignedIn={initialSignedIn} />
      ) : (
        <AuthNavLinks signedIn={initialSignedIn} />
      )}
    </div>
  );
}
