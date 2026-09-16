"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { BookingStatus } from "@prisma/client";
import { changeBookingStatus, deleteBlockedTime, markDayUnavailable, quickCancelBooking } from "@/actions/booking";
import { ActionButton } from "./ui";

export type CalendarView = "month" | "week" | "day";

export type CalendarEvent = {
  id: string;
  kind: "booking" | "block";
  dayKey: string;
  startMin: number;
  endMin: number;
  label: string;
  title: string;
  status: string;
  rawStatus?: BookingStatus;
  upcoming?: boolean;
  allDay?: boolean;
  rows: [string, string][];
};

type Day = {
  key: string;
  label: string;
  dayNumber: number;
  outside: boolean;
  closed: boolean;
  open: { start: number; end: number }[];
  breaks: { start: number; end: number }[];
};

const MONTH_DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_IN_CELL = 3;

export default function AdminCalendar(props: {
  view: CalendarView;
  date: string;
  today: string;
  title: string;
  timezone: string;
  prevDate: string;
  nextDate: string;
  days: Day[];
  events: CalendarEvent[];
  firstHour: number;
  lastHour: number;
  nowMinute: number | null;
}) {
  const { view, date, today, days, events, firstHour, lastHour } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const href = (v: CalendarView, d: string) => `/admin/booking/calendar?view=${v}&date=${d}`;

  function open(event: CalendarEvent) {
    setSelected(event);
    dialog.current?.showModal();
  }
  const close = () => dialog.current?.close();

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.dayKey, [...(byDay.get(e.dayKey) ?? []), e]);
  for (const list of byDay.values())
    list.sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || a.startMin - b.startMin);

  const eventButton = (e: CalendarEvent, style?: React.CSSProperties) => (
    <button
      key={`${e.kind}-${e.id}-${e.dayKey}`}
      type="button"
      className={`bka-event is-${e.status}`}
      style={style}
      onClick={() => open(e)}
      title={e.title}
    >
      {e.label}
    </button>
  );

  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const pos = (min: number) => `calc(${(min - firstHour * 60) / 60} * var(--hour))`;
  const clamp = (min: number) => Math.min(lastHour * 60, Math.max(firstHour * 60, min));

  return (
    <div className="space-y-5">
      <div className="bka-cal-toolbar">
        <div className="bka-cal-group">
          <Link className="bka-button-ghost" href={href(view, props.prevDate)} aria-label="Previous">
            ←
          </Link>
          <Link className="bka-button-ghost" href={href(view, today)}>
            Today
          </Link>
          <Link className="bka-button-ghost" href={href(view, props.nextDate)} aria-label="Next">
            →
          </Link>
          <h1 className="self-center pl-2 text-lg font-semibold" aria-live="polite">
            <span className="sr-only">Calendar: </span>
            {props.title}
          </h1>
        </div>
        <div className="bka-cal-group">
          {(["month", "week", "day"] as const).map((v) => (
            <Link key={v} className="bka-button-ghost" aria-current={v === view ? "true" : undefined} href={href(v, date)}>
              {v[0].toUpperCase() + v.slice(1)}
            </Link>
          ))}
        </div>
      </div>

      <div className="bka-cal-toolbar">
        <p className="bka-legend">
          <span style={{ "--c": "var(--accent-strong)" } as React.CSSProperties}>Confirmed</span>
          <span style={{ "--c": "#f59e0b" } as React.CSSProperties}>Pending</span>
          <span style={{ "--c": "#22c55e" } as React.CSSProperties}>Completed</span>
          <span style={{ "--c": "#ef4444" } as React.CSSProperties}>Cancelled / no show</span>
          <span style={{ "--c": "var(--faint)" } as React.CSSProperties}>Blocked</span>
          <span className="bka-muted" style={{ "--c": "transparent" } as React.CSSProperties}>
            Times in {props.timezone}
          </span>
        </p>
        <div className="bka-cal-group">
          <Link className="bka-button-ghost" href={`/admin/booking/blocked?date=${date}`}>
            Block time
          </Link>
          {view === "day" && (
            <ActionButton
              label="Mark day unavailable"
              confirmText="Block this whole day for new bookings? Existing bookings stay."
              action={() => markDayUnavailable(date)}
            />
          )}
          <Link className="bka-button" href={`/admin/booking/bookings/new?date=${date}`}>
            + Add booking
          </Link>
        </div>
      </div>

      {view === "month" ? (
        <div className="card overflow-hidden">
          <div className="bka-month" role="grid" aria-label={props.title}>
            {MONTH_DOW.map((d) => (
              <div key={d} className="bka-month-dow" role="columnheader">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const list = byDay.get(d.key) ?? [];
              return (
                <div
                  key={d.key}
                  role="gridcell"
                  className="bka-month-cell"
                  data-outside={d.outside || undefined}
                  data-closed={d.closed || undefined}
                  data-today={d.key === today || undefined}
                >
                  <div className="bka-month-date">
                    <Link href={href("day", d.key)} aria-label={`Open ${d.key}`}>
                      {d.dayNumber}
                    </Link>
                  </div>
                  {list.slice(0, MAX_IN_CELL).map((e) => eventButton(e))}
                  {list.length > MAX_IN_CELL && (
                    <Link className="bka-more" href={href("day", d.key)}>
                      +{list.length - MAX_IN_CELL} more
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card bka-timegrid-wrap">
          <div className="bka-timegrid" style={{ "--days": days.length } as React.CSSProperties}>
            <div className="bka-tg-head" aria-hidden />
            {days.map((d) => (
              <div key={d.key} className="bka-tg-head" data-today={d.key === today || undefined}>
                <Link href={href("day", d.key)}>{d.label}</Link>
                {(byDay.get(d.key) ?? [])
                  .filter((e) => e.allDay)
                  .map((e) => eventButton(e, { marginTop: 4 }))}
              </div>
            ))}
            <div className="bka-tg-hours">
              {hours.map((h) => (
                <div key={h} className="bka-tg-hour">
                  {h === 0 ? "" : `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`}
                </div>
              ))}
            </div>
            {days.map((d) => (
              <div key={d.key} className="bka-tg-col" style={{ height: `calc(${hours.length} * var(--hour))` }}>
                {d.open.map((w, i) => (
                  <span key={i} className="bka-tg-open" style={{ top: pos(clamp(w.start)), height: `calc(${(clamp(w.end) - clamp(w.start)) / 60} * var(--hour))` }} />
                ))}
                {d.breaks.map((w, i) => (
                  <span
                    key={`b${i}`}
                    className="bka-event is-block"
                    aria-hidden
                    style={{ position: "absolute", top: pos(clamp(w.start)), height: `calc(${(clamp(w.end) - clamp(w.start)) / 60} * var(--hour))`, insetInline: 0 }}
                  />
                ))}
                {(byDay.get(d.key) ?? [])
                  .filter((e) => !e.allDay)
                  .map((e) => {
                    const top = clamp(e.startMin);
                    const height = Math.max(22, ((clamp(e.endMin) - top) / 60) * 56);
                    return eventButton(e, { top: pos(top), height });
                  })}
                {props.nowMinute !== null && d.key === today && props.nowMinute >= firstHour * 60 && props.nowMinute <= lastHour * 60 && (
                  <span className="bka-now" style={{ top: pos(props.nowMinute) }} aria-label="Now" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <dialog ref={dialog} className="bka-dialog" onClose={() => setSelected(null)} aria-labelledby="bka-dialog-title">
        {selected && (
          <div className="bka-dialog-body">
            <div className="flex items-start justify-between gap-4">
              <h2 id="bka-dialog-title" className="text-lg font-semibold">
                {selected.title}
              </h2>
              <button type="button" onClick={close} className="text-muted" aria-label="Close">
                ✕
              </button>
            </div>
            <dl className="bka-dl mt-4">
              {selected.rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="bka-actions mt-6 border-t border-border pt-4">
              {selected.kind === "booking" ? (
                <>
                  <Link className="bka-button" href={`/admin/booking/bookings/${selected.id}`}>
                    Open booking
                  </Link>
                  <Link className="bka-button-ghost" href={`/admin/booking/bookings/${selected.id}#edit`}>
                    Edit
                  </Link>
                  {(selected.rawStatus === "CONFIRMED" || selected.rawStatus === "PENDING") && (
                    <>
                      {selected.upcoming && (
                        <Link className="bka-button-ghost" href={`/admin/booking/bookings/${selected.id}#reschedule`}>
                          Reschedule
                        </Link>
                      )}
                      <ActionButton
                        label="Mark completed"
                        action={async () => {
                          await changeBookingStatus(selected.id, "COMPLETED");
                          close();
                        }}
                      />
                      <ActionButton
                        label="Cancel booking"
                        tone="danger"
                        confirmText="Cancel this booking and email the attendee?"
                        action={async () => {
                          await quickCancelBooking(selected.id);
                          close();
                        }}
                      />
                    </>
                  )}
                </>
              ) : (
                <ActionButton
                  label="Remove block"
                  tone="danger"
                  confirmText="Remove this blocked period?"
                  action={async () => {
                    await deleteBlockedTime(selected.id);
                    close();
                  }}
                />
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
