import { describe, it, expect } from "vitest";
import {
  MAX_CALENDAR_RANGE_DAYS,
  calendarQuerySchema,
  nearbyQuerySchema,
  parseSearchParams,
  zodErrorToResponse,
} from "./availability";

describe("availability schemas", () => {
  describe("calendarQuerySchema", () => {
    it("parses a valid 1-day range", () => {
      const r = calendarQuerySchema.safeParse({
        duration: "ONE_HOUR",
        monthFrom: "2026-12-01",
        monthTo: "2026-12-01",
      });
      expect(r.success).toBe(true);
    });

    it("rejects an invalid duration enum", () => {
      const r = calendarQuerySchema.safeParse({
        duration: "FIVE_MINUTES",
        monthFrom: "2026-12-01",
        monthTo: "2026-12-07",
      });
      expect(r.success).toBe(false);
    });

    it("rejects malformed dates", () => {
      const r = calendarQuerySchema.safeParse({
        duration: "ONE_HOUR",
        monthFrom: "2026/12/01",
        monthTo: "2026-12-07",
      });
      expect(r.success).toBe(false);
    });

    it("rejects when monthTo precedes monthFrom", () => {
      const r = calendarQuerySchema.safeParse({
        duration: "ONE_HOUR",
        monthFrom: "2026-12-07",
        monthTo: "2026-12-01",
      });
      expect(r.success).toBe(false);
    });

    it(`rejects when range exceeds ${MAX_CALENDAR_RANGE_DAYS} days`, () => {
      const r = calendarQuerySchema.safeParse({
        duration: "ONE_HOUR",
        monthFrom: "2026-12-01",
        monthTo: "2027-04-30",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("nearbyQuerySchema", () => {
    it("parses valid input", () => {
      const r = nearbyQuerySchema.safeParse({
        duration: "TWO_HOURS",
        date: "2026-12-25",
      });
      expect(r.success).toBe(true);
    });

    it("rejects missing duration", () => {
      const r = nearbyQuerySchema.safeParse({ date: "2026-12-25" });
      expect(r.success).toBe(false);
    });
  });

  describe("parseSearchParams + zodErrorToResponse", () => {
    it("reads URLSearchParams", () => {
      const p = new URLSearchParams({
        duration: "ONE_HOUR",
        monthFrom: "2026-12-01",
        monthTo: "2026-12-02",
      });
      const r = parseSearchParams(calendarQuerySchema, p);
      expect(r.success).toBe(true);
    });

    it("formats Zod errors with path + message", () => {
      const r = calendarQuerySchema.safeParse({
        duration: "ONE_HOUR",
        monthFrom: "bad",
        monthTo: "2026-12-02",
      });
      if (r.success) throw new Error("expected failure");
      const out = zodErrorToResponse(r.error);
      expect(out.error).toBe("Invalid query parameters");
      expect(out.issues.length).toBeGreaterThan(0);
      for (const i of out.issues) {
        expect(typeof i.path).toBe("string");
        expect(typeof i.message).toBe("string");
      }
    });
  });
});
