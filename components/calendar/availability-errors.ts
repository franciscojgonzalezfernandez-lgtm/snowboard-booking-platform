import type { AvailabilityActionError } from "@/lib/instructor/availability-actions";

/**
 * User-facing copy for each availability action error, shared by the Month and
 * Week calendar surfaces (F-083) so the two views speak the same language.
 */
export const AVAILABILITY_ERROR_COPY: Record<AvailabilityActionError, string> = {
  INVALID_INPUT: "Check the dates and times, then try again.",
  NO_ACTIVE_SEASON: "No active season — set one up first.",
  RANGE_TOO_LONG: "That range is too long. Open at most a quarter at a time.",
  OUT_OF_HOURS: "That window falls outside the season's operating hours.",
  INVALID_RANGE: "The end must come after the start.",
  HAS_BOOKINGS: "This day has booked classes. Cancel them from the admin panel first.",
  NOT_FOUND: "That block no longer exists. Refreshing.",
  FORBIDDEN: "You can only edit this instructor's availability.",
};
