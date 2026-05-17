import {
  AvailabilityKind,
  BookingStatus,
  Duration,
  Locale,
} from "@prisma/client";
import type {
  EngineAvailabilityBlock,
  EngineBooking,
  EngineContext,
  EngineInstructor,
  EngineSeason,
} from "./types";

export const FIXED_NOW = new Date("2026-12-01T08:00:00.000Z");

export const SEASON: EngineSeason = {
  startDate: new Date("2026-11-15T00:00:00.000Z"),
  endDate: new Date("2027-04-30T00:00:00.000Z"),
  active: true,
  anchorTimes: ["09:00", "11:00", "13:00", "15:00"],
  operatingHoursStart: "09:00",
  operatingHoursEnd: "17:00",
};

export const JAVI: EngineInstructor = {
  id: "instr_javi",
  name: "Javi",
  photo: null,
  specialties: ["freestyle", "powder"],
  languages: [Locale.en, Locale.de, Locale.es],
  active: true,
  acceptsSameDayIfBooked: false,
};

export const MAYA: EngineInstructor = {
  id: "instr_maya",
  name: "Maya",
  photo: null,
  specialties: ["race-carving"],
  languages: [Locale.de],
  active: true,
  acceptsSameDayIfBooked: true,
};

export function fullDayAvailability(
  instructorId: string,
  date: Date,
): EngineAvailabilityBlock {
  const start = new Date(date);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(17, 0, 0, 0);
  return {
    instructorId,
    startDateTime: start,
    endDateTime: end,
    kind: AvailabilityKind.AVAILABLE,
  };
}

export function blocked(
  instructorId: string,
  start: Date,
  end: Date,
): EngineAvailabilityBlock {
  return {
    instructorId,
    startDateTime: start,
    endDateTime: end,
    kind: AvailabilityKind.BLOCKED,
  };
}

export function booking(
  instructorId: string,
  date: Date,
  anchorTime: string,
  duration: Duration,
  status: BookingStatus = BookingStatus.CONFIRMED,
): EngineBooking {
  const dateOnly = new Date(date);
  dateOnly.setUTCHours(0, 0, 0, 0);
  return { instructorId, date: dateOnly, anchorTime, duration, status };
}

/** 7 consecutive days of full availability from `from` for the given instructor. */
export function weekAvailability(
  instructorId: string,
  from: Date,
): EngineAvailabilityBlock[] {
  const out: EngineAvailabilityBlock[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(from);
    day.setUTCDate(day.getUTCDate() + i);
    out.push(fullDayAvailability(instructorId, day));
  }
  return out;
}

export function makeContext(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    now: FIXED_NOW,
    season: SEASON,
    instructors: [JAVI],
    availabilityBlocks: weekAvailability(JAVI.id, new Date("2026-12-01T00:00:00.000Z")),
    bookings: [],
    ...overrides,
  };
}
