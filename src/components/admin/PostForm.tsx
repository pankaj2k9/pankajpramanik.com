"use client";

import { useActionState } from "react";
import {
  createPost,
  updatePost,
  type PostFormState,
} from "@/actions/posts";
import { FormError, SubmitButton, inputCls, labelCls } from "./ui";
import RichTextEditor from "./RichTextEditor";
import CoverImageInput from "./CoverImageInput";

type PostData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // always HTML by the time it reaches the form
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
      {/* the WYSIWYG editor always emits HTML */}
      <input type="hidden" name="contentFormat" value="HTML" />

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
        <p className={labelCls}>Content</p>
        <RichTextEditor name="content" defaultValue={post?.content ?? ""} />
      </div>

      <CoverImageInput
        defaultValue={post?.coverImage ?? ""}
        label="Featured image URL"
      />

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

      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">SEO</legend>
        <div>
          <label htmlFor="seoTitle" className={labelCls}>
            SEO title{" "}
            <span className="text-faint">(shown in search results)</span>
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
            SEO description{" "}
            <span className="text-faint">(150–160 characters ideal)</span>
          </label>
          <textarea
            id="seoDescription"
            name="seoDescription"
            rows={2}
            defaultValue={post?.seoDescription ?? ""}
            className={inputCls}
          />
        </div>
      </fieldset>

      <FormError error={state?.error} />
      <SubmitButton pending={pending}>
        {post ? "Update Post" : "Create Post"}
      </SubmitButton>
    </form>
  );
}
