import { describe, expect, it } from "vitest";

import { SITE_URL } from "@/lib/seo/site-url";
import { canonicalRedirectTarget } from "@/lib/seo/canonical-host";

const VERCEL_HOST = "snowboard-booking-platform.vercel.app";

describe("canonicalRedirectTarget (F-114)", () => {
  it("redirects the production vercel.app alias to the canonical domain, keeping path", () => {
    expect(
      canonicalRedirectTarget({
        host: VERCEL_HOST,
        vercelEnv: "production",
        pathname: "/en",
        search: "",
      }),
    ).toBe(`${SITE_URL}/en`);
  });

  it("preserves the path and query string", () => {
    expect(
      canonicalRedirectTarget({
        host: VERCEL_HOST,
        vercelEnv: "production",
        pathname: "/de/preise",
        search: "?ref=x",
      }),
    ).toBe(`${SITE_URL}/de/preise?ref=x`);
  });

  it("does not redirect the canonical host itself", () => {
    expect(
      canonicalRedirectTarget({
        host: "rideflumserberg.ch",
        vercelEnv: "production",
        pathname: "/es/sobre",
        search: "",
      }),
    ).toBeNull();
  });

  it("does not redirect preview deployments (they live on vercel.app)", () => {
    expect(
      canonicalRedirectTarget({
        host: "snowboard-booking-platform-git-abc123.vercel.app",
        vercelEnv: "preview",
        pathname: "/en",
        search: "",
      }),
    ).toBeNull();
  });

  it("does not redirect in local dev (no VERCEL_ENV)", () => {
    expect(
      canonicalRedirectTarget({
        host: "localhost:3000",
        vercelEnv: undefined,
        pathname: "/en",
        search: "",
      }),
    ).toBeNull();
  });
});
