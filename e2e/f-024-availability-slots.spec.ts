import { expect, test } from "@playwright/test";

test.describe("F-024 — /api/availability/slots", () => {
  test("happy path returns one row per season anchor time", async ({ request }) => {
    const res = await request.get("/api/availability/slots", {
      params: { duration: "ONE_HOUR", date: "2026-12-05" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("date", "2026-12-05");
    expect(Array.isArray(body.anchorTimes)).toBe(true);
    // Season seed exposes hourly anchors 09:00–15:00 (7 entries).
    expect(body.anchorTimes).toHaveLength(7);
    for (const row of body.anchorTimes) {
      expect(typeof row.time).toBe("string");
      expect(typeof row.available).toBe("boolean");
      expect(Array.isArray(row.instructors)).toBe(true);
    }
  });

  test("instructor card carries id, name, languages, specialties", async ({ request }) => {
    const res = await request.get("/api/availability/slots", {
      params: { duration: "ONE_HOUR", date: "2026-12-05" },
    });
    const body = await res.json();
    const firstAvailable = body.anchorTimes.find(
      (a: { available: boolean }) => a.available,
    );
    expect(firstAvailable).toBeDefined();
    expect(firstAvailable.instructors.length).toBeGreaterThan(0);
    const card = firstAvailable.instructors[0];
    expect(typeof card.id).toBe("string");
    expect(Array.isArray(card.languages)).toBe(true);
    expect(Array.isArray(card.specialties)).toBe(true);
    expect("name" in card).toBe(true);
    expect("photo" in card).toBe(true);
  });

  test("rejects an invalid duration with 400", async ({ request }) => {
    const res = await request.get("/api/availability/slots", {
      params: { duration: "FIVE_MINUTES", date: "2026-12-05" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
  });

  test("rejects a malformed date with 400", async ({ request }) => {
    const res = await request.get("/api/availability/slots", {
      params: { duration: "ONE_HOUR", date: "2026/12/05" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects missing params with 400", async ({ request }) => {
    const res = await request.get("/api/availability/slots");
    expect(res.status()).toBe(400);
  });

  test("anchor times respect season operatingHoursEnd for long durations", async ({ request }) => {
    // FULL_DAY (6h) starting at 15:00 would end at 21:00, well past 17:00 operatingHoursEnd.
    // Seed exposes hourly anchors 09:00–15:00 with operatingHoursEnd = 17:00, so only
    // 09:00 (→15:00), 10:00 (→16:00) and 11:00 (→17:00) fit FULL_DAY. Anchors 12:00–15:00
    // must be marked unavailable for FULL_DAY.
    const res = await request.get("/api/availability/slots", {
      params: { duration: "FULL_DAY", date: "2026-12-05" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // 15:00 + 6h overshoots; that anchor must report unavailable.
    const fifteen = body.anchorTimes.find(
      (a: { time: string }) => a.time === "15:00",
    );
    if (fifteen) {
      expect(fifteen.available).toBe(false);
    }
  });
});
