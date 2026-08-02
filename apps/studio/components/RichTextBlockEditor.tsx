"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { DM_SECTION_CLOSE, DM_SECTION_OPEN } from "@uwe/auth/dm-section";
import { Button } from "@/src/components/ui";

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
  // Editor-Konfiguration (Extensions/editorProps) bewusst unverändert — nur Toolbar/Hülle migriert.
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
    <div
      className="flex flex-col gap-2 rounded-[var(--radius)] border border-input bg-muted/30 p-2"
      style={{ minHeight: `${minHeight}rem` }}
    >
      <input ref={inputRef} type="hidden" name={name} defaultValue={toEditorHtml(defaultValue)} />
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBold().run()}>
          B
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          I
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          •
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          1.
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title={`DM-Bereich einfügen — alles zwischen ${DM_SECTION_OPEN} und ${DM_SECTION_CLOSE} sehen nur Studio-Mitglieder`}
          onClick={() => insertDmSection(editor)}
        >
          Nur DM
        </Button>
      </div>
      <EditorContent editor={editor} />
      <p className="text-xs text-muted-foreground">
        <code>{DM_SECTION_OPEN}</code> … <code>{DM_SECTION_CLOSE}</code> markiert einen DM-Bereich.
        Spieler bekommen ihn gar nicht erst geschickt.
      </p>
    </div>
  );
}

/**
 * Fügt einen leeren DM-Bereich als drei gewöhnliche Absätze ein.
 *
 * Bewusst kein eigener TipTap-Knoten: die Marken sollen auch dann überleben,
 * wenn derselbe Block später über das einfache Textfeld, einen Import oder die
 * KI bearbeitet wird. Ein Knoten, den nur dieser Editor kennt, ginge dabei
 * verloren.
 */
function insertDmSection(editor: ReturnType<typeof useEditor>): void {
  if (!editor) return;
  const selected = editor.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to,
    "\n",
  );
  const body = selected.trim() || "Nur für den DM.";
  editor
    .chain()
    .focus()
    .insertContent(
      `<p>${DM_SECTION_OPEN}</p><p>${escapeHtmlText(body)}</p><p>${DM_SECTION_CLOSE}</p>`,
    )
    .run();
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
