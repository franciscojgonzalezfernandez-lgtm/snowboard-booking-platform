-- F-157: reschedule (move) bookkeeping on Booking.
--   originalDate    one-year-horizon anchor = the lesson's FIRST-booked date,
--                   set once on the first move and never overwritten (null until
--                   first moved), so repeated moves can't postpone indefinitely.
--   rescheduledAt   timestamp of the most recent move.
--   rescheduleCount number of moves (audit / optional future per-booking cap).
-- Purely additive: moving a booking never touches any price/credit/discount field.
ALTER TABLE "Booking" ADD COLUMN     "originalDate" DATE,
ADD COLUMN     "rescheduledAt" TIMESTAMP(3),
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0;
