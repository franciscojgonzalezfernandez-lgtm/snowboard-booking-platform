import type {
  AvailabilityKind,
  BookingStatus,
  Duration,
  Locale,
} from "@prisma/client";

/** Subset of the Instructor row the engine reads. */
export type EngineInstructor = {
  id: string;
  active: boolean;
  acceptsSameDayIfBooked: boolean;
  languages: Locale[];
  /** Optional fields surfaced in slots response cards (name/photo/specialties). */
  name?: string | null;
  photo?: string | null;
  specialties?: string[];
};

/** Subset of AvailabilityBlock the engine reads. */
export type EngineAvailabilityBlock = {
  instructorId: string;
  startDateTime: Date;
  endDateTime: Date;
  kind: AvailabilityKind;
};

/**
 * Subset of Booking the engine reads. The engine treats any booking with
 * status NOT in {CANCELLED_BY_USER, CANCELLED_BY_OPS, PAYMENT_FAILED} as a
 * hard occupancy (PENDING_PAYMENT included — the slot is locked while the
 * Stripe PaymentIntent is alive).
 */
export type EngineBooking = {
  /** Booking id. Optional so fixtures can omit it; the DB loader always sets it.
   * Used to exclude a booking from its own occupancy check when rescheduling
   * (F-157), so a move onto a slot overlapping its current time isn't a
   * self-collision. */
  id?: string;
  instructorId: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  status: BookingStatus;
};

export type EngineSeason = {
  startDate: Date;
  endDate: Date;
  active: boolean;
  anchorTimes: string[];
  operatingHoursStart: string;
  operatingHoursEnd: string;
};

export type EngineContext = {
  /** Reference "current time" — keeps the engine deterministic in tests. */
  now: Date;
  /** Active season covering the queried range. `null` means no operations. */
  season: EngineSeason | null;
  instructors: EngineInstructor[];
  availabilityBlocks: EngineAvailabilityBlock[];
  bookings: EngineBooking[];
};

export type CalendarDay = {
  /** ISO yyyy-mm-dd. */
  date: string;
  hasAvailability: boolean;
  instructorCount: number;
};

export type SlotInstructor = Pick<
  EngineInstructor,
  "id" | "name" | "photo" | "specialties" | "languages"
>;

export type SlotAnchor = {
  time: string;
  available: boolean;
  instructors: SlotInstructor[];
};

export type SlotsForDate = {
  date: string;
  anchorTimes: SlotAnchor[];
};
