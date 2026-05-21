-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'CANCELLED_BY_SYSTEM';
ALTER TYPE "BookingStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "refundAmountCents" INTEGER,
ADD COLUMN     "refundedAt" TIMESTAMP(3);
