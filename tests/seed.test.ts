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

  it("active season exposes hourly anchor times from 09:00 to 15:00", () => {
    const match = seedSource.match(/anchorTimes:\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const times = (match![1] ?? "")
      .split(",")
      .map((s) => s.replace(/['"\s]/g, ""))
      .filter(Boolean);
    expect(times).toEqual([
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
    ]);
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

describe("prisma/seed.ts availability (F-154)", () => {
  it("spans the whole season (iterates to season.endDate, no fixed week count)", () => {
    expect(seedSource).toMatch(/day\s*<=\s*season\.endDate/);
    expect(seedSource).not.toMatch(/SEED_WEEKS/);
  });

  it("closes Sundays and Mondays (no block on weekday 0 or 1)", () => {
    expect(seedSource).toMatch(/weekday\s*===\s*0\s*\|\|\s*weekday\s*===\s*1/);
  });

  it("closes the winter-holiday break 2026-12-28 → 2027-01-08 (inclusive)", () => {
    expect(seedSource).toMatch(/HOLIDAY_BREAK_START\s*=\s*dateOnly\("2026-12-28"\)/);
    expect(seedSource).toMatch(/HOLIDAY_BREAK_END\s*=\s*dateOnly\("2027-01-08"\)/);
    expect(seedSource).toMatch(
      /day\s*>=\s*HOLIDAY_BREAK_START\s*&&\s*day\s*<=\s*HOLIDAY_BREAK_END/,
    );
  });
});

describe("prisma/seed.ts prod-shape guards (F-154)", () => {
  it("no longer seeds a second instructor, demo bookings, or student history", () => {
    expect(seedSource).not.toMatch(/upsertLaraInstructor|upsertLaraUser/);
    expect(seedSource).not.toMatch(
      /SEED_BOOKING_PREFIX|reseedBookings|buildBookingPlan/,
    );
    expect(seedSource).not.toMatch(/reseedStudentHistory|SEED_HISTORY_PREFIX/);
    expect(seedSource).not.toMatch(/upsertSeedBooker|upsertHistoryBooker/);
  });

  it("keeps the production-seed guard", () => {
    expect(seedSource).toMatch(/assertNotProduction/);
    expect(seedSource).toMatch(/ALLOW_PRODUCTION_SEED/);
  });
});

describe("prisma/seed.ts (F-039)", () => {
  it("declares INITIAL_PRICE_CENTS with all four Duration keys (VAT-inclusive CHF)", () => {
    const block = seedSource.match(
      /INITIAL_PRICE_CENTS:\s*Record<Duration,\s*number>\s*=\s*\{([\s\S]*?)\};/,
    );
    expect(block).not.toBeNull();
    const body = block![1] ?? "";
    expect(body).toMatch(/ONE_HOUR:\s*11_000/);
    expect(body).toMatch(/TWO_HOURS:\s*20_000/);
    expect(body).toMatch(/INTENSIVE:\s*38_500/);
    expect(body).toMatch(/FULL_DAY:\s*50_000/);
  });

  it("upsertSeason writes INITIAL_PRICE_CENTS into priceCentsByDuration", () => {
    expect(seedSource).toMatch(/priceCentsByDuration:\s*INITIAL_PRICE_CENTS/);
  });
});
