-- Google Calendar invitations now always replace the Resend booking email
-- when an event is created, so the opt-in flag is gone.
ALTER TABLE "CalendarConnection" DROP COLUMN "sendGoogleInvites";
