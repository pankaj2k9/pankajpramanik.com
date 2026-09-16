import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import PageHero from "@/components/inner/PageHero";
import PageMotion from "@/components/motion/PageMotion";
import BookingFlow, { type RescheduleTarget } from "@/components/booking/BookingFlow";
import { getBookingSettings } from "@/lib/booking/service";
import { looksLikeToken } from "@/lib/booking/crypto";
import { LOCATION_LABELS } from "@/lib/booking/labels";

export const metadata = pageMetadata(
  "Book a Meeting",
  "Schedule a call with Pankaj Kumar Pramanik about AI engineering, data pipelines, automation or a technical discussion. Pick a time in your own timezone.",
  "/booking",
);

const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "schedule", label: "Schedule" },
];

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; reschedule?: string }>;
}) {
  const { type, reschedule: token } = await searchParams;
  const [settings, meetingTypes] = await Promise.all([
    getBookingSettings(),
    prisma.meetingType.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { durationMinutes: "asc" }] }),
  ]);

  let reschedule: RescheduleTarget | undefined;
  if (token && looksLikeToken(token)) {
    const booking = await prisma.booking.findUnique({ where: { bookingToken: token }, include: { meetingType: true } });
    if (booking && ["CONFIRMED", "PENDING"].includes(booking.status) && booking.startTimeUTC > new Date())
      reschedule = {
        token,
        reference: booking.reference,
        typeSlug: booking.meetingType.slug,
        currentStart: booking.startTimeUTC.toISOString(),
        fullName: booking.fullName,
        visitorTimezone: booking.visitorTimezone,
      };
  }

  // A rescheduled booking keeps its meeting type even if it was later hidden.
  const types = meetingTypes.map((t) => ({
    slug: t.slug,
    name: t.name,
    description: t.description,
    durationMinutes: t.durationMinutes,
    locationLabel: LOCATION_LABELS[t.locationType],
    requiresPhone: t.locationType === "PHONE",
  }));
  if (reschedule && !types.some((t) => t.slug === reschedule.typeSlug)) {
    const t = await prisma.meetingType.findUnique({ where: { slug: reschedule.typeSlug } });
    if (t)
      types.push({
        slug: t.slug,
        name: t.name,
        description: t.description,
        durationMinutes: t.durationMinutes,
        locationLabel: LOCATION_LABELS[t.locationType],
        requiresPhone: t.locationType === "PHONE",
      });
  }

  return (
    <>
      <PageHero
        index="09"
        label="Booking"
        tone="mint"
        lines={reschedule ? ["Pick a new time."] : ["Book a time", "that suits you."]}
        lead={
          <p>
            {reschedule
              ? "Choose another open slot. Your details stay the same and the calendar invitation moves with the booking."
              : "Choose a meeting type, pick an open slot in your own timezone and add a short note. You get a confirmation email with a calendar invite straight away."}
          </p>
        }
      >
        <ul className="bk-hero-list">
          <li>Times shown in your local timezone</li>
          <li>Reschedule or cancel from your confirmation link</li>
          <li>
            Prefer writing? <Link href="/contact">Send a project brief</Link> or email{" "}
            <a href={`mailto:${site.businessEmail}`}>{site.businessEmail}</a>
          </li>
        </ul>
      </PageHero>

      <section id="schedule" className="ip-section bk-section">
        <div className="hm-container">
          <div className="bk-card ip-card" data-hm="scale">
            {settings.bookingEnabled || reschedule ? (
              <BookingFlow
                types={types}
                adminTimezone={settings.timezone}
                maxDaysAhead={settings.maxDaysAhead}
                initialType={type}
                reschedule={reschedule}
              />
            ) : (
              <div className="ct-done">
                <h2>Online booking is paused.</h2>
                <p>
                  Please <Link href="/contact">send a message</Link> and I will suggest a time.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      <PageMotion steps={STEPS} />
    </>
  );
}
