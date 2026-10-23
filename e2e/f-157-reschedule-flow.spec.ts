import { test, expect } from "@playwright/test";
import { signUpVerified } from "./helpers/auth";
import { config as loadDotenv } from "dotenv";
import {
  PrismaClient,
  AvailabilityKind,
  BookingStatus,
  Duration,
  Level,
  Locale as DbLocale,
} from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-157-";
const PRICE_CENTS = 11000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_ANCHORS = ["13:00", "14:00", "15:00", "11:00", "16:00"];

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

type SeasonInfo = {
  startDate: Date;
  endDate: Date;
  operatingHoursEnd: string;
};

type FreeSlot = { date: string; anchor: string };

/** Find a genuinely free ONE_HOUR slot ≥5 days out and in-season by querying the
 * DB the same way the live engine does (covering AVAILABLE block, no BLOCKED
 * overlap, no occupying booking). Deterministic — avoids the cached slots API,
 * which can disagree with the action's live re-check. Null if nothing is free. */
async function findFreeSlot(
  season: SeasonInfo,
  instructorId: string,
): Promise<FreeSlot | null> {
  const opsEnd = hhmmToMin(season.operatingHoursEnd);
  // Start the search 2 days past the seeded current lesson so the move lands on
  // a different day (a stronger assertion than a same-day time change).
  const start = new Date(
    Math.max(Date.now() + 5 * DAY_MS, season.startDate.getTime()) + 2 * DAY_MS,
  );
  const windowEnd = new Date(start.getTime() + 26 * DAY_MS);
  const [blocks, bookings] = await Promise.all([
    prisma.availabilityBlock.findMany({
      where: {
        instructorId,
        startDateTime: { lt: windowEnd },
        endDateTime: { gt: start },
      },
      select: { startDateTime: true, endDateTime: true, kind: true },
    }),
    prisma.booking.findMany({
      where: {
        instructorId,
        date: { gte: start, lte: windowEnd },
        status: {
          in: [
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.CONFIRMED,
            BookingStatus.COMPLETED,
          ],
        },
      },
      select: { date: true, anchorTime: true, duration: true },
    }),
  ]);

  const durMin: Record<Duration, number> = {
    ONE_HOUR: 60,
    TWO_HOURS: 120,
    INTENSIVE: 240,
    FULL_DAY: 360,
  };

  for (let i = 0; i < 25; i++) {
    const day = new Date(start.getTime() + i * DAY_MS);
    if (day.getTime() > season.endDate.getTime()) break;
    const iso = toIso(day);
    const dayMs = new Date(`${iso}T00:00:00.000Z`).getTime();

    for (const anchor of CANDIDATE_ANCHORS) {
      const slotStart = dayMs + hhmmToMin(anchor) * 60_000;
      const slotEnd = slotStart + 60 * 60_000;
      if (hhmmToMin(anchor) + 60 > opsEnd) continue;

      const covered = blocks.some(
        (b) =>
          b.kind === AvailabilityKind.AVAILABLE &&
          b.startDateTime.getTime() <= slotStart &&
          b.endDateTime.getTime() >= slotEnd,
      );
      if (!covered) continue;
      const blocked = blocks.some(
        (b) =>
          b.kind === AvailabilityKind.BLOCKED &&
          b.startDateTime.getTime() < slotEnd &&
          b.endDateTime.getTime() > slotStart,
      );
      if (blocked) continue;
      const taken = bookings.some((bk) => {
        const bkDay = new Date(toIso(bk.date) + "T00:00:00.000Z").getTime();
        const bkStart = bkDay + hhmmToMin(bk.anchorTime) * 60_000;
        const bkEnd = bkStart + durMin[bk.duration] * 60_000;
        return bkStart < slotEnd && slotStart < bkEnd;
      });
      if (taken) continue;

      return { date: iso, anchor };
    }
  }
  return null;
}

test.afterAll(async () => {
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.$disconnect();
});

function uniqueEmail(tag: string) {
  return `f157-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function findUserIdByEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  return user.id;
}

async function activeSeason(): Promise<SeasonInfo | null> {
  return prisma.season.findFirst({
    where: { active: true },
    select: { startDate: true, endDate: true, operatingHoursEnd: true },
  });
}

async function pickInstructorId(): Promise<string> {
  const instructor = await prisma.instructor.findFirst({
    where: { active: true },
    select: { id: true },
  });
  if (!instructor) throw new Error("No active instructor seeded");
  return instructor.id;
}

async function seedConfirmed(
  userId: string,
  instructorId: string,
  isoDate: string,
  anchor: string,
): Promise<string> {
  const uid = `${ICS_UID_PREFIX}${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const booking = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: new Date(`${isoDate}T00:00:00.000Z`),
      anchorTime: anchor,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.CONFIRMED,
      totalPriceCents: PRICE_CENTS,
      paidAt: new Date("2026-05-01T10:00:00.000Z"),
      icsUid: uid,
      attendees: {
        create: [
          {
            name: "F-157 Tester",
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            level: Level.INTERMEDIATE,
            isBooker: true,
          },
        ],
      },
    },
    select: { id: true },
  });
  return booking.id;
}

test.describe("F-157 — Reschedule (move) a booking", () => {
  test("moves a confirmed booking to a new slot, keeping the price", async ({
    page,
  }) => {
    const season = await activeSeason();
    test.skip(!season, "No active season seeded");
    const instructorId = await pickInstructorId();

    const slot = await findFreeSlot(season!, instructorId);
    test.skip(!slot, "No free ONE_HOUR slot available in the active season");
    const { date: newDate, anchor: newAnchor } = slot!;

    // A current lesson ≥48h out (its own date needn't be bookable — it already
    // exists). The 09:00 anchor never clashes with the ≥11:00 target slot.
    const currentDate = toIso(
      new Date(Math.max(Date.now() + 5 * DAY_MS, season!.startDate.getTime())),
    );

    const email = uniqueEmail("move");
    await signUpVerified(page, email, "F157 Tester");
    const userId = await findUserIdByEmail(email);
    const bookingId = await seedConfirmed(
      userId,
      instructorId,
      currentDate,
      "09:00",
    );

    // 1) Dashboard → open actions → "Move lesson" enters reschedule mode.
    await page.goto("/en/dashboard");
    const row = page
      .getByTestId("dashboard-bookings-upcoming")
      .getByTestId("dashboard-booking-row");
    await expect(row).toHaveAttribute("data-booking-id", bookingId);

    await row.getByTestId("dashboard-booking-actions").click();
    await page.getByTestId("dashboard-booking-reschedule-trigger").click();

    await page.waitForURL(/reschedule=/);
    await expect(page.getByTestId("duration-locked-value")).toBeVisible();

    // 2) Jump to the chosen free slot (the calendar + time pickers are the
    // funnel's own, covered elsewhere) and confirm the move.
    await page.goto(
      `/en/reservar?reschedule=${bookingId}&d=ONE_HOUR&dt=${newDate}&t=${newAnchor}&i=${instructorId}&l=en`,
    );
    await expect(page.getByTestId("section-4-reschedule")).toBeVisible();
    await page.getByTestId("reschedule-confirm").click();

    // Settle on whichever happens first: navigation to the dashboard (success)
    // or the inline error (failure) — then assert it was the success.
    await Promise.race([
      page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {}),
      page
        .getByTestId("reschedule-error")
        .waitFor({ timeout: 15000 })
        .catch(() => {}),
    ]);
    await expect(page.getByTestId("reschedule-error")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard/);

    // DB: moved in place, price untouched, horizon anchor + count recorded.
    const moved = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        date: true,
        anchorTime: true,
        status: true,
        totalPriceCents: true,
        originalDate: true,
        rescheduleCount: true,
      },
    });
    expect(moved?.status).toBe(BookingStatus.CONFIRMED);
    expect(toIso(moved!.date)).toBe(newDate);
    expect(moved?.anchorTime).toBe(newAnchor);
    expect(moved?.totalPriceCents).toBe(PRICE_CENTS);
    expect(toIso(moved!.originalDate!)).toBe(currentDate);
    expect(moved?.rescheduleCount).toBe(1);
  });

  test("hides Move for a booking inside the 48h window", async ({ page }) => {
    const email = uniqueEmail("toolate");
    await signUpVerified(page, email, "F157 Late");
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();

    // ~34h out → inside the 48h window.
    const soon = toIso(new Date(Date.now() + DAY_MS));
    const bookingId = await seedConfirmed(userId, instructorId, soon, "10:00");

    await page.goto("/en/dashboard");
    const row = page
      .getByTestId("dashboard-bookings-upcoming")
      .getByTestId("dashboard-booking-row")
      .filter({ has: page.locator(`[data-booking-id="${bookingId}"]`) })
      .or(
        page
          .getByTestId("dashboard-bookings-upcoming")
          .locator(`[data-booking-id="${bookingId}"]`),
      );
    await expect(row.first()).toBeVisible();

    await page.getByTestId("dashboard-booking-actions").first().click();
    await expect(
      page.getByTestId("dashboard-booking-reschedule-disabled"),
    ).toBeVisible();
    await expect(
      page.getByTestId("dashboard-booking-reschedule-trigger"),
    ).toHaveCount(0);
  });
});
