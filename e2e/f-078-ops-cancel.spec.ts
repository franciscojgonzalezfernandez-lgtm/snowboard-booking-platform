import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  BookingStatus,
  CreditReason,
  CreditStatus,
  Duration,
  Level,
  Locale as DbLocale,
  PrismaClient,
  Role,
} from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const EMAIL_PREFIX = "f078-";

// We exercise the two paths that don't require live Stripe:
//   - credit re-emit (booking paid 100% with credits → no Stripe call, new
//     OPS_CANCEL credit row appears),
//   - PENDING_PAYMENT no-charge (LOCKED credits released, no credit emitted).
// The cash-refund Stripe path is covered by the Vitest core
// (`lib/booking/cancel-by-ops.test.ts`) where the `stripeRefund` dep is
// injected as a mock — driving a real PI here would require Stripe test
// fixtures we don't want in the smoke suite.

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, name: string): Promise<{ userId: string; email: string }> {
  const email = uniqueEmail("u");
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill(name);
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  return { userId: user.id, email };
}

async function signUpAsAdmin(
  page: Page,
): Promise<{ userId: string; email: string; instructorId: string }> {
  const { userId, email } = await signUp(page, "F078 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.instructor, Role.admin] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId,
      bio: "F078 admin-instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  return { userId, email, instructorId: instructor.id };
}

type SeedOpts = {
  instructorId: string;
  bookerId: string;
  status: BookingStatus;
  daysFromNow: number;
  anchorTime?: string;
  totalPriceCents: number;
  chargeAmountCents: number;
  creditsAppliedCents: number;
  paid: boolean;
};

async function seedBooking(opts: SeedOpts): Promise<string> {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + opts.daysFromNow),
  );
  const tag = Math.random().toString(36).slice(2, 8);
  const booking = await prisma.booking.create({
    data: {
      instructorId: opts.instructorId,
      bookerId: opts.bookerId,
      date,
      anchorTime: opts.anchorTime ?? "10:00",
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: opts.status,
      totalPriceCents: opts.totalPriceCents,
      chargeAmountCents: opts.chargeAmountCents,
      creditsAppliedCents: opts.creditsAppliedCents,
      paidAt: opts.paid ? new Date() : null,
      icsUid: `f078-${tag}@example.test`,
      attendees: {
        create: [
          {
            name: "Self",
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

test.afterAll(async () => {
  await prisma.accountCredit.deleteMany({
    where: { sourceBooking: { icsUid: { startsWith: "f078-" } } },
  });
  await prisma.attendee.deleteMany({
    where: { booking: { icsUid: { startsWith: "f078-" } } },
  });
  await prisma.booking.deleteMany({ where: { icsUid: { startsWith: "f078-" } } });
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
  await prisma.$disconnect();
});

test("ops-cancels a credit-paid booking → status flips + OPS_CANCEL credit re-emitted", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { userId: adminId, instructorId } = await signUpAsAdmin(page);

  const bookingId = await seedBooking({
    instructorId,
    bookerId: adminId,
    status: BookingStatus.CONFIRMED,
    daysFromNow: 7,
    totalPriceCents: 11000,
    chargeAmountCents: 0,
    creditsAppliedCents: 11000,
    paid: false,
  });

  await page.goto(`/admin/bookings/${bookingId}`);
  await expect(page.getByTestId("admin-detail-action-ops-cancel")).toBeEnabled();

  await page.getByTestId("admin-detail-action-ops-cancel").click();
  await expect(page.getByTestId("ops-cancel-dialog")).toBeVisible();
  await expect(page.getByTestId("ops-cancel-preview-credit")).toContainText("110");

  await page.getByTestId("ops-cancel-reason").fill("playwright smoke");
  await page.getByTestId("ops-cancel-dialog-confirm").click();

  // Server action returns and the page re-fetches the row.
  await expect(page.getByTestId("admin-booking-detail-status")).toHaveText(
    "Cancelled · ops",
    { timeout: 30_000 },
  );

  const after = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, cancelledByOpsAt: true, opsReason: true },
  });
  expect(after?.status).toBe(BookingStatus.CANCELLED_BY_OPS);
  expect(after?.cancelledByOpsAt).not.toBeNull();
  expect(after?.opsReason).toBe("playwright smoke");

  const credits = await prisma.accountCredit.findMany({
    where: { sourceBookingId: bookingId, reason: CreditReason.OPS_CANCEL },
    select: { amountCents: true, status: true },
  });
  expect(credits).toHaveLength(1);
  expect(credits[0]!.amountCents).toBe(11000);
  expect(credits[0]!.status).toBe(CreditStatus.ACTIVE);
});

test("ops-cancels a PENDING_PAYMENT booking → status flips, LOCKED credits released, no fresh credit", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { userId: adminId, instructorId } = await signUpAsAdmin(page);

  const bookingId = await seedBooking({
    instructorId,
    bookerId: adminId,
    status: BookingStatus.PENDING_PAYMENT,
    daysFromNow: 7,
    totalPriceCents: 11000,
    chargeAmountCents: 5000,
    creditsAppliedCents: 6000,
    paid: false,
  });

  // Mint a LOCKED credit pointed at this draft, so we can assert release.
  const sourceForLock = await seedBooking({
    instructorId,
    bookerId: adminId,
    status: BookingStatus.CANCELLED_BY_USER,
    daysFromNow: -30,
    totalPriceCents: 6000,
    chargeAmountCents: 6000,
    creditsAppliedCents: 0,
    paid: true,
  });
  const lockedCredit = await prisma.accountCredit.create({
    data: {
      userId: adminId,
      amountCents: 6000,
      sourceBookingId: sourceForLock,
      lockedByBookingId: bookingId,
      reason: CreditReason.USER_CANCEL,
      status: CreditStatus.LOCKED,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });

  await page.goto(`/admin/bookings/${bookingId}`);
  await page.getByTestId("admin-detail-action-ops-cancel").click();
  await expect(page.getByTestId("ops-cancel-dialog")).toBeVisible();
  await expect(page.getByTestId("ops-cancel-preview-none")).toBeVisible();
  await page.getByTestId("ops-cancel-dialog-confirm").click();

  await expect(page.getByTestId("admin-booking-detail-status")).toHaveText(
    "Cancelled · ops",
    { timeout: 30_000 },
  );

  // No fresh OPS_CANCEL credit minted.
  const freshCredits = await prisma.accountCredit.findMany({
    where: { sourceBookingId: bookingId, reason: CreditReason.OPS_CANCEL },
  });
  expect(freshCredits).toHaveLength(0);

  // LOCKED credit released to ACTIVE and unlocked from the booking.
  const after = await prisma.accountCredit.findUnique({
    where: { id: lockedCredit.id },
    select: { status: true, lockedByBookingId: true },
  });
  expect(after?.status).toBe(CreditStatus.ACTIVE);
  expect(after?.lockedByBookingId).toBeNull();
});
