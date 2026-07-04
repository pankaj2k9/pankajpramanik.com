"use client";

import { useActionState } from "react";
import {
  createProject,
  updateProject,
  type ProjectFormState,
} from "@/actions/projects";
import { FormError, SubmitButton, inputCls, labelCls } from "./ui";

type ProjectData = {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  content: string;
  techStack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  category: string;
  featured: boolean;
  order: number;
  status: "DRAFT" | "PUBLISHED";
};

export default function ProjectForm({ project }: { project?: ProjectData }) {
  const action = project ? updateProject.bind(null, project.id) : createProject;
  const [state, formAction, pending] = useActionState<
    ProjectFormState,
    FormData
  >(action, undefined);

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
          Description
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
        <label htmlFor="content" className={labelCls}>
          Case study <span className="text-faint">(optional, Markdown)</span>
        </label>
        <textarea
          id="content"
          name="content"
          rows={10}
          defaultValue={project?.content}
          className={`${inputCls} font-mono text-xs leading-relaxed`}
        />
      </div>

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

      <FormError error={state?.error} />
      <SubmitButton pending={pending}>
        {project ? "Update Project" : "Create Project"}
      </SubmitButton>
    </form>
  );
}
