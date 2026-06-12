import { describe, expect, test } from "vitest";

import { attendeeSchema } from "./attendee";

const VALID = { name: "Nina", age: 12, level: "BEGINNER" };

describe("attendeeSchema (F-086b shared contract)", () => {
  test("accepts a valid attendee", () => {
    expect(attendeeSchema.safeParse(VALID).success).toBe(true);
  });

  test("trims the name", () => {
    const r = attendeeSchema.safeParse({ ...VALID, name: "  Nina  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Nina");
  });

  test("rejects an empty name", () => {
    expect(attendeeSchema.safeParse({ ...VALID, name: "  " }).success).toBe(
      false,
    );
  });

  test.each([
    [3, false],
    [4, true],
    [99, true],
    [100, false],
  ])("age %i → success=%s", (age, success) => {
    expect(attendeeSchema.safeParse({ ...VALID, age }).success).toBe(success);
  });

  test("coerces a numeric string age (form input)", () => {
    const r = attendeeSchema.safeParse({ ...VALID, age: "12" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.age).toBe(12);
  });

  test("rejects an unknown level", () => {
    expect(
      attendeeSchema.safeParse({ ...VALID, level: "WIZARD" }).success,
    ).toBe(false);
  });
});
