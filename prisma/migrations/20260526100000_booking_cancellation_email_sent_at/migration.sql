-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "opsCancellationNotifSentAt" TIMESTAMP(3);
