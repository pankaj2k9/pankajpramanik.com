-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "MeetingLocation" AS ENUM ('GOOGLE_MEET', 'ZOOM', 'MICROSOFT_TEAMS', 'PHONE', 'CUSTOM_LINK');

-- CreateEnum
CREATE TYPE "BlockedKind" AS ENUM ('BLOCKED', 'VACATION');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('PUBLIC', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('VISITOR_CONFIRMATION', 'ADMIN_NEW_BOOKING', 'VISITOR_RESCHEDULED', 'VISITOR_CANCELLED', 'ADMIN_CANCELLED', 'REMINDER');

-- CreateTable
CREATE TABLE "MeetingType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "durationMinutes" INTEGER NOT NULL,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "locationType" "MeetingLocation" NOT NULL DEFAULT 'GOOGLE_MEET',
    "locationDetail" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityBreak" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AvailabilityBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedTime" (
    "id" TEXT NOT NULL,
    "startTimeUTC" TIMESTAMP(3) NOT NULL,
    "endTimeUTC" TIMESTAMP(3) NOT NULL,
    "kind" "BlockedKind" NOT NULL DEFAULT 'BLOCKED',
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minNoticeMinutes" INTEGER NOT NULL DEFAULT 240,
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 60,
    "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxPerDay" INTEGER NOT NULL DEFAULT 6,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "notifyEmail" TEXT NOT NULL DEFAULT '',
    "reminderOffsets" INTEGER[] DEFAULT ARRAY[1440, 60, 15]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingToken" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "meetingTypeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "purpose" TEXT NOT NULL,
    "notes" TEXT,
    "startTimeUTC" TIMESTAMP(3) NOT NULL,
    "endTimeUTC" TIMESTAMP(3) NOT NULL,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "locationType" "MeetingLocation" NOT NULL,
    "visitorTimezone" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "BookingSource" NOT NULL DEFAULT 'PUBLIC',
    "meetingUrl" TEXT,
    "calendarEventId" TEXT,
    "adminNotes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "rescheduledFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingNotification" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "offsetMinutes" INTEGER,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "checkBusy" BOOLEAN NOT NULL DEFAULT true,
    "createEvents" BOOLEAN NOT NULL DEFAULT true,
    "createMeetLinks" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingType_slug_key" ON "MeetingType"("slug");

-- CreateIndex
CREATE INDEX "MeetingType_active_order_idx" ON "MeetingType"("active", "order");

-- CreateIndex
CREATE INDEX "AvailabilityRule_weekday_active_idx" ON "AvailabilityRule"("weekday", "active");

-- CreateIndex
CREATE INDEX "BlockedTime_startTimeUTC_endTimeUTC_idx" ON "BlockedTime"("startTimeUTC", "endTimeUTC");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingToken_key" ON "Booking"("bookingToken");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_rescheduledFromId_key" ON "Booking"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "Booking_startTimeUTC_endTimeUTC_idx" ON "Booking"("startTimeUTC", "endTimeUTC");

-- CreateIndex
CREATE INDEX "Booking_status_startTimeUTC_idx" ON "Booking"("status", "startTimeUTC");

-- CreateIndex
CREATE INDEX "Booking_email_idx" ON "Booking"("email");

-- CreateIndex
CREATE INDEX "BookingNotification_sentAt_scheduledFor_idx" ON "BookingNotification"("sentAt", "scheduledFor");

-- CreateIndex
CREATE INDEX "BookingNotification_bookingId_idx" ON "BookingNotification"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_provider_key" ON "CalendarConnection"("provider");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_meetingTypeId_fkey" FOREIGN KEY ("meetingTypeId") REFERENCES "MeetingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingNotification" ADD CONSTRAINT "BookingNotification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Starting data. Everything below is editable (or deletable) in /admin/booking;
-- the application never hard-codes meeting types or working hours.
INSERT INTO "BookingSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MeetingType" ("id", "name", "slug", "description", "durationMinutes", "bufferBeforeMinutes", "bufferAfterMinutes", "locationType", "order", "updatedAt") VALUES
  ('mt_quick_call', '15 Minute Quick Call', 'quick-call', 'A short call to check fit or answer a focused question.', 15, 0, 5, 'GOOGLE_MEET', 1, CURRENT_TIMESTAMP),
  ('mt_meeting_30', '30 Minute Meeting', 'meeting-30', 'Talk through a project, idea or problem and agree on next steps.', 30, 0, 10, 'GOOGLE_MEET', 2, CURRENT_TIMESTAMP),
  ('mt_consultation_45', '45 Minute Consultation', 'consultation-45', 'A deeper look at requirements, data and a possible approach.', 45, 5, 10, 'GOOGLE_MEET', 3, CURRENT_TIMESTAMP),
  ('mt_technical_60', '60 Minute Technical Discussion', 'technical-discussion-60', 'Architecture, code or system review with time for detailed questions.', 60, 5, 15, 'GOOGLE_MEET', 4, CURRENT_TIMESTAMP),
  ('mt_interview', 'Interview', 'interview', 'For recruiters and hiring teams.', 45, 5, 10, 'GOOGLE_MEET', 5, CURRENT_TIMESTAMP),
  ('mt_custom', 'Custom Meeting', 'custom-meeting', 'Something else? Describe it in the booking form.', 30, 0, 10, 'GOOGLE_MEET', 6, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "AvailabilityRule" ("id", "weekday", "startTime", "endTime") VALUES
  ('ar_mon', 1, '11:00', '16:00'),
  ('ar_tue', 2, '11:00', '16:00'),
  ('ar_wed', 3, '11:00', '16:00'),
  ('ar_thu', 4, '11:00', '16:00'),
  ('ar_fri', 5, '11:00', '16:00')
ON CONFLICT ("id") DO NOTHING;
