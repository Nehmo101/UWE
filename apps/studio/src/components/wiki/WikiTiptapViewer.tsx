"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
export function WikiTiptapViewer({ html, className }: { html: string; className?: string }) {
  const editor = useEditor({ extensions:[StarterKit], content:html||"<p></p>", editable:false, immediatelyRender:false, editorProps:{attributes:{class:"wiki-content uwe-v2-wiki-content"}}});
  useEffect(()=>{editor?.commands.setContent(html||"<p></p>", false);},[editor,html]);
  return editor ? <div className={className}><EditorContent editor={editor}/></div> : <article className={className} dangerouslySetInnerHTML={{__html:html}}/>;
}
