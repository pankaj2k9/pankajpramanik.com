"use client";

import { useState } from "react";
import type { MeetingLocation, MeetingType } from "@prisma/client";
import { saveMeetingType } from "@/actions/booking";
import { LOCATION_LABELS } from "@/lib/booking/labels";
import { ActionForm } from "./ui";
import { inputCls, labelCls } from "../ui";

const DETAIL_HINT: Record<MeetingLocation, string> = {
  GOOGLE_MEET: "Optional. Leave empty to generate a Meet link per booking when Google Calendar is connected.",
  ZOOM: "Your Zoom meeting link (https://…).",
  MICROSOFT_TEAMS: "Your Teams meeting link (https://…).",
  PHONE: "Optional: a number shown to attendees. Leave empty to call the attendee's number (phone becomes required).",
  CUSTOM_LINK: "The meeting link (https://…).",
};

export default function MeetingTypeForm({ type }: { type?: MeetingType }) {
  const [location, setLocation] = useState<MeetingLocation>(type?.locationType ?? "GOOGLE_MEET");
  return (
    <ActionForm action={saveMeetingType.bind(null, type?.id ?? null)} submitLabel={type ? "Save meeting type" : "Create meeting type"}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="name">Name *</label>
          <input id="name" name="name" required maxLength={120} defaultValue={type?.name} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="slug">
            URL slug <span className="text-faint">(auto from name)</span>
          </label>
          <input id="slug" name="slug" maxLength={80} defaultValue={type?.slug} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} maxLength={600} defaultValue={type?.description} className={inputCls} />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="durationMinutes">Duration (minutes) *</label>
          <input id="durationMinutes" name="durationMinutes" type="number" min={5} max={480} required defaultValue={type?.durationMinutes ?? 30} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="bufferBeforeMinutes">Buffer before</label>
          <input id="bufferBeforeMinutes" name="bufferBeforeMinutes" type="number" min={0} max={240} defaultValue={type?.bufferBeforeMinutes ?? 0} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="bufferAfterMinutes">Buffer after</label>
          <input id="bufferAfterMinutes" name="bufferAfterMinutes" type="number" min={0} max={240} defaultValue={type?.bufferAfterMinutes ?? 10} className={inputCls} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="locationType">Location / meeting method *</label>
          <select
            id="locationType"
            name="locationType"
            value={location}
            onChange={(e) => setLocation(e.target.value as MeetingLocation)}
            className={inputCls}
          >
            {(Object.keys(LOCATION_LABELS) as MeetingLocation[]).map((l) => (
              <option key={l} value={l}>
                {LOCATION_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="order">Display order</label>
          <input id="order" name="order" type="number" defaultValue={type?.order ?? 0} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="locationDetail">Location detail</label>
        <input id="locationDetail" name="locationDetail" maxLength={500} defaultValue={type?.locationDetail} className={inputCls} />
        <p className="bka-muted mt-1">{DETAIL_HINT[location]}</p>
      </div>
      <label className="bka-check">
        <input type="checkbox" name="active" defaultChecked={type?.active ?? true} /> Active (bookable on the public page)
      </label>
    </ActionForm>
  );
}
