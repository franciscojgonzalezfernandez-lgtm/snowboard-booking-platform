import { expect, test } from "@playwright/test";

test.describe("F-023 — /api/availability/calendar", () => {
  test("happy path returns one day per requested date", async ({ request }) => {
    const res = await request.get("/api/availability/calendar", {
      params: {
        duration: "ONE_HOUR",
        monthFrom: "2026-12-01",
        monthTo: "2026-12-07",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("days");
    expect(Array.isArray(body.days)).toBe(true);
    expect(body.days).toHaveLength(7);
    for (const day of body.days) {
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("hasAvailability");
      expect(day).toHaveProperty("instructorCount");
      expect(typeof day.hasAvailability).toBe("boolean");
      expect(typeof day.instructorCount).toBe("number");
    }
  });

  test("rejects an invalid duration with 400", async ({ request }) => {
    const res = await request.get("/api/availability/calendar", {
      params: {
        duration: "FIVE_MINUTES",
        monthFrom: "2026-12-01",
        monthTo: "2026-12-07",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
    expect(body.issues.length).toBeGreaterThan(0);
  });

  test("rejects an inverted range with 400", async ({ request }) => {
    const res = await request.get("/api/availability/calendar", {
      params: {
        duration: "ONE_HOUR",
        monthFrom: "2026-12-07",
        monthTo: "2026-12-01",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a range over 3 months with 400", async ({ request }) => {
    const res = await request.get("/api/availability/calendar", {
      params: {
        duration: "ONE_HOUR",
        monthFrom: "2026-12-01",
        monthTo: "2027-04-30",
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("F-023 — /api/availability/nearby", () => {
  test("happy path returns up to 5 dates", async ({ request }) => {
    const res = await request.get("/api/availability/nearby", {
      params: { duration: "ONE_HOUR", date: "2026-12-15" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("date", "2026-12-15");
    expect(Array.isArray(body.dates)).toBe(true);
    expect(body.dates.length).toBeLessThanOrEqual(5);
  });

  test("rejects missing duration with 400", async ({ request }) => {
    const res = await request.get("/api/availability/nearby", {
      params: { date: "2026-12-15" },
    });
    expect(res.status()).toBe(400);
  });
});
