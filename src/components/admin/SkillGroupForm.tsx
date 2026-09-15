"use client";

import { useActionState } from "react";
import {
  createSkillGroup,
  updateSkillGroup,
  type SkillFormState,
} from "@/actions/skills";
import { FormError, SubmitButton, inputCls, labelCls } from "./ui";

type SkillGroupData = {
  id: string;
  category: string;
  items: string[];
  order: number;
};

export default function SkillGroupForm({ group }: { group?: SkillGroupData }) {
  const action = group
    ? updateSkillGroup.bind(null, group.id)
    : createSkillGroup;
  const [state, formAction, pending] = useActionState<SkillFormState, FormData>(
    action,
    undefined,
  );

  return (
    <form
      action={formAction}
      onReset={(event) => event.preventDefault()}
      className="max-w-2xl space-y-6"
    >
      <div className="grid gap-6 sm:grid-cols-[1fr_8rem]">
        <div>
          <label htmlFor="category" className={labelCls}>
            Category *{" "}
            <span className="text-faint">(e.g. Generative AI · LLM)</span>
          </label>
          <input
            id="category"
            name="category"
            required
            defaultValue={group?.category}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="order" className={labelCls}>
            Order
          </label>
          <input
            id="order"
            name="order"
            type="number"
            defaultValue={group?.order ?? 0}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="items" className={labelCls}>
          Skills * <span className="text-faint">(comma separated)</span>
        </label>
        <textarea
          id="items"
          name="items"
          required
          rows={4}
          defaultValue={group?.items.join(", ")}
          className={inputCls}
        />
      </div>

      <FormError error={state?.error} />
      <SubmitButton pending={pending}>
        {group ? "Update Skill Group" : "Create Skill Group"}
      </SubmitButton>
    </form>
  );
}
