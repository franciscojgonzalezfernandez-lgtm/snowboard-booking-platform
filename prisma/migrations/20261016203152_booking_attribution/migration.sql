-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('DIRECT', 'PAID_SEARCH', 'ORGANIC_SEARCH', 'SOCIAL', 'FLYER', 'STICKER', 'REFERRAL', 'OTHER');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "attributionCampaign" TEXT,
ADD COLUMN     "attributionChannel" "BookingSource" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT;

-- CreateIndex
CREATE INDEX "Booking_attributionChannel_idx" ON "Booking"("attributionChannel");
