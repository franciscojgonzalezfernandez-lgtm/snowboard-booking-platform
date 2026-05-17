-- Partial unique index: at most one Attendee per Booking may carry
-- isBooker = true. Postgres supports filtered unique indexes; Prisma's
-- schema language does not, so this lives as raw SQL.
CREATE UNIQUE INDEX "Attendee_oneBookerPerBooking"
  ON "Attendee" ("bookingId")
  WHERE "isBooker" = true;
