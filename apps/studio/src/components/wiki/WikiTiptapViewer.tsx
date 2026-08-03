"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { sanitizeHtml } from "@/src/lib/sanitize-html";
export function WikiTiptapViewer({ html, className }: { html: string; className?: string }) {
  const safeHtml = useMemo(() => sanitizeHtml(html), [html]);
  const editor = useEditor({ extensions:[StarterKit], content:safeHtml||"<p></p>", editable:false, immediatelyRender:false, editorProps:{attributes:{class:"wiki-content uwe-v2-wiki-content"}}});
  useEffect(()=>{editor?.commands.setContent(safeHtml||"<p></p>", { emitUpdate: false });},[editor,safeHtml]);
  return editor ? <div className={className}><EditorContent editor={editor}/></div> : <article className={className} dangerouslySetInnerHTML={{__html:safeHtml}}/>;
}
