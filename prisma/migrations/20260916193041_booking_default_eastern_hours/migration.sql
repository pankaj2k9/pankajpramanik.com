-- AlterTable
ALTER TABLE "BookingSettings" ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';

-- Default working hours: Monday-Friday 10:00-16:00 US Eastern time (EST/EDT,
-- daylight saving handled by the timezone). Only rows still holding the
-- original seed values are changed, so admin edits are never overwritten.
UPDATE "BookingSettings" SET "timezone" = 'America/New_York'
WHERE "id" = 'default' AND "timezone" = 'Asia/Dhaka';

UPDATE "AvailabilityRule" SET "startTime" = '10:00'
WHERE "id" IN ('ar_mon', 'ar_tue', 'ar_wed', 'ar_thu', 'ar_fri')
  AND "startTime" = '11:00' AND "endTime" = '16:00';
