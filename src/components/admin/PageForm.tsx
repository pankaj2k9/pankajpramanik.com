"use client";

import { useActionState } from "react";
import { updatePage, type PageFormState } from "@/actions/pages";
import { FormError, SubmitButton, inputCls, labelCls } from "./ui";

type PageData = {
  id: string;
  slug: string;
  kind: "GENERIC" | "SERVICE";
  label: string;
  summary: string;
  title: string;
  content: string;
  contentFormat: "HTML" | "MARKDOWN";
  seoTitle: string | null;
  seoDescription: string | null;
};

export default function PageForm({ page }: { page: PageData }) {
  const [state, formAction, pending] = useActionState<PageFormState, FormData>(
    updatePage.bind(null, page.id),
    undefined
  );

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <div>
        <label htmlFor="title" className={labelCls}>
          Title *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={page.title}
          className={inputCls}
        />
      </div>

      {page.kind === "SERVICE" && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="label" className={labelCls}>
              Card label <span className="text-faint">(short name in grids)</span>
            </label>
            <input
              id="label"
              name="label"
              defaultValue={page.label}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="summary" className={labelCls}>
              Card summary
            </label>
            <input
              id="summary"
              name="summary"
              defaultValue={page.summary}
              className={inputCls}
            />
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="content" className="text-sm font-medium">
            Content
          </label>
          <select
            name="contentFormat"
            defaultValue={page.contentFormat}
            className="rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs"
            aria-label="Content format"
          >
            <option value="HTML">HTML</option>
            <option value="MARKDOWN">Markdown</option>
          </select>
        </div>
        <textarea
          id="content"
          name="content"
          rows={20}
          defaultValue={page.content}
          className={`${inputCls} font-mono text-xs leading-relaxed`}
        />
      </div>

      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">SEO</legend>
        <div>
          <label htmlFor="seoTitle" className={labelCls}>
            SEO title
          </label>
          <input
            id="seoTitle"
            name="seoTitle"
            defaultValue={page.seoTitle ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="seoDescription" className={labelCls}>
            SEO description
          </label>
          <textarea
            id="seoDescription"
            name="seoDescription"
            rows={2}
            defaultValue={page.seoDescription ?? ""}
            className={inputCls}
          />
        </div>
      </fieldset>

      <FormError error={state?.error} />
      <SubmitButton pending={pending}>Update Page</SubmitButton>
    </form>
  );
}
