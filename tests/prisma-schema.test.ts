import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const schema = readFileSync(
  path.resolve(__dirname, "../prisma/schema.prisma"),
  "utf8",
);

const migrationsDir = path.resolve(__dirname, "../prisma/migrations");
const allMigrationSql = readdirSync(migrationsDir)
  .filter((name) => name !== "migration_lock.toml")
  .map((name) =>
    readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"),
  )
  .join("\n");

const extract = (kind: "model" | "enum") =>
  [...schema.matchAll(new RegExp(`^${kind}\\s+(\\w+)\\s*\\{`, "gm"))]
    .map((m) => m[1])
    .sort();

describe("prisma schema shape (F-020)", () => {
  it("declares the expected models", () => {
    expect(extract("model")).toMatchInlineSnapshot(`
      [
        "Account",
        "AccountCredit",
        "Attendee",
        "AvailabilityBlock",
        "Booking",
        "Instructor",
        "Season",
        "Session",
        "Tip",
        "User",
        "Verification",
      ]
    `);
  });

  it("declares the expected enums", () => {
    expect(extract("enum")).toMatchInlineSnapshot(`
      [
        "AvailabilityKind",
        "BookingStatus",
        "CreditReason",
        "CreditStatus",
        "Duration",
        "Level",
        "Locale",
        "Role",
      ]
    `);
  });

  it("Booking enforces unique stripe payment intent and ics uid", () => {
    expect(schema).toMatch(/stripePaymentIntentId\s+String\?\s+@unique/);
    expect(schema).toMatch(/icsUid\s+String\s+@unique/);
  });

  it("monetary fields end in Cents and use Int", () => {
    const moneyFields = [...schema.matchAll(/^\s+(\w*Cents)\s+(\w+)/gm)].map(
      (m) => [m[1], m[2]] as const,
    );
    expect(moneyFields.length).toBeGreaterThan(0);
    for (const [name, type] of moneyFields) {
      expect(name).toMatch(/Cents$/);
      expect(type).toBe("Int");
    }
  });

  it("Attendee.isBooker is constrained to at most one per booking", () => {
    expect(allMigrationSql).toMatch(
      /CREATE UNIQUE INDEX\s+"Attendee_oneBookerPerBooking"\s+ON\s+"Attendee"\s*\(\s*"bookingId"\s*\)\s+WHERE\s+"isBooker"\s*=\s*true/i,
    );
  });

  it("Better Auth tables keep PascalCase names (no @@map drift)", () => {
    expect(schema).not.toMatch(/@@map\(\s*"(user|session|account|verification)"\s*\)/);
  });
});
