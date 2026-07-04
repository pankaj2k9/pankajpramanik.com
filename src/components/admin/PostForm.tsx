"use client";

import { useActionState } from "react";
import {
  createPost,
  updatePost,
  type PostFormState,
} from "@/actions/posts";
import { FormError, SubmitButton, inputCls, labelCls } from "./ui";

type PostData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentFormat: "HTML" | "MARKDOWN";
  coverImage: string | null;
  status: "DRAFT" | "PUBLISHED";
  seoTitle: string | null;
  seoDescription: string | null;
  categories: { id: string }[];
  tags: { name: string }[];
};

export default function PostForm({
  post,
  allCategories,
}: {
  post?: PostData;
  allCategories: { id: string; name: string }[];
}) {
  const action = post ? updatePost.bind(null, post.id) : createPost;
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(
    action,
    undefined
  );
  const selected = new Set(post?.categories.map((c) => c.id));

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
          defaultValue={post?.title}
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
            defaultValue={post?.slug}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="status" className={labelCls}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={post?.status ?? "DRAFT"}
            className={inputCls}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="excerpt" className={labelCls}>
          Excerpt
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          defaultValue={post?.excerpt}
          className={inputCls}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="content" className="text-sm font-medium">
            Content
          </label>
          <select
            name="contentFormat"
            defaultValue={post?.contentFormat ?? "MARKDOWN"}
            className="rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs"
            aria-label="Content format"
          >
            <option value="MARKDOWN">Markdown</option>
            <option value="HTML">HTML</option>
          </select>
        </div>
        <textarea
          id="content"
          name="content"
          rows={18}
          defaultValue={post?.content}
          className={`${inputCls} font-mono text-xs leading-relaxed`}
        />
      </div>

      <div>
        <label htmlFor="coverImage" className={labelCls}>
          Cover image URL{" "}
          <span className="text-faint">(e.g. /uploads/2024/01/img.jpg)</span>
        </label>
        <input
          id="coverImage"
          name="coverImage"
          defaultValue={post?.coverImage ?? ""}
          className={inputCls}
        />
      </div>

      <fieldset>
        <legend className={labelCls}>Categories</legend>
        <div className="flex flex-wrap gap-3">
          {allCategories.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted"
            >
              <input
                type="checkbox"
                name="categoryIds"
                value={c.id}
                defaultChecked={selected.has(c.id)}
                className="accent-indigo-500"
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="tagNames" className={labelCls}>
          Tags <span className="text-faint">(comma separated)</span>
        </label>
        <input
          id="tagNames"
          name="tagNames"
          defaultValue={post?.tags.map((t) => t.name).join(", ")}
          className={inputCls}
        />
      </div>

      <details className="card p-5">
        <summary className="cursor-pointer text-sm font-medium">
          SEO settings
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="seoTitle" className={labelCls}>
              SEO title
            </label>
            <input
              id="seoTitle"
              name="seoTitle"
              defaultValue={post?.seoTitle ?? ""}
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
              defaultValue={post?.seoDescription ?? ""}
              className={inputCls}
            />
          </div>
        </div>
      </details>

      <FormError error={state?.error} />
      <SubmitButton pending={pending}>
        {post ? "Update Post" : "Create Post"}
      </SubmitButton>
    </form>
  );
}
