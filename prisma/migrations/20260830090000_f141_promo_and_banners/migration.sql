-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "originalPriceCents" INTEGER,
ADD COLUMN     "promoLabel" TEXT;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "promoLabelByDuration" JSONB,
ADD COLUMN     "promoPriceCentsByDuration" JSONB;

-- CreateTable
CREATE TABLE "AdBanner" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "body" JSONB NOT NULL,
    "ctaLabel" JSONB,
    "ctaHref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdBanner_enabled_sortIndex_idx" ON "AdBanner"("enabled", "sortIndex");
