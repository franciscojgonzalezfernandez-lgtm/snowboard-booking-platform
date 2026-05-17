import { Duration } from "@prisma/client";

const MINUTES: Record<Duration, number> = {
  ONE_HOUR: 60,
  TWO_HOURS: 120,
  INTENSIVE: 240,
  FULL_DAY: 360,
};

export function durationMinutes(duration: Duration): number {
  return MINUTES[duration];
}
