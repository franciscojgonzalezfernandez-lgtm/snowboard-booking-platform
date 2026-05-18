import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const seedSource = readFileSync(
  path.resolve(__dirname, "../prisma/seed.ts"),
  "utf8",
);

describe("prisma/seed.ts (F-021)", () => {
  it("seeds the owner User with all three roles", () => {
    expect(seedSource).toMatch(
      /roles:\s*\[\s*Role\.student\s*,\s*Role\.instructor\s*,\s*Role\.admin\s*\]/,
    );
  });

  it("instructor row covers all three locales as taught languages", () => {
    expect(seedSource).toMatch(
      /languages:\s*\[\s*Locale\.en\s*,\s*Locale\.de\s*,\s*Locale\.es\s*\]/,
    );
  });

  it("active season uses the four anchor times from the PRD baseline", () => {
    const match = seedSource.match(/anchorTimes:\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const times = (match![1] ?? "")
      .split(",")
      .map((s) => s.replace(/['"\s]/g, ""))
      .filter(Boolean);
    expect(times).toEqual(["09:00", "11:00", "13:00", "15:00"]);
  });

  it("pre-seeds eight weeks of availability blocks", () => {
    expect(seedSource).toMatch(/SEED_WEEKS\s*=\s*8/);
  });

  it("uses upsert / find-first patterns so re-running is idempotent", () => {
    expect(seedSource).toMatch(/prisma\.user\.upsert/);
    expect(seedSource).toMatch(/prisma\.instructor\.upsert/);
    expect(seedSource).toMatch(/prisma\.season\.findFirst/);
    expect(seedSource).toMatch(/availabilityBlock\.deleteMany/);
    expect(seedSource).toMatch(/availabilityBlock\.createMany/);
  });

  it("instructor accepts-same-day flag stays false by default", () => {
    expect(seedSource).toMatch(/acceptsSameDayIfBooked:\s*false/);
  });
});

describe("prisma/seed.ts (F-036)", () => {
  it("seeds a second instructor (Lara Müller) with [de, en]", () => {
    expect(seedSource).toMatch(/upsertLaraInstructor/);
    expect(seedSource).toMatch(
      /languages:\s*\[\s*Locale\.de\s*,\s*Locale\.en\s*\]/,
    );
  });

  it("seeds a fake booker user with student role", () => {
    expect(seedSource).toMatch(/upsertSeedBooker/);
    expect(seedSource).toMatch(/student\+seed@rideflumserberg\.ch/);
  });

  it("reseeds bookings idempotently using the seed prefix", () => {
    expect(seedSource).toMatch(/SEED_BOOKING_PREFIX\s*=\s*"seed-f036-"/);
    expect(seedSource).toMatch(/icsUid:\s*\{\s*startsWith:\s*SEED_BOOKING_PREFIX/);
  });

  it("plans Lara @ 09:00 every seeded day", () => {
    expect(seedSource).toMatch(
      /instructor:\s*lara,\s*date:\s*day,\s*anchorTime:\s*"09:00"/,
    );
  });

  it("plans Javi @ 13:00 every Wednesday in window", () => {
    expect(seedSource).toMatch(/day\.getUTCDay\(\)\s*===\s*3/);
    expect(seedSource).toMatch(
      /instructor:\s*javi,\s*date:\s*day,\s*anchorTime:\s*"13:00"/,
    );
  });

  it("plans the saturated 15:00 anchor on 2026-12-02 (both instructors)", () => {
    expect(seedSource).toMatch(
      /SATURATED_DAY\s*=\s*dateOnly\("2026-12-02"\)/,
    );
  });

  it("alternates CONFIRMED and PENDING_PAYMENT status across bookings", () => {
    expect(seedSource).toMatch(/BookingStatus\.CONFIRMED/);
    expect(seedSource).toMatch(/BookingStatus\.PENDING_PAYMENT/);
  });

  it("each seeded booking creates one attendee with isBooker = true", () => {
    expect(seedSource).toMatch(/isBooker:\s*true/);
    expect(seedSource).toMatch(/Level\.INTERMEDIATE/);
  });
});
