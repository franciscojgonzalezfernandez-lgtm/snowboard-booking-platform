import { describe, expect, it } from "vitest";

import {
  buildFunnelReturnUrl,
  buildFunnelUrl,
  parseFunnelReturnState,
} from "./funnel-return";

const FULL = {
  d: "TWO_HOURS",
  dt: "2026-11-15",
  t: "09:00",
  i: "cmpaddwe100027kmes4hcvhg3",
  l: "en",
} as const;

describe("funnel return state (F-134)", () => {
  it("never emits a colon — the whole reason this exists", () => {
    const url = buildFunnelReturnUrl("en", FULL);

    // Better Auth's origin check rejects any callbackURL containing `:`,
    // encoded or not. This is the assertion that would have caught the bug.
    expect(url).not.toContain(":");
    expect(url).not.toContain("%3A");
    expect(url.startsWith("/en/reservar?r=")).toBe(true);
  });

  it("round-trips every field", () => {
    const url = buildFunnelReturnUrl("de", FULL);
    const packed = new URL(url, "https://example.test").searchParams.get("r");

    expect(parseFunnelReturnState(packed)).toEqual(FULL);
  });

  it("expands back into the plain funnel URL the visitor should see", () => {
    const state = parseFunnelReturnState(
      new URL(buildFunnelReturnUrl("es", FULL), "https://example.test")
        .searchParams.get("r"),
    );

    expect(buildFunnelUrl("es", state!)).toBe(
      "/es/reservar?d=TWO_HOURS&dt=2026-11-15&t=09%3A00&i=cmpaddwe100027kmes4hcvhg3&l=en",
    );
  });

  it("packs only what is set, and stays bare when nothing is", () => {
    expect(buildFunnelReturnUrl("en", {})).toBe("/en/reservar");
    expect(buildFunnelReturnUrl("en", { d: undefined, t: "" })).toBe(
      "/en/reservar",
    );

    const partial = buildFunnelReturnUrl("en", { d: "ONE_HOUR" });
    const packed = new URL(partial, "https://example.test").searchParams.get(
      "r",
    );
    expect(parseFunnelReturnState(packed)).toEqual({ d: "ONE_HOUR" });
  });

  it("drops values that would not survive the page's own validation", () => {
    const url = buildFunnelReturnUrl("en", {
      d: "NOT_A_DURATION",
      dt: "15-11-2026",
      t: "25:99",
      l: "fr",
      i: "cmpaddwe100027kmes4hcvhg3",
    });

    const packed = new URL(url, "https://example.test").searchParams.get("r");
    expect(parseFunnelReturnState(packed)).toEqual({
      i: "cmpaddwe100027kmes4hcvhg3",
    });
  });

  describe("untrusted input degrades to no state, never to injected state", () => {
    const cases: Array<[string, string | undefined | null]> = [
      ["undefined", undefined],
      ["null", null],
      ["empty", ""],
      ["not base64", "!!!!"],
      ["base64 of non-JSON", btoa("hello there")],
      ["base64 of a JSON array", btoa("[1,2,3]")],
      ["base64 of an empty object", btoa("{}")],
      ["payload with a bad duration", btoa(JSON.stringify({ d: "FOREVER" }))],
      ["payload with a bad time", btoa(JSON.stringify({ t: "9am" }))],
      [
        "payload with an unknown key only",
        btoa(JSON.stringify({ evil: "../../admin" })),
      ],
    ];

    for (const [label, input] of cases) {
      it(label, () => {
        expect(parseFunnelReturnState(input)).toBeNull();
      });
    }

    it("ignores extra keys but keeps the valid ones", () => {
      const packed = btoa(
        JSON.stringify({ d: "FULL_DAY", redirect: "https://evil.test" }),
      );
      expect(parseFunnelReturnState(packed)).toEqual({ d: "FULL_DAY" });
    });
  });
});
