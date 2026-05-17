import {
  PrismaClient,
  AvailabilityKind,
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
const SEED_WEEKS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

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

async function upsertInstructor(userId: string): Promise<Instructor> {
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
      bio,
      specialties,
      languages: [Locale.en, Locale.de, Locale.es],
      active: true,
      acceptsSameDayIfBooked: false,
      calendarConnected: false,
    },
    create: {
      userId,
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
    anchorTimes: ["09:00", "11:00", "13:00", "15:00"],
    operatingHoursStart: "09:00",
    operatingHoursEnd: "17:00",
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

  const blocks: { instructorId: string; startDateTime: Date; endDateTime: Date; kind: AvailabilityKind }[] = [];
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

async function main() {
  const owner = await upsertOwner();
  const instructor = await upsertInstructor(owner.id);
  const season = await upsertSeason();
  const blocks = await reseedAvailability(instructor, season);

  console.log(
    JSON.stringify(
      {
        seeded: {
          user: { id: owner.id, email: owner.email },
          instructor: { id: instructor.id, languages: instructor.languages.length, specialties: instructor.specialties.length },
          season: { id: season.id, name: season.name, anchorTimes: season.anchorTimes.length },
          availabilityBlocks: blocks.length,
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
