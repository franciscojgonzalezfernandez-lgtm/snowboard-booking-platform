import { test, expect, type Page } from "@playwright/test";
import { signUpVerified } from "./helpers/auth";
import { config as loadDotenv } from "dotenv";
import {
  PrismaClient,
  BookingStatus,
  Duration,
  Role,
} from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { resolvePriceCents } from "@/lib/pricing/get-price";
import { formatChf } from "@/lib/pricing/format";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const CODE_PREFIX = "F155"; // all codes this spec creates start with this
const ONE_HOUR_PRICE_CENTS = 11000; // from prisma/seed.ts (CHF 110.00)

const WINDOW_START = new Date("2026-11-17T00:00:00.000Z"); // Tuesday
const WINDOW_END = new Date("2027-01-08T00:00:00.000Z");
const ANCHORS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

type Slot = { date: string; time: string };

const createdUserIds: string[] = [];
let instructorId: string;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

async function findFreeSlots(count: number): Promise<Slot[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      instructorId,
      status: {
        in: [
          BookingStatus.PENDING_PAYMENT,
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
        ],
      },
    },
    select: { date: true, anchorTime: true, duration: true },
  });
  const occupied = new Map<string, Array<[number, number]>>();
  for (const b of bookings) {
    const key = b.date.toISOString().slice(0, 10);
    const start = toMinutes(b.anchorTime);
    const arr = occupied.get(key) ?? [];
    arr.push([start, start + durationMinutes(b.duration)]);
    occupied.set(key, arr);
  }

  const slots: Slot[] = [];
  for (
    const day = new Date(WINDOW_START);
    day <= WINDOW_END && slots.length < count;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const iso = day.toISOString().slice(0, 10);
    const wd = day.getUTCDay();
    if (wd === 0 || wd === 1) continue; // closed Sun + Mon
    if (iso >= "2026-12-28" && iso <= "2027-01-08") continue; // holiday break
    const taken = occupied.get(iso) ?? [];
    for (const anchor of ANCHORS) {
      const start = toMinutes(anchor);
      const conflict = taken.some(([bs, be]) => start < be && bs < start + 60);
      if (!conflict) {
        slots.push({ date: iso, time: anchor });
        break;
      }
    }
  }
  if (slots.length < count) {
    throw new Error(`Only found ${slots.length}/${count} free slots`);
  }
  return slots;
}

function uniqueEmail(tag: string): string {
  return `f155-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await signUpVerified(page, email, "F155 Tester");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  createdUserIds.push(user.id);
  return user.id;
}

async function signUpAsAdmin(page: Page): Promise<string> {
  const userId = await signUp(page, "admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.admin] },
  });
  return userId;
}

async function seedCode(data: {
  code: string;
  percentOff?: number;
  amountOffCents?: number;
  maxRedemptions?: number;
  active?: boolean;
}): Promise<void> {
  await prisma.discountCode.create({
    data: {
      code: data.code,
      percentOff: data.percentOff ?? null,
      amountOffCents: data.amountOffCents ?? null,
      maxRedemptions: data.maxRedemptions ?? null,
      active: data.active ?? true,
    },
  });
}

// The promo input is a controlled React input, so a `fill` that lands in the
// brief pre-hydration window is dropped when the island hydrates with its empty
// initial state (the RHF booker fields don't hit this — they're uncontrolled).
// Retry the fill until React has captured the value and the Apply button
// enables, then click it.
async function applyPromo(page: Page, code: string): Promise<void> {
  const input = page.getByTestId("step4-promo-input");
  const apply = page.getByTestId("step4-promo-apply");
  await expect(async () => {
    await input.fill(code);
    await expect(apply).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await apply.click();
}

async function fillStep4Form(page: Page): Promise<void> {
  await expect(page.getByTestId("step4-form")).toBeVisible();
  await page.getByTestId("booker-name").fill("F155 Tester");
  await page.getByTestId("booker-phone").fill("+41 76 638 1870");
  await page.getByTestId("attendee-0-name").fill("Lara");
  await page.getByTestId("attendee-0-age").fill("28");
  await page.getByTestId("terms-checkbox").click();
  await expect(page.getByTestId("step4-submit")).toBeEnabled();
}

function bookingUrl(slot: Slot): string {
  const url = new URL("http://localhost/en/reservar");
  url.searchParams.set("d", "ONE_HOUR");
  url.searchParams.set("dt", slot.date);
  url.searchParams.set("t", slot.time);
  url.searchParams.set("i", instructorId);
  url.searchParams.set("l", "en");
  return url.pathname + url.search;
}

test.beforeAll(async () => {
  const instructor = await prisma.instructor.findFirst({
    where: { active: true, languages: { has: "en" } },
    select: { id: true },
  });
  if (!instructor) throw new Error("No active en-speaking instructor seeded");
  instructorId = instructor.id;
});

test.afterAll(async () => {
  // FK order: bookings reference discountCode (RESTRICT) + attendees restrict
  // their booking — clear attendees + bookings first, then the codes.
  if (createdUserIds.length > 0) {
    await prisma.attendee.deleteMany({
      where: { booking: { bookerId: { in: createdUserIds } } },
    });
    await prisma.booking.deleteMany({
      where: { bookerId: { in: createdUserIds } },
    });
  }
  await prisma.discountCode.deleteMany({
    where: { code: { startsWith: CODE_PREFIX } },
  });
  await prisma.$disconnect();
});

test.describe.configure({ mode: "serial" });

test.describe("F-155 admin discount codes", () => {
  test("non-admin gets 404 on /admin/discount-codes", async ({ page }) => {
    await signUp(page, "student");
    const res = await page.goto("/admin/discount-codes");
    expect(res?.status()).toBe(404);
  });

  test("admin creates a percentage code → it appears in the list and in the DB", async ({
    page,
  }) => {
    await signUpAsAdmin(page);
    await page.goto("/admin/discount-codes");

    await page.getByTestId("discount-new").click();
    await expect(page.getByTestId("discount-create-dialog")).toBeVisible();

    const code = `${CODE_PREFIX}UI10`;
    await page.getByTestId("discount-code").fill(code);
    await page.getByTestId("discount-type-percent").click();
    await page.getByTestId("discount-percent").fill("10");
    await page.getByTestId("discount-submit").click();

    await expect(page.getByTestId("discount-codes-list")).toContainText(code);
    const inDb = await prisma.discountCode.findUnique({
      where: { code },
      select: { percentOff: true, amountOffCents: true, active: true },
    });
    expect(inDb).toMatchObject({ percentOff: 10, amountOffCents: null, active: true });
  });

  test("admin can deactivate a code", async ({ page }) => {
    await seedCode({ code: `${CODE_PREFIX}TOGGLE`, percentOff: 15 });
    const row = await prisma.discountCode.findUnique({
      where: { code: `${CODE_PREFIX}TOGGLE` },
      select: { id: true },
    });
    const id = row!.id;

    await signUpAsAdmin(page);
    await page.goto("/admin/discount-codes");
    await page.getByTestId(`discount-toggle-${id}`).click();
    await expect(page.getByTestId(`discount-badge-inactive-${id}`)).toBeVisible();

    const after = await prisma.discountCode.findUnique({
      where: { id },
      select: { active: true },
    });
    expect(after?.active).toBe(false);
  });
});

test.describe("F-155 promo code in the booking funnel", () => {
  test("applying a 10% code shows the discount and reduces the charge", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await seedCode({ code: `${CODE_PREFIX}PCT`, percentOff: 10 });
    await signUp(page, "pct");
    const [slot] = await findFreeSlots(1);

    await page.goto(bookingUrl(slot!), { waitUntil: "domcontentloaded" });

    // Apply the code (case-insensitive input).
    await applyPromo(page, "f155pct");
    await expect(page.getByTestId("step4-promo-applied")).toBeVisible();
    await expect(page.getByTestId("step4-promo-code")).toHaveText("F155PCT");

    await fillStep4Form(page);
    await page.getByTestId("step4-submit").click();

    // Compute the expected amounts from the live active season (it may carry an
    // F-141 promo, so the discount applies to the EFFECTIVE price — don't
    // hard-code CHF 110).
    const season = await prisma.season.findFirst({
      where: { active: true },
      select: {
        id: true,
        priceCentsByDuration: true,
        promoPriceCentsByDuration: true,
      },
    });
    const priceCents = resolvePriceCents(season as never, Duration.ONE_HOUR).cents;
    const discountCents = Math.floor(priceCents * 0.1);
    const chargeCents = priceCents - discountCents;

    // Step 5 reveals Lesson price − Promo = To pay.
    await expect(page.getByTestId("section-5")).toBeVisible();
    await expect(page.getByTestId("step5-summary-promo")).toContainText(
      formatChf(discountCents),
    );
    await expect(page.getByTestId("step5-summary-charge")).toContainText(
      formatChf(chargeCents),
    );
  });

  test("an inactive code is rejected with an inline error", async ({ page }) => {
    await seedCode({ code: `${CODE_PREFIX}OFF`, percentOff: 10, active: false });
    await signUp(page, "inactive");
    const [slot] = await findFreeSlots(1);

    await page.goto(bookingUrl(slot!), { waitUntil: "domcontentloaded" });

    await applyPromo(page, `${CODE_PREFIX}OFF`);
    await expect(page.getByTestId("step4-promo-error")).toBeVisible();
    await expect(page.getByTestId("step4-promo-applied")).toHaveCount(0);
  });

  test("a 100%-off code confirms the booking with no card", async ({ page }) => {
    test.setTimeout(60_000);
    await seedCode({ code: `${CODE_PREFIX}FREE`, percentOff: 100 });
    await signUp(page, "free");
    const [slot] = await findFreeSlots(1);

    await page.goto(bookingUrl(slot!), { waitUntil: "domcontentloaded" });

    await applyPromo(page, `${CODE_PREFIX}FREE`);
    await expect(page.getByTestId("step4-promo-applied")).toBeVisible();

    await fillStep4Form(page);
    // A 100%-off code drives the charge to 0 → the server takes the zero-charge
    // path (CONFIRMED, no PaymentIntent) and the client redirects straight to the
    // success page. (The pre-submit CTA label is a client-only preview and can
    // lag under an active season promo, so we assert the authoritative outcome.)
    await page.getByTestId("step4-submit").click();

    await page.waitForURL(/\/en\/reservar\/exito\//);
    await expect(page.getByTestId("exito-page")).toHaveAttribute(
      "data-status",
      "CONFIRMED",
    );
    await expect(page.getByTestId("payment-element")).toHaveCount(0);
  });
});
