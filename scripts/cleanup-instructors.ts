// One-off, guarded cleanup: remove instructor accounts that must not exist in
// production (Lara Müller, and any stray "… Gracia"), leaving only the owner.
//
// The prod-ready seed (prisma/seed.ts, F-154) only ever creates the owner, but
// it is guarded off production and does not touch rows already sitting in a
// live dev/prod database — this script does that.
//
// Safety model:
//   * Dry run by default — prints what it WOULD delete, changes nothing.
//   * Set CONFIRM_DELETE=true to actually delete.
//   * Refuses any target still referenced by bookings (Booking→Instructor and
//     Booking→booker are onDelete: Restrict); it prints the blockers instead of
//     force-deleting real bookings. Deciding what to do with those is the
//     operator's call.
//   * Deleting the User cascades to Instructor, AvailabilityBlock, Session and
//     Account. Any other Restrict (e.g. payout rows) surfaces as a caught error.
//
// Unlike the seed this has NO production guard — cleaning the live DB is the
// point; the dry-run default + explicit CONFIRM_DELETE + FK refusal are the net.
//
// Run (Prisma/tsx reads .env, not .env.local, so source it first):
//   set -a && source .env.local && set +a && npx tsx scripts/cleanup-instructors.ts
//   CONFIRM_DELETE=true npx tsx scripts/cleanup-instructors.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OWNER_EMAIL = "franciscojgonzalezfernandez@gmail.com";
const LARA_EMAIL = "lara@rideflumserberg.ch";

const apply = process.env.CONFIRM_DELETE === "true";

async function main() {
  // Candidate accounts to remove: Lara (by email) or anyone whose name contains
  // "gracia" (Ale / Alejandra Gracia), that actually has an Instructor row and
  // is NOT the owner.
  const candidates = await prisma.user.findMany({
    where: {
      email: { not: OWNER_EMAIL },
      instructor: { isNot: null },
      OR: [
        { email: LARA_EMAIL },
        { name: { contains: "gracia", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      instructor: { select: { id: true } },
    },
  });

  if (candidates.length === 0) {
    console.log("No matching instructor accounts found. Nothing to clean up.");
    return;
  }

  const report = await Promise.all(
    candidates.map(async (u) => {
      const instructorId = u.instructor!.id;
      const [bookingsAsInstructor, bookingsAsBooker] = await Promise.all([
        prisma.booking.count({ where: { instructorId } }),
        prisma.booking.count({ where: { bookerId: u.id } }),
      ]);
      return {
        userId: u.id,
        email: u.email,
        name: u.name,
        instructorId,
        bookingsAsInstructor,
        bookingsAsBooker,
        blocked: bookingsAsInstructor > 0 || bookingsAsBooker > 0,
      };
    }),
  );

  console.log(
    apply
      ? "APPLY mode (CONFIRM_DELETE=true) — deleting eligible accounts:"
      : "DRY RUN — no changes. Matching accounts:",
  );
  console.table(
    report.map((r) => ({
      email: r.email,
      name: r.name,
      instructorId: r.instructorId,
      bookingsAsInstructor: r.bookingsAsInstructor,
      bookingsAsBooker: r.bookingsAsBooker,
      blocked: r.blocked,
    })),
  );

  const blocked = report.filter((r) => r.blocked);
  if (blocked.length > 0) {
    console.warn(
      `\n${blocked.length} account(s) SKIPPED — still referenced by bookings ` +
        `(Booking→Instructor/booker is onDelete: Restrict). Reassign or remove ` +
        `those bookings first:\n` +
        blocked
          .map(
            (b) =>
              `  - ${b.email} (instructor ${b.instructorId}): ` +
              `${b.bookingsAsInstructor} as instructor, ${b.bookingsAsBooker} as booker`,
          )
          .join("\n"),
    );
  }

  const deletable = report.filter((r) => !r.blocked);

  if (!apply) {
    console.log(
      `\nDry run complete. Re-run with CONFIRM_DELETE=true to delete ` +
        `${deletable.length} account(s).`,
    );
    return;
  }

  for (const r of deletable) {
    try {
      // Cascades remove Instructor, AvailabilityBlock, Session, Account.
      await prisma.user.delete({ where: { id: r.userId } });
      console.log(
        `Deleted ${r.email} (user ${r.userId}, instructor ${r.instructorId}).`,
      );
    } catch (err) {
      console.error(
        `FAILED to delete ${r.email}: ${(err as Error).message}`,
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
