-- CreateEnum
CREATE TYPE "Duration" AS ENUM ('ONE_HOUR', 'TWO_HOURS', 'INTENSIVE', 'FULL_DAY');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT_FREESTYLE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_OPS', 'PAYMENT_FAILED');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('AVAILABLE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('USER_CANCEL', 'OPS_CANCEL');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('ACTIVE', 'LOCKED', 'USED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photo" TEXT,
    "bio" TEXT,
    "specialties" TEXT[],
    "languages" "Locale"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "acceptsSameDayIfBooked" BOOLEAN NOT NULL DEFAULT false,
    "calendarConnected" BOOLEAN NOT NULL DEFAULT false,
    "googleRefreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityBlock" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "kind" "AvailabilityKind" NOT NULL,

    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "anchorTimes" TEXT[],
    "operatingHoursStart" TEXT NOT NULL,
    "operatingHoursEnd" TEXT NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookerId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "anchorTime" TEXT NOT NULL,
    "duration" "Duration" NOT NULL,
    "language" "Locale" NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT,
    "icsUid" TEXT NOT NULL,
    "googleEventId" TEXT,
    "notes" TEXT,
    "cancelledByUserAt" TIMESTAMP(3),
    "cancelledByOpsAt" TIMESTAMP(3),
    "opsReason" TEXT,
    "reminder24hSentAt" TIMESTAMP(3),
    "postClassEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendee" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "level" "Level" NOT NULL,
    "isBooker" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountCredit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sourceBookingId" TEXT NOT NULL,
    "usedOnBookingId" TEXT,
    "lockedByBookingId" TEXT,
    "reason" "CreditReason" NOT NULL,
    "status" "CreditStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "requestEmailSentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instructor_userId_key" ON "Instructor"("userId");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_instructorId_startDateTime_idx" ON "AvailabilityBlock"("instructorId", "startDateTime");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_startDateTime_endDateTime_idx" ON "AvailabilityBlock"("startDateTime", "endDateTime");

-- CreateIndex
CREATE INDEX "Season_active_startDate_endDate_idx" ON "Season"("active", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripePaymentIntentId_key" ON "Booking"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_icsUid_key" ON "Booking"("icsUid");

-- CreateIndex
CREATE INDEX "Booking_bookerId_status_idx" ON "Booking"("bookerId", "status");

-- CreateIndex
CREATE INDEX "Booking_instructorId_date_idx" ON "Booking"("instructorId", "date");

-- CreateIndex
CREATE INDEX "Booking_date_status_idx" ON "Booking"("date", "status");

-- CreateIndex
CREATE INDEX "Attendee_bookingId_idx" ON "Attendee"("bookingId");

-- CreateIndex
CREATE INDEX "AccountCredit_userId_status_idx" ON "AccountCredit"("userId", "status");

-- CreateIndex
CREATE INDEX "AccountCredit_status_expiresAt_idx" ON "AccountCredit"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_bookingId_key" ON "Tip"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_stripePaymentIntentId_key" ON "Tip"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Tip_instructorId_paidAt_idx" ON "Tip"("instructorId", "paidAt");

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityBlock" ADD CONSTRAINT "AvailabilityBlock_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookerId_fkey" FOREIGN KEY ("bookerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCredit" ADD CONSTRAINT "AccountCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCredit" ADD CONSTRAINT "AccountCredit_sourceBookingId_fkey" FOREIGN KEY ("sourceBookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCredit" ADD CONSTRAINT "AccountCredit_usedOnBookingId_fkey" FOREIGN KEY ("usedOnBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCredit" ADD CONSTRAINT "AccountCredit_lockedByBookingId_fkey" FOREIGN KEY ("lockedByBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
