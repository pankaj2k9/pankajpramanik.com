import { z } from "zod";
import { isValidTimeZone } from "./time";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const timeZoneSchema = z.string().trim().refine(isValidTimeZone, "Choose a valid timezone");

export const bookingDetailsSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  company: optionalText(160),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+()\d\s.-]*$/, "Enter a valid phone number")
    .optional()
    .transform((v) => v || null),
  purpose: z.string().trim().min(3, "Tell me briefly what the meeting is about").max(300),
  notes: optionalText(3000),
  visitorTimezone: timeZoneSchema,
});

export const createBookingSchema = bookingDetailsSchema.extend({
  meetingType: z.string().trim().min(1).max(80),
  start: z.string().datetime({ offset: true }),
  // Honeypot and time-trap, as on the contact form.
  website: z.string().max(0).optional().or(z.literal("")),
  startedAt: z.coerce.number().optional(),
});

export const rescheduleSchema = z.object({
  start: z.string().datetime({ offset: true }),
  visitorTimezone: timeZoneSchema,
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
