import { describe, it, expect } from "vitest";
import {
  addDays,
  diffMinutes,
  formatHHMM,
  parseHHMM,
  sameUtcDay,
  setUtcTime,
  startOfUtcDay,
  toIsoDate,
} from "./time";

describe("time helpers", () => {
  describe("parseHHMM", () => {
    it("parses hours and minutes", () => {
      expect(parseHHMM("09:30")).toBe(570);
      expect(parseHHMM("00:00")).toBe(0);
      expect(parseHHMM("23:59")).toBe(23 * 60 + 59);
    });

    it("rejects malformed strings", () => {
      expect(() => parseHHMM("9:30")).toThrow();
      expect(() => parseHHMM("24:00")).toThrow();
      expect(() => parseHHMM("12:60")).toThrow();
      expect(() => parseHHMM("ab:cd")).toThrow();
    });
  });

  describe("formatHHMM", () => {
    it("pads single-digit components", () => {
      expect(formatHHMM(9 * 60)).toBe("09:00");
      expect(formatHHMM(9 * 60 + 5)).toBe("09:05");
    });

    it("rejects out-of-range minutes", () => {
      expect(() => formatHHMM(-1)).toThrow();
      expect(() => formatHHMM(24 * 60)).toThrow();
    });
  });

  describe("date helpers", () => {
    it("startOfUtcDay zeroes time component", () => {
      const d = new Date("2026-12-05T13:42:11.500Z");
      expect(startOfUtcDay(d).toISOString()).toBe("2026-12-05T00:00:00.000Z");
    });

    it("addDays handles wrap-around", () => {
      const d = new Date("2026-12-30T00:00:00.000Z");
      expect(toIsoDate(addDays(d, 3))).toBe("2027-01-02");
      expect(toIsoDate(addDays(d, -1))).toBe("2026-12-29");
    });

    it("setUtcTime applies HH:MM to base date", () => {
      const d = new Date("2026-12-05T00:00:00.000Z");
      expect(setUtcTime(d, "13:45").toISOString()).toBe("2026-12-05T13:45:00.000Z");
    });

    it("diffMinutes returns signed minute difference", () => {
      const a = new Date("2026-12-05T11:00:00.000Z");
      const b = new Date("2026-12-05T09:30:00.000Z");
      expect(diffMinutes(a, b)).toBe(90);
      expect(diffMinutes(b, a)).toBe(-90);
    });

    it("sameUtcDay ignores time components", () => {
      const a = new Date("2026-12-05T00:01:00.000Z");
      const b = new Date("2026-12-05T23:59:00.000Z");
      const c = new Date("2026-12-06T00:00:00.000Z");
      expect(sameUtcDay(a, b)).toBe(true);
      expect(sameUtcDay(a, c)).toBe(false);
    });

    it("toIsoDate produces yyyy-mm-dd", () => {
      expect(toIsoDate(new Date("2026-01-05T12:34:56.000Z"))).toBe("2026-01-05");
    });
  });
});
