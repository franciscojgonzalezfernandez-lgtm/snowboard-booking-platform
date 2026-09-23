// Production-shaped seed: one instructor (Javi, the owner) + one active season,
// with season-long availability minus the days the school is closed. No demo
// bookings or fake students — the multi-instructor/demo scaffolding was removed
// when the seed was made prod-ready (F-154). Idempotent: safe to re-run.
import {
  PrismaClient,
  AvailabilityKind,
  Duration,
  Locale,
  Role,
  type AvailabilityBlock,
  type Instructor,
  type Season,
  type User,
} from "@prisma/client";

const prisma = new PrismaClient();

const OWNER_EMAIL = "franciscojgonzalezfernandez@gmail.com";
const SEASON_NAME = "Season 26/27";
// F-142: stable id for the migrated F-053 hero band so re-seeds are idempotent
// and never clobber the owner's later edits (update: {}).
const HERO_BANNER_ID = "seed_hero_default";
// The owner's operational phone as a tel: href (from lib/contact/phone.ts;
// inlined because the seed intentionally has no @/ alias imports).
const OPERATIONAL_PHONE_TEL = "+41766381870";

const DAY_MS = 24 * 60 * 60 * 1000;

// School is closed over the winter holidays: 2026-12-28 through 2027-01-08
// (inclusive). No availability blocks are emitted on these days.
const HOLIDAY_BREAK_START = dateOnly("2026-12-28");
const HOLIDAY_BREAK_END = dateOnly("2027-01-08");

// Initial CHF prices in cents, VAT-inclusive. Locked in Sprint 2 planning
// (2026-05-19). Mirrored into Season.priceCentsByDuration by upsertSeason()
// so the app reads the same values from DB; admin editor in Sprint 4 will
// rewrite the row — this object seeds the initial Season.priceCentsByDuration.
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

// Availability for the whole season, one full-day AVAILABLE block (08:00–17:00
// per Season.operatingHours) per open day. The school is closed on Sundays and
// Mondays and over the winter-holiday break, so those days simply get no block
// (absence = unbookable; the engine derives slots from Season.anchorTimes).
// Destructive + idempotent: it clears the instructor's blocks in the season
// window and rewrites them.
async function reseedAvailability(
  instructor: Instructor,
  season: Season,
): Promise<AvailabilityBlock[]> {
  const start = new Date(season.startDate.getTime());
  const endExclusive = new Date(season.endDate.getTime() + DAY_MS);

  await prisma.availabilityBlock.deleteMany({
    where: {
      instructorId: instructor.id,
      startDateTime: { gte: start, lt: endExclusive },
    },
  });

  const blocks: {
    instructorId: string;
    startDateTime: Date;
    endDateTime: Date;
    kind: AvailabilityKind;
  }[] = [];

  for (
    let day = new Date(start.getTime());
    day <= season.endDate;
    day = new Date(day.getTime() + DAY_MS)
  ) {
    // Dates are UTC-midnight (@db.Date), so getUTCDay() is the calendar weekday.
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 1) continue; // closed Sun + Mon
    if (day >= HOLIDAY_BREAK_START && day <= HOLIDAY_BREAK_END) continue; // holiday break

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
      startDateTime: { gte: start, lt: endExclusive },
    },
    orderBy: { startDateTime: "asc" },
  });
}

// Production-seed guard (added after the main branch was seeded by accident).
// This seed is destructive: it deleteMany's AvailabilityBlock rows and
// overwrites the owner/instructor profile. It must NEVER hit the Neon `main`
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
        "This seed wipes availability and overwrites the instructor profile.",
        "If you truly intend to seed production, re-run with ALLOW_PRODUCTION_SEED=true.",
        "For local/dev work, point DATABASE_URL at the Neon `dev` endpoint",
        "(ep-proud-block-ajbk5wz5) before seeding.",
      ].join("\n"),
    );
  }
}

// F-142: migrate the former F-053 messages-authored hero band into the AdBanner
// table as the first enabled banner. `update: {}` keeps a re-seed from
// overwriting whatever the owner has since edited in the admin panel.
async function reseedAdBanner() {
  return prisma.adBanner.upsert({
    where: { id: HERO_BANNER_ID },
    update: {},
    create: {
      id: HERO_BANNER_ID,
      enabled: true,
      sortIndex: 0,
      body: {
        en: "Planning a team or group day on the mountain? I run private sessions all winter.",
        de: "Team- oder Gruppentag am Berg geplant? Den ganzen Winter gebe ich private Kurse.",
        es: "¿Un día de equipo o grupo en la montaña? Doy clases privadas todo el invierno.",
      },
      ctaLabel: { en: "Get in touch", de: "Melde dich", es: "Escríbeme" },
      ctaHref: `tel:${OPERATIONAL_PHONE_TEL}`,
    },
  });
}

async function main() {
  assertNotProduction();

  const owner = await upsertOwner();
  const javi = await upsertOwnerInstructor(owner.id);
  const season = await upsertSeason();

  const javiBlocks = await reseedAvailability(javi, season);
  const heroBanner = await reseedAdBanner();

  console.log(
    JSON.stringify(
      {
        seeded: {
          owner: { id: owner.id, email: owner.email },
          instructor: {
            javi: {
              id: javi.id,
              languages: javi.languages.length,
              specialties: javi.specialties.length,
            },
          },
          season: {
            id: season.id,
            name: season.name,
            anchorTimes: season.anchorTimes.length,
          },
          availabilityBlocks: {
            javi: javiBlocks.length,
          },
          adBanner: { id: heroBanner.id, enabled: heroBanner.enabled },
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
