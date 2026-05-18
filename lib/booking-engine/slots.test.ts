import { describe, it, expect } from "vitest";
import { Duration } from "@prisma/client";
import { computeSlotsForDate } from "./slots";
import { JAVI, MAYA, booking, makeContext, weekAvailability } from "./fixtures";

const DAY = new Date("2026-12-05T00:00:00.000Z");

describe("computeSlotsForDate", () => {
  it("emits an anchor row for every season anchor time", () => {
    const ctx = makeContext({
      instructors: [JAVI, MAYA],
      availabilityBlocks: [
        ...weekAvailability(JAVI.id, new Date("2026-12-01T00:00:00.000Z")),
        ...weekAvailability(MAYA.id, new Date("2026-12-01T00:00:00.000Z")),
      ],
    });
    const out = computeSlotsForDate(ctx, { date: DAY, duration: Duration.ONE_HOUR });
    expect(out.date).toBe("2026-12-05");
    expect(out.anchorTimes.map((a) => a.time)).toEqual([
      "09:00",
      "11:00",
      "13:00",
      "15:00",
    ]);
  });

  it("marks anchor unavailable when no instructor can host", () => {
    const ctx = makeContext({
      instructors: [JAVI, MAYA],
      availabilityBlocks: [
        ...weekAvailability(JAVI.id, new Date("2026-12-01T00:00:00.000Z")),
        ...weekAvailability(MAYA.id, new Date("2026-12-01T00:00:00.000Z")),
      ],
      bookings: [
        booking(JAVI.id, DAY, "11:00", Duration.ONE_HOUR),
        booking(MAYA.id, DAY, "11:00", Duration.ONE_HOUR),
      ],
    });
    const out = computeSlotsForDate(ctx, { date: DAY, duration: Duration.ONE_HOUR });
    const eleven = out.anchorTimes.find((a) => a.time === "11:00")!;
    expect(eleven.available).toBe(false);
    expect(eleven.instructors).toEqual([]);
  });

  it("ranks instructors by ascending workload of the day, then by id", () => {
    // MAYA has 2 bookings that day, JAVI has 1 → JAVI ranks first.
    const ctx = makeContext({
      instructors: [JAVI, MAYA],
      availabilityBlocks: [
        ...weekAvailability(JAVI.id, new Date("2026-12-01T00:00:00.000Z")),
        ...weekAvailability(MAYA.id, new Date("2026-12-01T00:00:00.000Z")),
      ],
      bookings: [
        booking(JAVI.id, DAY, "09:00", Duration.ONE_HOUR),
        booking(MAYA.id, DAY, "09:00", Duration.ONE_HOUR),
        booking(MAYA.id, DAY, "13:00", Duration.ONE_HOUR),
      ],
    });
    const out = computeSlotsForDate(ctx, { date: DAY, duration: Duration.ONE_HOUR });
    const eleven = out.anchorTimes.find((a) => a.time === "11:00")!;
    expect(eleven.available).toBe(true);
    expect(eleven.instructors.map((i) => i.id)).toEqual(["instr_javi", "instr_maya"]);
  });

  it("returns empty anchorTimes when no active season", () => {
    const ctx = makeContext({ season: null });
    const out = computeSlotsForDate(ctx, { date: DAY, duration: Duration.ONE_HOUR });
    expect(out).toEqual({ date: "2026-12-05", anchorTimes: [] });
  });

  it("exposes instructor card fields verbatim", () => {
    const ctx = makeContext({ instructors: [JAVI] });
    const out = computeSlotsForDate(ctx, { date: DAY, duration: Duration.ONE_HOUR });
    const eleven = out.anchorTimes.find((a) => a.time === "11:00")!;
    const card = eleven.instructors[0]!;
    expect(card).toMatchObject({
      id: "instr_javi",
      name: "Javi",
      photo: null,
      specialties: ["freestyle", "powder"],
      languages: ["en", "de", "es"],
    });
  });
});
