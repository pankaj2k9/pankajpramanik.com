import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getBookingSettings } from "@/lib/booking/service";
import Link from "next/link";
import AvailabilityEditor from "@/components/admin/booking/AvailabilityEditor";
import { getGoogleConnection, isGoogleConfigured } from "@/lib/booking/google";

export default async function AvailabilityPage() {
  await requireAdmin();
  const [settings, rules, breaks, google] = await Promise.all([
    getBookingSettings(),
    prisma.availabilityRule.findMany({ where: { active: true }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    prisma.availabilityBreak.findMany({ orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    getGoogleConnection(),
  ]);
  return (
    <div className="max-w-4xl space-y-6">
      <div className="bka-head">
        <div>
          <h1 className="font-display text-2xl font-bold">Availability</h1>
          <p>When visitors can book. Timezone: {settings.timezone} (change it in Settings).</p>
          <p>
            Google Calendar:{" "}
            {google
              ? google.checkBusy
                ? `busy times in ${google.accountEmail || "your calendar"} are removed from these hours automatically.`
                : "connected, but free/busy checking is off."
              : isGoogleConfigured()
                ? "not connected."
                : "not configured."}{" "}
            <Link className="text-accent hover:underline" href="/admin/booking/settings">
              Manage in settings
            </Link>
          </p>
        </div>
      </div>
      <AvailabilityEditor
        timezone={settings.timezone}
        rules={rules.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))}
        breaks={breaks.map(({ weekday, startTime, endTime, label }) => ({ weekday, startTime, endTime, label }))}
        numbers={{
          minNoticeMinutes: settings.minNoticeMinutes,
          maxDaysAhead: settings.maxDaysAhead,
          slotIntervalMinutes: settings.slotIntervalMinutes,
          maxPerDay: settings.maxPerDay,
          bufferBeforeMinutes: settings.bufferBeforeMinutes,
          bufferAfterMinutes: settings.bufferAfterMinutes,
        }}
      />
    </div>
  );
}
