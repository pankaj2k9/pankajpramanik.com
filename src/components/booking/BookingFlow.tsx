"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  dateKeyInZone,
  formatInZone,
  formatLongDate,
  formatTime,
  listTimeZones,
  offsetLabel,
  weekdayOf,
  zonedTimeToUtc,
} from "@/lib/booking/time";
import { durationLabel } from "@/lib/booking/labels";

export type PublicMeetingType = {
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  locationLabel: string;
  requiresPhone: boolean;
};

export type RescheduleTarget = {
  token: string;
  reference: string;
  typeSlug: string;
  currentStart: string;
  fullName: string;
  visitorTimezone: string;
};

type SlotState = { slots: string[] } | { error: string };

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const noSubscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || null;

function monthOf(dateKey: string) {
  return dateKey.slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function BookingFlow({
  types,
  adminTimezone,
  maxDaysAhead,
  initialType,
  reschedule,
}: {
  types: PublicMeetingType[];
  adminTimezone: string;
  maxDaysAhead: number;
  initialType?: string;
  reschedule?: RescheduleTarget;
}) {
  const router = useRouter();
  const detected = useSyncExternalStore(noSubscribe, browserTimeZone, () => null);
  const [tzOverride, setTzOverride] = useState<string | null>(reschedule?.visitorTimezone ?? null);
  const timeZone = tzOverride ?? detected ?? adminTimezone;

  const [typeSlug, setTypeSlug] = useState(
    reschedule?.typeSlug ?? types.find((t) => t.slug === initialType)?.slug ?? "",
  );
  const [step, setStep] = useState(reschedule || types.find((t) => t.slug === initialType) ? 1 : 0);
  const [month, setMonth] = useState<string | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, SlotState>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const startedAt = useRef(0);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const type = types.find((t) => t.slug === typeSlug);
  const todayKey = dateKeyInZone(new Date(), timeZone);
  const lastKey = addDays(todayKey, maxDaysAhead);
  const activeMonth = month ?? monthOf(todayKey);
  const cacheKey = `${typeSlug}|${activeMonth}|${timeZone}`;
  const entry = cache[cacheKey];

  useEffect(() => {
    if (step < 1 || !typeSlug || entry) return;
    const controller = new AbortController();
    const start = zonedTimeToUtc(`${activeMonth}-01`, "00:00", timeZone);
    const end = zonedTimeToUtc(`${shiftMonth(activeMonth, 1)}-01`, "00:00", timeZone);
    const params = new URLSearchParams({ type: typeSlug, start: start.toISOString(), end: end.toISOString() });
    if (reschedule) params.set("reschedule", reschedule.token);
    fetch(`/api/booking/slots?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load availability.");
        setCache((c) => ({ ...c, [cacheKey]: { slots: json.slots as string[] } }));
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError")
          setCache((c) => ({ ...c, [cacheKey]: { error: error.message || "Could not load availability." } }));
      });
    return () => controller.abort();
  }, [step, typeSlug, entry, activeMonth, timeZone, cacheKey, reschedule]);

  const slotsByDay = new Map<string, string[]>();
  if (entry && "slots" in entry)
    for (const iso of entry.slots) {
      const key = dateKeyInZone(new Date(iso), timeZone);
      if (monthOf(key) === activeMonth) slotsByDay.set(key, [...(slotsByDay.get(key) ?? []), iso]);
    }

  const firstAvailable = [...slotsByDay.keys()].sort()[0] ?? null;
  const date = pickedDate && monthOf(pickedDate) === activeMonth && slotsByDay.has(pickedDate) ? pickedDate : firstAvailable;
  const daySlots = date ? slotsByDay.get(date) ?? [] : [];
  const zones = useMemo(() => {
    const list = listTimeZones();
    const now = new Date();
    return list.map((z) => ({ id: z, label: `${z.replace(/_/g, " ")} (${offsetLabel(z, now)})` }));
  }, []);

  const steps = reschedule ? ["Date & time", "Confirm"] : ["Meeting type", "Date & time", "Your details"];
  const stepIndex = reschedule ? step - 1 : step;

  function go(next: number) {
    setStep(next);
    setNotice(null);
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
  }

  function slotTaken(message: string) {
    setNotice(message);
    setSlot(null);
    setCache((c) => {
      const next = { ...c };
      delete next[cacheKey];
      return next;
    });
    go(1);
    setNotice(message);
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type || !slot) return;
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          meetingType: type.slug,
          start: slot,
          visitorTimezone: timeZone,
          startedAt: startedAt.current,
        }),
      });
      const json = await res.json();
      if (res.status === 409) return slotTaken(json.error);
      if (!res.ok) throw new Error(json.error ?? "The booking could not be saved.");
      router.push(`/booking/${json.token}?status=scheduled`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The booking could not be saved.");
      setSending(false);
    }
  }

  async function submitReschedule() {
    if (!reschedule || !slot) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/booking/${reschedule.token}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: slot, visitorTimezone: timeZone }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setSending(false);
        return slotTaken(json.error);
      }
      if (!res.ok) throw new Error(json.error ?? "The booking could not be rescheduled.");
      router.push(`/booking/${json.token}?status=rescheduled`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The booking could not be rescheduled.");
      setSending(false);
    }
  }

  const monthStartKey = `${activeMonth}-01`;
  const leading = (weekdayOf(monthStartKey) + 6) % 7;
  const daysInMonth = Number(addDays(`${shiftMonth(activeMonth, 1)}-01`, -1).slice(8));
  const loading = step >= 1 && Boolean(typeSlug) && !entry;
  const loadError = entry && "error" in entry ? entry.error : null;

  const summary = type && (
    <dl className="bk-summary">
      <div>
        <dt>Meeting</dt>
        <dd>{type.name}</dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{durationLabel(type.durationMinutes)}</dd>
      </div>
      <div>
        <dt>Method</dt>
        <dd>{type.locationLabel}</dd>
      </div>
      {slot && (
        <div className="bk-summary-when">
          <dt>When</dt>
          <dd>
            {formatLongDate(new Date(slot), timeZone)}
            <br />
            {formatTime(new Date(slot), timeZone)} -{" "}
            {formatTime(new Date(new Date(slot).getTime() + type.durationMinutes * 60_000), timeZone)}
            <span className="bk-zone-note"> ({timeZone.replace(/_/g, " ")})</span>
          </dd>
        </div>
      )}
    </dl>
  );

  return (
    <div className="bk-flow">
      <ol className="ct-steps" aria-label="Booking progress">
        {steps.map((s, i) => (
          <li key={s} data-state={i === stepIndex ? "current" : i < stepIndex ? "done" : "todo"}>
            <button
              type="button"
              onClick={() => i < stepIndex && go(reschedule ? i + 1 : i)}
              disabled={i >= stepIndex}
              aria-current={i === stepIndex ? "step" : undefined}
            >
              <span className="ct-step-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="ct-step-label">{s}</span>
            </button>
          </li>
        ))}
        <span className="ct-steps-rail" aria-hidden>
          <span style={{ scale: `${stepIndex / Math.max(1, steps.length - 1)} 1` }} />
        </span>
      </ol>

      {reschedule && (
        <p className="bk-reschedule-note">
          Rescheduling <strong>{reschedule.reference}</strong>, currently{" "}
          {formatLongDate(new Date(reschedule.currentStart), timeZone)} at{" "}
          {formatTime(new Date(reschedule.currentStart), timeZone)}.
        </p>
      )}

      {notice && (
        <p className="ct-error" role="alert">
          {notice}
        </p>
      )}

      <div className="bk-panel" ref={panel} tabIndex={-1} key={step}>
        {step === 0 && (
          <fieldset>
            <legend className="ct-question">What kind of meeting?</legend>
            {types.length === 0 ? (
              <p className="ct-hint">No meeting types are open for booking right now. Please use the contact page.</p>
            ) : (
              <div className="bk-types">
                {types.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    className="bk-type"
                    aria-pressed={t.slug === typeSlug}
                    onClick={() => {
                      setTypeSlug(t.slug);
                      setSlot(null);
                      setPickedDate(null);
                      go(1);
                    }}
                  >
                    <span className="bk-type-top">
                      <span className="bk-type-name">{t.name}</span>
                      <span className="bk-type-duration">{durationLabel(t.durationMinutes)}</span>
                    </span>
                    {t.description && <span className="bk-type-desc">{t.description}</span>}
                    <span className="bk-type-method">{t.locationLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        )}

        {step === 1 && type && (
          <div className="bk-schedule">
            <div className="bk-calendar-col">
              <div className="bk-cal-head">
                <h3 className="bk-cal-title" aria-live="polite">
                  {formatInZone(zonedTimeToUtc(monthStartKey, "12:00", "UTC"), "UTC", { month: "long", year: "numeric" })}
                </h3>
                <div className="bk-cal-nav">
                  <button
                    type="button"
                    onClick={() => setMonth(shiftMonth(activeMonth, -1))}
                    disabled={activeMonth <= monthOf(todayKey)}
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonth(shiftMonth(activeMonth, 1))}
                    disabled={activeMonth >= monthOf(lastKey)}
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="bk-cal" role="group" aria-label="Choose a date" aria-busy={loading}>
                {WEEK.map((d) => (
                  <span key={d} className="bk-cal-dow" aria-hidden>
                    {d}
                  </span>
                ))}
                {Array.from({ length: leading }, (_, i) => (
                  <span key={`pad-${i}`} aria-hidden />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const key = `${activeMonth}-${String(i + 1).padStart(2, "0")}`;
                  const available = slotsByDay.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className="bk-day"
                      data-today={key === todayKey || undefined}
                      disabled={!available}
                      aria-pressed={key === date}
                      aria-label={`${formatInZone(zonedTimeToUtc(key, "12:00", "UTC"), "UTC", { weekday: "long", month: "long", day: "numeric" })}${available ? `, ${slotsByDay.get(key)!.length} times available` : ", unavailable"}`}
                      onClick={() => {
                        setPickedDate(key);
                        setSlot(null);
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <label className="bk-tz">
                <span className="bk-tz-label">
                  Times shown in your timezone: <strong>{timeZone}</strong>
                </span>
                <select value={timeZone} onChange={(e) => setTzOverride(e.target.value)} aria-label="Change timezone">
                  {!zones.some((z) => z.id === timeZone) && <option value={timeZone}>{timeZone}</option>}
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="bk-slots-col">
              <h3 className="bk-slots-title">
                {date ? formatInZone(zonedTimeToUtc(date, "12:00", "UTC"), "UTC", { weekday: "long", month: "long", day: "numeric" }) : "Available times"}
              </h3>
              {loading && <p className="bk-muted">Loading available times…</p>}
              {loadError && (
                <p className="bk-muted" role="alert">
                  {loadError}{" "}
                  <button type="button" className="bk-inline" onClick={() => setCache((c) => { const n = { ...c }; delete n[cacheKey]; return n; })}>
                    Try again
                  </button>
                </p>
              )}
              {!loading && !loadError && slotsByDay.size === 0 && (
                <p className="bk-muted">
                  No open times this month.{" "}
                  {activeMonth < monthOf(lastKey) && (
                    <button type="button" className="bk-inline" onClick={() => setMonth(shiftMonth(activeMonth, 1))}>
                      Check next month
                    </button>
                  )}
                </p>
              )}
              {daySlots.length > 0 && (
                <ul className="bk-slots">
                  {daySlots.map((iso) => (
                    <li key={iso}>
                      <button
                        type="button"
                        className="bk-slot"
                        aria-pressed={slot === iso}
                        onClick={() => setSlot(iso)}
                      >
                        {formatTime(new Date(iso), timeZone)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="ct-actions bk-actions">
              {!reschedule && (
                <button type="button" className="hm-link" onClick={() => go(0)}>
                  <span aria-hidden>←</span> Meeting type
                </button>
              )}
              <p className="ct-privacy">
                {type.name} · {durationLabel(type.durationMinutes)}
              </p>
              <button type="button" className="hm-button" disabled={!slot} onClick={() => go(2)}>
                Continue <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        )}

        {step === 2 && type && slot && !reschedule && (
          <form className="bk-details" onSubmit={submitBooking}>
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="bk-website">Website</label>
              <input id="bk-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="bk-details-grid">
              <fieldset>
                <legend className="ct-question">Your details</legend>
                <div className="ct-grid">
                  <label className="ct-field">
                    <input name="fullName" required minLength={2} maxLength={120} autoComplete="name" placeholder=" " />
                    <span>Full name *</span>
                  </label>
                  <label className="ct-field">
                    <input name="email" type="email" required maxLength={200} autoComplete="email" placeholder=" " />
                    <span>Email *</span>
                  </label>
                  <label className="ct-field">
                    <input name="company" maxLength={160} autoComplete="organization" placeholder=" " />
                    <span>Company / organization</span>
                  </label>
                  <label className="ct-field">
                    <input
                      name="phone"
                      type="tel"
                      maxLength={40}
                      autoComplete="tel"
                      required={type.requiresPhone}
                      pattern="[+()0-9 .\-]*"
                      placeholder=" "
                    />
                    <span>Phone{type.requiresPhone ? " *" : ""}</span>
                  </label>
                </div>
                <label className="ct-field">
                  <input name="purpose" required minLength={3} maxLength={300} placeholder=" " />
                  <span>Meeting purpose *</span>
                </label>
                <label className="ct-field">
                  <textarea name="notes" rows={4} maxLength={3000} placeholder=" " />
                  <span>Message / additional notes</span>
                </label>
              </fieldset>
              <aside className="bk-aside" aria-label="Booking summary">
                <p className="hm-label">Summary</p>
                {summary}
              </aside>
            </div>
            <div className="ct-actions">
              <button type="button" className="hm-link" onClick={() => go(1)}>
                <span aria-hidden>←</span> Change time
              </button>
              <p className="ct-privacy">
                Your details are only used for this meeting. See the <a href="/privacy-policy">privacy policy</a>.
              </p>
              <button type="submit" className="hm-button" disabled={sending}>
                {sending ? "Booking…" : "Confirm booking"} <span aria-hidden>→</span>
              </button>
            </div>
          </form>
        )}

        {step === 2 && type && slot && reschedule && (
          <div className="bk-details">
            <p className="ct-question">Confirm the new time</p>
            <p className="ct-hint">Hi {reschedule.fullName}, your booking will move to:</p>
            {summary}
            <div className="ct-actions">
              <button type="button" className="hm-link" onClick={() => go(1)}>
                <span aria-hidden>←</span> Change time
              </button>
              <span className="ct-privacy" />
              <button type="button" className="hm-button" disabled={sending} onClick={submitReschedule}>
                {sending ? "Rescheduling…" : "Confirm new time"} <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
