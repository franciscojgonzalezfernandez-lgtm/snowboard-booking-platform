import {
  PrismaClient,
  AvailabilityKind,
  BookingStatus,
  CreditReason,
  CreditStatus,
  Duration,
  Level,
  Locale,
  Role,
  type AvailabilityBlock,
  type Instructor,
  type Season,
  type User,
} from "@prisma/client";

const prisma = new PrismaClient();

const OWNER_EMAIL = "franciscojgonzalezfernandez@gmail.com";
const LARA_EMAIL = "lara@rideflumserberg.ch";
const SEED_BOOKER_EMAIL = "student+seed@rideflumserberg.ch";
// A second booker with a *finished* history — completed classes carrying
// instructor notes (from both coaches), a future booking, and a cancellation
// with leftover credit. Feeds the admin student directory (F-087) so the list,
// the profile's notes timeline, and the lifetime stats all have real content.
const HISTORY_BOOKER_EMAIL = "student+history@rideflumserberg.ch";
const SEASON_NAME = "Season 26/27";
const SEED_WEEKS = 8;
const SEED_BOOKING_PREFIX = "seed-f036-";
const SEED_HISTORY_PREFIX = "seed-f087-";

const DAY_MS = 24 * 60 * 60 * 1000;

// Initial CHF prices in cents, VAT-inclusive. Locked in Sprint 2 planning
// (2026-05-19). Mirrored into Season.priceCentsByDuration by upsertSeason()
// so the app reads the same values from DB; admin editor in Sprint 4 will
// rewrite the row, this object only exists for the seed booking totals.
const INITIAL_PRICE_CENTS: Record<Duration, number> = {
  ONE_HOUR: 11_000,
  TWO_HOURS: 20_000,
  INTENSIVE: 38_500,
  FULL_DAY: 50_000,
};

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function setUtcTime(base: Date, hhmm: string): Date {
  const [hStr, mStr] = hhmm.split(":");
  if (!hStr || !mStr) throw new Error(`Invalid HH:MM time: "${hhmm}"`);
  const out = new Date(base);
  out.setUTCHours(Number(hStr), Number(mStr), 0, 0);
  return out;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function upsertOwner(): Promise<User> {
  return prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {
      name: "Javi",
      phone: "+41 766381870",
      locale: Locale.en,
      roles: [Role.student, Role.instructor, Role.admin],
      emailVerified: true,
    },
    create: {
      email: OWNER_EMAIL,
      name: "Javi",
      phone: "+41 766381870",
      locale: Locale.en,
      roles: [Role.student, Role.instructor, Role.admin],
      emailVerified: true,
    },
  });
}

async function upsertOwnerInstructor(userId: string): Promise<Instructor> {
  const bio = [
    "Snowboarding is amazing. It has given me many friends, emotions, experiences, and a lot of self-knowledge.",
    "I live it with passion, and that same passion is what I try to share in my lessons.",
    "I come from acrobatic sports like parkour and tricking, so my favorite part of snowboarding is freestyle.",
    "I spend the day at the snowpark, although, who says no to some good carving dragging your elbow?",
    "If you want to improve your carving, get started with freestyle, or simply catch some of how I feel about snowboarding, see you on the slopes!",
  ].join(" ");

  const specialties = [
    "beginner-friendly",
    "freestyle",
    "powder",
    "race-carving",
    "kids-4-12",
    "special-needs",
  ];

  return prisma.instructor.upsert({
    where: { userId },
    update: {
      photo: "/instructors/javi.png",
      bio,
      specialties,
      languages: [Locale.en, Locale.de, Locale.es],
      active: true,
      acceptsSameDayIfBooked: false,
      calendarConnected: false,
    },
    create: {
      userId,
      photo: "/instructors/javi.png",
      bio,
      specialties,
      languages: [Locale.en, Locale.de, Locale.es],
      active: true,
      acceptsSameDayIfBooked: false,
      calendarConnected: false,
    },
  });
}

async function upsertLaraUser(): Promise<User> {
  return prisma.user.upsert({
    where: { email: LARA_EMAIL },
    update: {
      name: "Lara Müller",
      locale: Locale.de,
      roles: [Role.instructor],
      emailVerified: true,
    },
    create: {
      email: LARA_EMAIL,
      name: "Lara Müller",
      locale: Locale.de,
      roles: [Role.instructor],
      emailVerified: true,
    },
  });
}

async function upsertLaraInstructor(userId: string): Promise<Instructor> {
  const bio = [
    "Grew up between Zurich and the Bündner alps, snowboarding since I was nine.",
    "Carving and freeride are my home turf — kids and intermediates progress fast with me because I keep drills short and feedback specific.",
    "Lessons run mostly in German; happy to switch to English if it helps the rider relax.",
  ].join(" ");

  const specialties = [
    "beginner-friendly",
    "intermediate-progression",
    "carving",
    "freeride",
    "kids-4-12",
  ];

  return prisma.instructor.upsert({
    where: { userId },
    update: {
      bio,
      specialties,
      languages: [Locale.de, Locale.en],
      active: true,
      acceptsSameDayIfBooked: false,
      calendarConnected: false,
    },
    create: {
      userId,
      bio,
      specialties,
      languages: [Locale.de, Locale.en],
      active: true,
      acceptsSameDayIfBooked: false,
      calendarConnected: false,
    },
  });
}

async function upsertSeedBooker(): Promise<User> {
  return prisma.user.upsert({
    where: { email: SEED_BOOKER_EMAIL },
    update: {
      name: "Sam Booker",
      locale: Locale.en,
      roles: [Role.student],
      emailVerified: true,
    },
    create: {
      email: SEED_BOOKER_EMAIL,
      name: "Sam Booker",
      locale: Locale.en,
      roles: [Role.student],
      emailVerified: true,
    },
  });
}

async function upsertSeason(): Promise<Season> {
  const existing = await prisma.season.findFirst({ where: { name: SEASON_NAME } });
  const data = {
    name: SEASON_NAME,
    startDate: dateOnly("2026-11-15"),
    endDate: dateOnly("2027-04-30"),
    active: true,
    anchorTimes: [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
    ],
    operatingHoursStart: "08:00",
    operatingHoursEnd: "17:00",
    priceCentsByDuration: INITIAL_PRICE_CENTS,
  };
  if (existing) {
    return prisma.season.update({ where: { id: existing.id }, data });
  }
  return prisma.season.create({ data });
}

async function reseedAvailability(
  instructor: Instructor,
  season: Season,
): Promise<AvailabilityBlock[]> {
  const start = dateOnly("2026-11-15");
  const end = new Date(start.getTime() + SEED_WEEKS * 7 * DAY_MS);

  await prisma.availabilityBlock.deleteMany({
    where: {
      instructorId: instructor.id,
      startDateTime: { gte: start, lt: end },
    },
  });

  const blocks: {
    instructorId: string;
    startDateTime: Date;
    endDateTime: Date;
    kind: AvailabilityKind;
  }[] = [];
  for (let i = 0; i < SEED_WEEKS * 7; i++) {
    const day = new Date(start.getTime() + i * DAY_MS);
    if (day > season.endDate) break;
    blocks.push({
      instructorId: instructor.id,
      startDateTime: setUtcTime(day, season.operatingHoursStart),
      endDateTime: setUtcTime(day, season.operatingHoursEnd),
      kind: AvailabilityKind.AVAILABLE,
    });
  }

  await prisma.availabilityBlock.createMany({ data: blocks });

  return prisma.availabilityBlock.findMany({
    where: {
      instructorId: instructor.id,
      startDateTime: { gte: start, lt: end },
    },
    orderBy: { startDateTime: "asc" },
  });
}

type SeedBookingPlan = {
  instructor: Instructor;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
};

const SATURATED_DAY = dateOnly("2026-12-02"); // Wednesday — both instructors @ 15:00

function buildBookingPlan(javi: Instructor, lara: Instructor): SeedBookingPlan[] {
  const plan: SeedBookingPlan[] = [];
  const start = dateOnly("2026-11-15");

  for (let i = 0; i < SEED_WEEKS * 7; i++) {
    const day = new Date(start.getTime() + i * DAY_MS);

    // Lara: 09:00 every single seeded day.
    plan.push({
      instructor: lara,
      date: day,
      anchorTime: "09:00",
      duration: Duration.ONE_HOUR,
      language: Locale.de,
    });

    // Javi: 13:00 every Wednesday (UTC day 3 = Wed).
    if (day.getUTCDay() === 3) {
      plan.push({
        instructor: javi,
        date: day,
        anchorTime: "13:00",
        duration: Duration.ONE_HOUR,
        language: Locale.en,
      });
    }

    // Saturated day: both instructors at 15:00 on 2026-12-02.
    if (day.getTime() === SATURATED_DAY.getTime()) {
      plan.push({
        instructor: javi,
        date: day,
        anchorTime: "15:00",
        duration: Duration.ONE_HOUR,
        language: Locale.en,
      });
      plan.push({
        instructor: lara,
        date: day,
        anchorTime: "15:00",
        duration: Duration.ONE_HOUR,
        language: Locale.de,
      });
    }
  }

  return plan;
}

async function reseedBookings(
  javi: Instructor,
  lara: Instructor,
  booker: User,
): Promise<{ created: number; confirmed: number; pendingPayment: number }> {
  // Wipe previous seed-owned bookings (idempotency). Attendees cascade via FK.
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: SEED_BOOKING_PREFIX } },
  });

  const plan = buildBookingPlan(javi, lara);
  let confirmed = 0;
  let pendingPayment = 0;

  for (const [index, entry] of plan.entries()) {
    // Alternate CONFIRMED and PENDING_PAYMENT to exercise both engine paths.
    const status =
      index % 2 === 0 ? BookingStatus.CONFIRMED : BookingStatus.PENDING_PAYMENT;
    if (status === BookingStatus.CONFIRMED) confirmed += 1;
    else pendingPayment += 1;

    const icsUid = [
      SEED_BOOKING_PREFIX,
      entry.instructor.id.slice(-6),
      "-",
      isoDate(entry.date),
      "-",
      entry.anchorTime.replace(":", ""),
    ].join("");

    await prisma.booking.create({
      data: {
        bookerId: booker.id,
        instructorId: entry.instructor.id,
        date: entry.date,
        anchorTime: entry.anchorTime,
        duration: entry.duration,
        language: entry.language,
        status,
        totalPriceCents: INITIAL_PRICE_CENTS[entry.duration],
        icsUid,
        attendees: {
          create: [
            {
              name: "Sam Booker",
              birthDate: dateOnly("1995-06-12"),
              level: Level.INTERMEDIATE,
              isBooker: true,
            },
          ],
        },
      },
    });
  }

  return { created: plan.length, confirmed, pendingPayment };
}

async function upsertHistoryBooker(): Promise<User> {
  return prisma.user.upsert({
    where: { email: HISTORY_BOOKER_EMAIL },
    update: {
      name: "Mia Veteran",
      locale: Locale.de,
      phone: "+41 79 555 01 02",
      roles: [Role.student],
      emailVerified: true,
    },
    create: {
      email: HISTORY_BOOKER_EMAIL,
      name: "Mia Veteran",
      locale: Locale.de,
      phone: "+41 79 555 01 02",
      roles: [Role.student],
      emailVerified: true,
    },
  });
}

type HistoryPlanEntry = {
  instructor: Instructor;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  status: BookingStatus;
  note?: string;
};

// Real student history for the F-087 directory. Past, COMPLETED classes carry
// notes from both coaches (so the timeline must attribute authors), plus one
// future CONFIRMED class and one cancellation that leaves an ACTIVE credit.
async function reseedStudentHistory(
  javi: Instructor,
  lara: Instructor,
  booker: User,
): Promise<{ created: number; completed: number; notes: number; creditCents: number }> {
  // Credits FK-reference bookings, so wipe credits before the bookings they
  // point at. Both are scoped to this fixture's icsUid prefix (idempotent).
  await prisma.accountCredit.deleteMany({
    where: { sourceBooking: { icsUid: { startsWith: SEED_HISTORY_PREFIX } } },
  });
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: SEED_HISTORY_PREFIX } },
  });

  const plan: HistoryPlanEntry[] = [
    {
      instructor: lara,
      date: dateOnly("2026-02-10"),
      anchorTime: "10:00",
      duration: Duration.ONE_HOUR,
      language: Locale.de,
      status: BookingStatus.COMPLETED,
      note: "Solid toeside; next time work on switch riding.",
    },
    {
      instructor: javi,
      date: dateOnly("2026-03-05"),
      anchorTime: "13:00",
      duration: Duration.TWO_HOURS,
      language: Locale.en,
      status: BookingStatus.COMPLETED,
      note: "Linked turns on red runs — confidence clearly up.",
    },
    {
      instructor: lara,
      date: dateOnly("2026-03-20"),
      anchorTime: "09:00",
      duration: Duration.INTENSIVE,
      language: Locale.de,
      status: BookingStatus.COMPLETED,
      note: "Carving clean; ready for steeper terrain.",
    },
    {
      instructor: javi,
      date: dateOnly("2026-12-09"),
      anchorTime: "11:00",
      duration: Duration.ONE_HOUR,
      language: Locale.en,
      status: BookingStatus.CONFIRMED,
    },
    {
      instructor: lara,
      date: dateOnly("2026-01-15"),
      anchorTime: "14:00",
      duration: Duration.ONE_HOUR,
      language: Locale.de,
      status: BookingStatus.CANCELLED_BY_USER,
    },
  ];

  let completed = 0;
  let notes = 0;
  let cancelledBookingId: string | null = null;

  for (const [index, entry] of plan.entries()) {
    const icsUid = [
      SEED_HISTORY_PREFIX,
      isoDate(entry.date),
      "-",
      entry.anchorTime.replace(":", ""),
      "-",
      String(index),
    ].join("");

    const created = await prisma.booking.create({
      data: {
        bookerId: booker.id,
        instructorId: entry.instructor.id,
        date: entry.date,
        anchorTime: entry.anchorTime,
        duration: entry.duration,
        language: entry.language,
        status: entry.status,
        totalPriceCents: INITIAL_PRICE_CENTS[entry.duration],
        instructorNote: entry.note ?? null,
        instructorNoteSetAt: entry.note ? setUtcTime(entry.date, "18:00") : null,
        icsUid,
        attendees: {
          create: [
            {
              name: "Mia Veteran",
              birthDate: dateOnly("1998-03-22"),
              level: Level.ADVANCED,
              isBooker: true,
            },
          ],
        },
      },
      select: { id: true },
    });

    if (entry.status === BookingStatus.COMPLETED) completed += 1;
    if (entry.note) notes += 1;
    if (entry.status === BookingStatus.CANCELLED_BY_USER) cancelledBookingId = created.id;
  }

  let creditCents = 0;
  if (cancelledBookingId) {
    creditCents = INITIAL_PRICE_CENTS.ONE_HOUR;
    await prisma.accountCredit.create({
      data: {
        userId: booker.id,
        amountCents: creditCents,
        sourceBookingId: cancelledBookingId,
        reason: CreditReason.USER_CANCEL,
        status: CreditStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 365 * DAY_MS),
      },
    });
  }

  return { created: plan.length, completed, notes, creditCents };
}

// Production-seed guard (added after the main branch was seeded by accident).
// This seed is destructive: it deleteMany's AvailabilityBlock/Booking rows and
// overwrites the owner/instructor profiles. It must NEVER hit the Neon `main`
// branch (production, https://rideflumserberg.ch) unless the operator opts in
// explicitly with ALLOW_PRODUCTION_SEED=true. Local/dev work targets the Neon
// `dev` branch.
const PRODUCTION_DB_HOST_FRAGMENT = "ep-twilight-night-aj1cbb6k";

function assertNotProduction(): void {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    host = "";
  }

  const targetsProduction = host.includes(PRODUCTION_DB_HOST_FRAGMENT);
  if (targetsProduction && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      [
        "Refusing to seed: DATABASE_URL points at PRODUCTION (Neon `main`).",
        `  host: ${host || "<unparseable DATABASE_URL>"}`,
        "",
        "This seed wipes availability + bookings and overwrites instructor profiles.",
        "If you truly intend to seed production, re-run with ALLOW_PRODUCTION_SEED=true.",
        "For local/dev work, point DATABASE_URL at the Neon `dev` endpoint",
        "(ep-proud-block-ajbk5wz5) before seeding.",
      ].join("\n"),
    );
  }
}

async function main() {
  assertNotProduction();

  const owner = await upsertOwner();
  const javi = await upsertOwnerInstructor(owner.id);
  const laraUser = await upsertLaraUser();
  const lara = await upsertLaraInstructor(laraUser.id);
  const booker = await upsertSeedBooker();
  const historyBooker = await upsertHistoryBooker();
  const season = await upsertSeason();

  const javiBlocks = await reseedAvailability(javi, season);
  const laraBlocks = await reseedAvailability(lara, season);
  const bookings = await reseedBookings(javi, lara, booker);
  const studentHistory = await reseedStudentHistory(javi, lara, historyBooker);

  console.log(
    JSON.stringify(
      {
        seeded: {
          users: {
            owner: { id: owner.id, email: owner.email },
            lara: { id: laraUser.id, email: laraUser.email },
            booker: { id: booker.id, email: booker.email },
            historyBooker: { id: historyBooker.id, email: historyBooker.email },
          },
          instructors: {
            javi: {
              id: javi.id,
              languages: javi.languages.length,
              specialties: javi.specialties.length,
            },
            lara: {
              id: lara.id,
              languages: lara.languages.length,
              specialties: lara.specialties.length,
            },
          },
          season: {
            id: season.id,
            name: season.name,
            anchorTimes: season.anchorTimes.length,
          },
          availabilityBlocks: {
            javi: javiBlocks.length,
            lara: laraBlocks.length,
          },
          bookings,
          studentHistory,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
