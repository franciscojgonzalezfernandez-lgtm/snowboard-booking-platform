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
