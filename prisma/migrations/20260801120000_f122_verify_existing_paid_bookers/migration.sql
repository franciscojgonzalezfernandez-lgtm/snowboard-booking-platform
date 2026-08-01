-- F-122: back-fill email verification for bookers who already completed a real
-- booking, so turning on `requireEmailVerification` does not lock returning
-- customers out of their next booking.
--
-- A booking that reached CONFIRMED/COMPLETED, or that carries a `paidAt`
-- (paid card charge or zero-charge credit booking), proves the address was a
-- real inbox at purchase time. Google and magic-link accounts are already
-- `emailVerified = true`, so this only lifts the unverified email+password
-- accounts that have paid before.
--
-- Idempotent: guarded on `emailVerified = false`, so re-running is a no-op.
UPDATE "User" u
SET "emailVerified" = true
WHERE u."emailVerified" = false
  AND EXISTS (
    SELECT 1
    FROM "Booking" b
    WHERE b."bookerId" = u."id"
      AND (
        b."status" IN ('CONFIRMED', 'COMPLETED')
        OR b."paidAt" IS NOT NULL
      )
  );
