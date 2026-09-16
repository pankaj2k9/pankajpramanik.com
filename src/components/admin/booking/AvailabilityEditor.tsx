"use client";

import { useState } from "react";
import { saveAvailability } from "@/actions/booking";
import { WEEKDAYS } from "@/lib/booking/labels";
import { ActionForm } from "./ui";
import { inputCls, labelCls } from "../ui";

type Window = { weekday: number; startTime: string; endTime: string };
type Break = { weekday: number | null; startTime: string; endTime: string; label: string };
type Numbers = {
  minNoticeMinutes: number;
  maxDaysAhead: number;
  slotIntervalMinutes: number;
  maxPerDay: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export default function AvailabilityEditor({
  rules: initialRules,
  breaks: initialBreaks,
  numbers,
  timezone,
}: {
  rules: Window[];
  breaks: Break[];
  numbers: Numbers;
  timezone: string;
}) {
  const [rules, setRules] = useState(initialRules);
  const [breaks, setBreaks] = useState(initialBreaks);

  const updateRule = (index: number, patch: Partial<Window>) =>
    setRules((r) => r.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  const updateBreak = (index: number, patch: Partial<Break>) =>
    setBreaks((r) => r.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  const copyToWeekdays = (weekday: number) => {
    const source = rules.filter((r) => r.weekday === weekday);
    setRules((r) => [
      ...r.filter((w) => w.weekday === 0 || w.weekday === 6 || w.weekday === weekday),
      ...[1, 2, 3, 4, 5].filter((d) => d !== weekday).flatMap((d) => source.map((s) => ({ ...s, weekday: d }))),
    ]);
  };

  const numberField = (name: keyof Numbers, label: string, hint: string, min = 0, max = 1000) => (
    <div>
      <label className={labelCls} htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type="number" min={min} max={max} required defaultValue={numbers[name]} className={inputCls} />
      <p className="bka-muted mt-1">{hint}</p>
    </div>
  );

  return (
    <ActionForm action={saveAvailability} submitLabel="Save availability" className="space-y-8">
      <input type="hidden" name="payload" value={JSON.stringify({ rules, breaks })} />

      <section className="card p-6" aria-labelledby="weekly-title">
        <h2 id="weekly-title" className="bka-section-title">
          Weekly hours
        </h2>
        <p className="bka-muted mt-1">Wall-clock times in {timezone}; daylight-saving changes are handled automatically.</p>
        <div className="bka-week mt-4">
          {ORDER.map((weekday) => {
            const windows = rules.map((r, i) => ({ ...r, i })).filter((r) => r.weekday === weekday);
            return (
              <div key={weekday} className="bka-day">
                <label className="bka-check self-start pt-1">
                  <input
                    type="checkbox"
                    checked={windows.length > 0}
                    onChange={(e) =>
                      setRules((r) =>
                        e.target.checked
                          ? [...r, { weekday, startTime: "10:00", endTime: "16:00" }]
                          : r.filter((w) => w.weekday !== weekday),
                      )
                    }
                  />
                  <strong>{WEEKDAYS[weekday]}</strong>
                </label>
                <div className="bka-windows">
                  {windows.length === 0 && <p className="bka-muted pt-1">Unavailable</p>}
                  {windows.map((w) => (
                    <div key={w.i} className="bka-window">
                      <input
                        type="time"
                        aria-label={`${WEEKDAYS[weekday]} start`}
                        value={w.startTime}
                        required
                        onChange={(e) => updateRule(w.i, { startTime: e.target.value })}
                      />
                      <span className="bka-muted">to</span>
                      <input
                        type="time"
                        aria-label={`${WEEKDAYS[weekday]} end`}
                        value={w.endTime}
                        required
                        onChange={(e) => updateRule(w.i, { endTime: e.target.value })}
                      />
                      <button type="button" className="bka-remove" onClick={() => setRules((r) => r.filter((_, i) => i !== w.i))}>
                        Remove
                      </button>
                    </div>
                  ))}
                  {windows.length > 0 && (
                    <div className="flex flex-wrap gap-4">
                      <button
                        type="button"
                        className="bka-link"
                        onClick={() => setRules((r) => [...r, { weekday, startTime: "17:00", endTime: "18:00" }])}
                      >
                        + Add hours
                      </button>
                      {weekday >= 1 && weekday <= 5 && (
                        <button type="button" className="bka-link" onClick={() => copyToWeekdays(weekday)}>
                          Copy to Mon-Fri
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-6" aria-labelledby="breaks-title">
        <h2 id="breaks-title" className="bka-section-title">
          Breaks
        </h2>
        <p className="bka-muted mt-1">Recurring pauses inside working hours, e.g. lunch.</p>
        <div className="bka-windows mt-4">
          {breaks.length === 0 && <p className="bka-muted">No breaks.</p>}
          {breaks.map((b, i) => (
            <div key={i} className="bka-window">
              <select
                aria-label="Break day"
                value={b.weekday ?? "all"}
                onChange={(e) => updateBreak(i, { weekday: e.target.value === "all" ? null : Number(e.target.value) })}
              >
                <option value="all">Every day</option>
                {ORDER.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAYS[d]}
                  </option>
                ))}
              </select>
              <input type="time" aria-label="Break start" value={b.startTime} required onChange={(e) => updateBreak(i, { startTime: e.target.value })} />
              <span className="bka-muted">to</span>
              <input type="time" aria-label="Break end" value={b.endTime} required onChange={(e) => updateBreak(i, { endTime: e.target.value })} />
              <input
                type="text"
                aria-label="Break label"
                placeholder="Label (optional)"
                maxLength={80}
                value={b.label}
                onChange={(e) => updateBreak(i, { label: e.target.value })}
              />
              <button type="button" className="bka-remove" onClick={() => setBreaks((r) => r.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="bka-link"
              onClick={() => setBreaks((r) => [...r, { weekday: null, startTime: "13:00", endTime: "13:30", label: "Lunch" }])}
            >
              + Add break
            </button>
          </div>
        </div>
      </section>

      <section className="card p-6" aria-labelledby="rules-title">
        <h2 id="rules-title" className="bka-section-title mb-4">
          Booking rules
        </h2>
        <div className="bka-number-grid">
          {numberField("minNoticeMinutes", "Minimum notice (minutes)", "e.g. 240 = no bookings within the next 4 hours.", 0, 43200)}
          {numberField("maxDaysAhead", "Maximum days in advance", "How far ahead visitors can book.", 1, 365)}
          {numberField("slotIntervalMinutes", "Slot interval (minutes)", "Start times are offered every N minutes.", 5, 240)}
          {numberField("maxPerDay", "Maximum meetings per day", "0 = no limit.", 0, 50)}
          {numberField("bufferBeforeMinutes", "Buffer before meetings (minutes)", "Minimum; a meeting type can require more.", 0, 240)}
          {numberField("bufferAfterMinutes", "Buffer after meetings (minutes)", "Minimum; a meeting type can require more.", 0, 240)}
        </div>
      </section>
    </ActionForm>
  );
}
