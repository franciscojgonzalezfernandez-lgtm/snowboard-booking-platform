import { describe, it, expect } from "vitest";
import { Duration } from "@prisma/client";
import { durationMinutes } from "./duration";

describe("durationMinutes", () => {
  it("maps every Duration value", () => {
    expect(durationMinutes(Duration.ONE_HOUR)).toBe(60);
    expect(durationMinutes(Duration.TWO_HOURS)).toBe(120);
    expect(durationMinutes(Duration.INTENSIVE)).toBe(240);
    expect(durationMinutes(Duration.FULL_DAY)).toBe(360);
  });
});
