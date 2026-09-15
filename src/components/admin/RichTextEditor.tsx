"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExt from "@tiptap/extension-image";
import { cn } from "@/lib/utils";
import { UPLOAD_ACCEPT, uploadMedia } from "./upload";

function ToolbarButton({
  label,
  onClick,
  isActive,
  title,
}: {
  label: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
        isActive
          ? "bg-accent-strong/20 text-accent"
          : "text-muted hover:bg-surface-raised hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * WYSIWYG editor (TipTap v3) used for post/project/page content in the
 * admin. Produces sanitized-at-render HTML; the value is submitted through
 * a hidden input so it works with plain form actions.
 */
export default function RichTextEditor({
  name,
  defaultValue = "",
  minHeight = 360,
}: {
  name: string;
  defaultValue?: string;
  minHeight?: number;
}) {
  const [html, setHtml] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
        heading: { levels: [2, 3, 4] },
      }),
      ImageExt.configure({ inline: false }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class: "prose-content focus:outline-none px-4 py-3",
        role: "textbox",
        "aria-label": "Rich text content",
        "aria-multiline": "true",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            h2: editor.isActive("heading", { level: 2 }),
            h3: editor.isActive("heading", { level: 3 }),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
            codeBlock: editor.isActive("codeBlock"),
            link: editor.isActive("link"),
          }
        : null,
  });

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (empty to remove)", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function addImage() {
    if (!editor) return;
    const url = window.prompt(
      "Image URL (e.g. /uploads/2026/06/photo.jpg or https://…)",
    );
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }

  async function uploadImage(file: File | undefined) {
    if (!editor || !file) return;
    setUploading(true);
    try {
      const src = await uploadMedia(file);
      editor.chain().focus().setImage({ src }).run();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const Btn = ToolbarButton;

  return (
    <div className="rounded-xl border border-border bg-surface-raised">
      <input type="hidden" name={name} value={html} />
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        <Btn
          title="Heading 2"
          label="H2"
          isActive={active?.h2}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <Btn
          title="Heading 3"
          label="H3"
          isActive={active?.h3}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Btn
          title="Bold"
          label={<strong>B</strong>}
          isActive={active?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <Btn
          title="Italic"
          label={<em>I</em>}
          isActive={active?.italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <Btn
          title="Strikethrough"
          label={<s>S</s>}
          isActive={active?.strike}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Btn
          title="Bullet list"
          label="• List"
          isActive={active?.bulletList}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <Btn
          title="Numbered list"
          label="1. List"
          isActive={active?.orderedList}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <Btn
          title="Quote"
          label="❝"
          isActive={active?.blockquote}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <Btn
          title="Code block"
          label="</>"
          isActive={active?.codeBlock}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Btn
          title="Add or edit link"
          label="Link"
          isActive={active?.link}
          onClick={setLink}
        />
        <Btn title="Insert image by URL" label="Image" onClick={addImage} />
        <Btn
          title="Upload an image into storage"
          label={uploading ? "Uploading…" : "Upload"}
          onClick={() => !uploading && fileRef.current?.click()}
        />
        <input
          ref={fileRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          aria-label="Upload image"
          onChange={(e) => uploadImage(e.target.files?.[0])}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Btn
          title="Undo"
          label="↺"
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <Btn
          title="Redo"
          label="↻"
          onClick={() => editor?.chain().focus().redo().run()}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
