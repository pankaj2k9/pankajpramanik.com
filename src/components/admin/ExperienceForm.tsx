"use client";

import { useActionState } from "react";
import {
  createExperience,
  updateExperience,
  type ExperienceFormState,
} from "@/actions/experiences";
import { FormError, SubmitButton, inputCls, labelCls } from "./ui";

type ExperienceData = {
  id: string;
  role: string;
  company: string;
  companyUrl: string | null;
  location: string;
  startDate: Date;
  endDate: Date | null;
  current: boolean;
  summary: string;
  techStack: string[];
  highlights: string[];
  order: number;
};

const toMonthInput = (d: Date | null) =>
  d ? new Date(d).toISOString().slice(0, 7) : "";

export default function ExperienceForm({
  experience,
}: {
  experience?: ExperienceData;
}) {
  const action = experience
    ? updateExperience.bind(null, experience.id)
    : createExperience;
  const [state, formAction, pending] = useActionState<
    ExperienceFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="role" className={labelCls}>
            Role *
          </label>
          <input
            id="role"
            name="role"
            required
            defaultValue={experience?.role}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="company" className={labelCls}>
            Company *
          </label>
          <input
            id="company"
            name="company"
            required
            defaultValue={experience?.company}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="companyUrl" className={labelCls}>
            Company URL
          </label>
          <input
            id="companyUrl"
            name="companyUrl"
            type="url"
            defaultValue={experience?.companyUrl ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="location" className={labelCls}>
            Location
          </label>
          <input
            id="location"
            name="location"
            defaultValue={experience?.location ?? "Remote"}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label htmlFor="startDate" className={labelCls}>
            Start *
          </label>
          <input
            id="startDate"
            name="startDate"
            type="month"
            required
            defaultValue={toMonthInput(experience?.startDate ?? null)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="endDate" className={labelCls}>
            End
          </label>
          <input
            id="endDate"
            name="endDate"
            type="month"
            defaultValue={toMonthInput(experience?.endDate ?? null)}
            className={inputCls}
          />
        </div>
        <label className="flex items-center gap-2 pb-3 text-sm">
          <input
            type="checkbox"
            name="current"
            defaultChecked={experience?.current}
            className="accent-indigo-500"
          />
          Current position
        </label>
      </div>

      <div>
        <label htmlFor="summary" className={labelCls}>
          Summary <span className="text-faint">(one-line subtitle)</span>
        </label>
        <input
          id="summary"
          name="summary"
          defaultValue={experience?.summary}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="highlights" className={labelCls}>
          Highlights <span className="text-faint">(one per line)</span>
        </label>
        <textarea
          id="highlights"
          name="highlights"
          rows={6}
          defaultValue={experience?.highlights.join("\n")}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="techStack" className={labelCls}>
          Tech stack <span className="text-faint">(comma separated)</span>
        </label>
        <input
          id="techStack"
          name="techStack"
          defaultValue={experience?.techStack.join(", ")}
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="order" className="text-sm">
          Order <span className="text-faint">(lower = first)</span>
        </label>
        <input
          id="order"
          name="order"
          type="number"
          defaultValue={experience?.order ?? 0}
          className={`${inputCls} w-24`}
        />
      </div>

      <FormError error={state?.error} />
      <SubmitButton pending={pending}>
        {experience ? "Update Experience" : "Create Experience"}
      </SubmitButton>
    </form>
  );
}
