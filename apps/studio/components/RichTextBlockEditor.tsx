"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

interface RichTextBlockEditorProps {
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
}

function toEditorHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) return trimmed;
  const escaped = trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br />")}</p>`;
}

export function RichTextBlockEditor({
  name,
  defaultValue = "",
  rows = 6,
  placeholder = "Rich Text…",
}: RichTextBlockEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [StarterKit],
    content: toEditorHtml(defaultValue),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "uwe-rich-text-editor__surface",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: current }) => {
      if (inputRef.current) {
        inputRef.current.value = current.getHTML();
      }
    },
  });

  useEffect(() => {
    if (!editor || !inputRef.current) return;
    inputRef.current.value = editor.getHTML();
  }, [editor]);

  const minHeight = Math.max(rows * 1.4, 6);

  return (
    <div className="uwe-rich-text-editor" style={{ minHeight: `${minHeight}rem` }}>
      <input ref={inputRef} type="hidden" name={name} defaultValue={toEditorHtml(defaultValue)} />
      <div className="uwe-rich-text-editor__toolbar">
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-ghost"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-ghost"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-ghost"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          •
        </button>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-ghost"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          1.
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
