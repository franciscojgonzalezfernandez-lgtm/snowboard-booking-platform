import { describe, expect, it } from "vitest";

import { MAGIC_LINK_EXPIRY_SECONDS } from "./index";

/**
 * F-138 — pins the magic link lifetime.
 *
 * The value being explicit is the whole point: Better Auth silently falls back
 * to 300s when `expiresIn` is omitted, which is what shipped. A test that only
 * compared the constant to itself would be worthless, so these assert the two
 * properties that actually matter — that we are not on the library default, and
 * that the window is long enough for an email round trip but not open-ended.
 */
describe("magic link expiry (F-138)", () => {
  const BETTER_AUTH_DEFAULT_SECONDS = 300;

  it("is not Better Auth's implicit default", () => {
    expect(MAGIC_LINK_EXPIRY_SECONDS).not.toBe(BETTER_AUTH_DEFAULT_SECONDS);
    expect(MAGIC_LINK_EXPIRY_SECONDS).toBeGreaterThan(
      BETTER_AUTH_DEFAULT_SECONDS,
    );
  });

  it("gives an email round trip room without becoming a standing credential", () => {
    // Floor: delivery + the booker noticing. Ceiling: a link left in an inbox
    // should not stay live for hours.
    expect(MAGIC_LINK_EXPIRY_SECONDS).toBeGreaterThanOrEqual(60 * 15);
    expect(MAGIC_LINK_EXPIRY_SECONDS).toBeLessThanOrEqual(60 * 60);
  });

  it("is 30 minutes", () => {
    expect(MAGIC_LINK_EXPIRY_SECONDS).toBe(1800);
  });
});
