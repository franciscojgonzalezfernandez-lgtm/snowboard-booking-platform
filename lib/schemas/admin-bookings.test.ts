import { describe, expect, test } from "vitest";
import { BookingStatus } from "@prisma/client";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseAdminBookingsFilters,
} from "./admin-bookings";

describe("parseAdminBookingsFilters", () => {
  test("returns defaults when nothing is passed", () => {
    expect(parseAdminBookingsFilters({})).toEqual({
      status: undefined,
      instructorId: undefined,
      from: undefined,
      to: undefined,
      q: undefined,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  test("accepts a valid status and drops bogus ones", () => {
    expect(parseAdminBookingsFilters({ status: "CONFIRMED" }).status).toBe(
      BookingStatus.CONFIRMED,
    );
    expect(parseAdminBookingsFilters({ status: "NOT_A_STATUS" }).status).toBeUndefined();
  });

  test("validates ISO date format for from/to and drops malformed values", () => {
    const out = parseAdminBookingsFilters({ from: "2026-12-01", to: "2026-12-31" });
    expect(out.from?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(out.to?.toISOString()).toBe("2026-12-31T00:00:00.000Z");

    expect(parseAdminBookingsFilters({ from: "12/01/2026" }).from).toBeUndefined();
    expect(parseAdminBookingsFilters({ to: "2026-13-99" }).to).toBeUndefined();
  });

  test("swaps from/to when from > to", () => {
    const out = parseAdminBookingsFilters({ from: "2026-12-31", to: "2026-12-01" });
    expect(out.from?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(out.to?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  test("clamps page to >= 1 and pageSize to [1, MAX]", () => {
    expect(parseAdminBookingsFilters({ page: "0" }).page).toBe(1);
    expect(parseAdminBookingsFilters({ page: "-5" }).page).toBe(1);
    expect(parseAdminBookingsFilters({ page: "abc" }).page).toBe(1);
    expect(parseAdminBookingsFilters({ page: "3" }).page).toBe(3);

    expect(parseAdminBookingsFilters({ pageSize: "0" }).pageSize).toBe(1);
    expect(parseAdminBookingsFilters({ pageSize: "9999" }).pageSize).toBe(MAX_PAGE_SIZE);
    expect(parseAdminBookingsFilters({ pageSize: "50" }).pageSize).toBe(50);
  });

  test("trims q and rejects empty / overly long", () => {
    expect(parseAdminBookingsFilters({ q: "  javi  " }).q).toBe("javi");
    expect(parseAdminBookingsFilters({ q: "   " }).q).toBeUndefined();
    expect(parseAdminBookingsFilters({ q: "x".repeat(200) }).q).toBeUndefined();
  });

  test("instructorId: rejects empty / whitespace, accepts plausible ids", () => {
    expect(parseAdminBookingsFilters({ instructorId: "inst_abc123" }).instructorId).toBe(
      "inst_abc123",
    );
    expect(parseAdminBookingsFilters({ instructorId: " " }).instructorId).toBeUndefined();
    expect(parseAdminBookingsFilters({ instructorId: "id with space" }).instructorId).toBeUndefined();
  });

  test("ignores array-valued search params by reading the first entry", () => {
    const out = parseAdminBookingsFilters({ status: ["CONFIRMED", "COMPLETED"] });
    expect(out.status).toBe(BookingStatus.CONFIRMED);
  });
});
