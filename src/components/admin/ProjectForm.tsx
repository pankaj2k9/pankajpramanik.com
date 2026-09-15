"use client";

import { useActionState } from "react";
import {
  createProject,
  updateProject,
  type ProjectFormState,
} from "@/actions/projects";
import { FormError, SubmitButton, inputCls, labelCls } from "./ui";
import RichTextEditor from "./RichTextEditor";
import CoverImageInput from "./CoverImageInput";

type ProjectData = {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  content: string; // always HTML by the time it reaches the form
  techStack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  coverImage: string | null;
  problem: string;
  approach: string;
  outcome: string;
  evidenceUrl: string | null;
  category: string;
  featured: boolean;
  order: number;
  status: "DRAFT" | "PUBLISHED";
  seoTitle: string | null;
  seoDescription: string | null;
};

export default function ProjectForm({ project }: { project?: ProjectData }) {
  const action = project ? updateProject.bind(null, project.id) : createProject;
  const [state, formAction, pending] = useActionState<
    ProjectFormState,
    FormData
  >(action, undefined);

  return (
    <form
      action={formAction}
      onReset={(event) => event.preventDefault()}
      className="max-w-3xl space-y-6"
    >
      <input type="hidden" name="contentFormat" value="HTML" />

      <div>
        <label htmlFor="title" className={labelCls}>
          Title *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={project?.title}
          className={inputCls}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="slug" className={labelCls}>
            Slug <span className="text-faint">(blank = from title)</span>
          </label>
          <input
            id="slug"
            name="slug"
            defaultValue={project?.slug}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="category" className={labelCls}>
            Category
          </label>
          <input
            id="category"
            name="category"
            defaultValue={project?.category ?? "AI / LLM"}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="tagline" className={labelCls}>
          Tagline
        </label>
        <input
          id="tagline"
          name="tagline"
          defaultValue={project?.tagline}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>
          Description <span className="text-faint">(Overview tab)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={project?.description}
          className={inputCls}
        />
      </div>

      <div>
        <p className={labelCls}>
          Case study <span className="text-faint">(Case Study tab)</span>
        </p>
        <RichTextEditor
          name="content"
          defaultValue={project?.content ?? ""}
          minHeight={260}
        />
      </div>

      <fieldset className="space-y-5 rounded-xl border border-border p-5">
        <legend className="px-2 font-semibold">Expandable case study</legend>
        <p className="text-sm text-muted">
          Describe the actual project. Publish outcomes only with evidence;
          leave blank when not measured.
        </p>
        {(
          [
            { name: "problem", label: "Problem / scope", limit: 2000 },
            { name: "approach", label: "Approach", limit: 4000 },
            { name: "outcome", label: "Verified outcome", limit: 2000 },
          ] as const
        ).map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className={labelCls}>
              {field.label}
            </label>
            <textarea
              id={field.name}
              name={field.name}
              rows={3}
              maxLength={field.limit}
              defaultValue={project?.[field.name] ?? ""}
              className={inputCls}
            />
          </div>
        ))}
        <div>
          <label htmlFor="evidenceUrl" className={labelCls}>
            Evidence URL (required for an outcome)
          </label>
          <input
            id="evidenceUrl"
            name="evidenceUrl"
            type="url"
            defaultValue={project?.evidenceUrl ?? ""}
            className={inputCls}
          />
          <p className="mt-2 text-xs text-muted">
            Link to a report, reproducible benchmark, repository, or approved
            case study that supports the claim.
          </p>
        </div>
      </fieldset>
      <CoverImageInput defaultValue={project?.coverImage ?? ""} />

      <div>
        <label htmlFor="techStack" className={labelCls}>
          Tech stack <span className="text-faint">(comma separated)</span>
        </label>
        <input
          id="techStack"
          name="techStack"
          defaultValue={project?.techStack.join(", ")}
          className={inputCls}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="repoUrl" className={labelCls}>
            Repository URL
          </label>
          <input
            id="repoUrl"
            name="repoUrl"
            type="url"
            defaultValue={project?.repoUrl ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="liveUrl" className={labelCls}>
            Live URL
          </label>
          <input
            id="liveUrl"
            name="liveUrl"
            type="url"
            defaultValue={project?.liveUrl ?? ""}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={project?.featured}
            className="accent-indigo-500"
          />
          Featured on homepage
        </label>
        <div className="flex items-center gap-2">
          <label htmlFor="order" className="text-sm">
            Order
          </label>
          <input
            id="order"
            name="order"
            type="number"
            defaultValue={project?.order ?? 0}
            className={`${inputCls} w-24`}
          />
        </div>
        <select
          name="status"
          defaultValue={project?.status ?? "PUBLISHED"}
          className={`${inputCls} w-36`}
          aria-label="Status"
        >
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
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
            defaultValue={project?.seoTitle ?? ""}
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
            defaultValue={project?.seoDescription ?? ""}
            className={inputCls}
          />
        </div>
      </fieldset>

      <FormError error={state?.error} />
      <SubmitButton pending={pending}>
        {project ? "Update Project" : "Create Project"}
      </SubmitButton>
    </form>
  );
}
