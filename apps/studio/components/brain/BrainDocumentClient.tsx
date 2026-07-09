"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ViewEditToggle } from "@uwe/shared-ui";
import { updateBrainDocumentAction } from "@/app/brain-actions";
import {
  BRAIN_DOCUMENT_TYPE_LABELS,
  BRAIN_SOURCE_LABELS,
  BRAIN_STATUS_LABELS,
  BRAIN_VISIBILITY_LABELS,
} from "@uwe/database/brain-constants";
import { buildPageUrl } from "@uwe/database/page-types";
import type { PageType } from "@uwe/database/enums";

interface Props {
  worldSlug: string;
  document: {
    id: string;
    title: string;
    content: string;
    documentType: keyof typeof BRAIN_DOCUMENT_TYPE_LABELS;
    visibility: keyof typeof BRAIN_VISIBILITY_LABELS;
    status: keyof typeof BRAIN_STATUS_LABELS;
    source: keyof typeof BRAIN_SOURCE_LABELS;
    chunks: unknown[];
    page?: { type: string; slug: string; title: string } | null;
  };
}

export function BrainDocumentClient({ worldSlug, document }: Props) {
  const router = useRouter();
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const readView = (
    <article className="uwe-v2-card uwe-v2-card-padded">
      <p className="uwe-brain-meta">
        {BRAIN_DOCUMENT_TYPE_LABELS[document.documentType]} ·{" "}
        {BRAIN_VISIBILITY_LABELS[document.visibility]} · {BRAIN_STATUS_LABELS[document.status]}
      </p>
      {document.content ? (
        <p style={{ whiteSpace: "pre-wrap", marginTop: "1rem" }}>{document.content}</p>
      ) : (
        <p className="uwe-dashboard-muted">Kein Inhalt.</p>
      )}
      <p className="uwe-brain-meta" style={{ marginTop: "1rem" }}>
        Quelle: {BRAIN_SOURCE_LABELS[document.source]} · {document.chunks.length} Chunks
        {document.page ? (
          <>
            {" "}
            · Seite:{" "}
            <Link href={buildPageUrl(worldSlug, document.page.type as PageType, document.page.slug)}>
              {document.page.title}
            </Link>
          </>
        ) : null}
      </p>
    </article>
  );

  const editView = (
    <form
      action={async (formData) => {
        await updateBrainDocumentAction(formData);
        setSavedHint("Gespeichert.");
        router.refresh();
      }}
      className="uwe-brain-edit-form"
    >
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="documentId" value={document.id} />
      <label>
        Titel
        <input name="title" defaultValue={document.title} required className="uwe-input" />
      </label>
      <label>
        Inhalt
        <textarea name="content" defaultValue={document.content} className="uwe-input" rows={12} />
      </label>
      <label>
        Typ
        <select name="documentType" defaultValue={document.documentType} className="uwe-input">
          {Object.entries(BRAIN_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sichtbarkeit
        <select name="visibility" defaultValue={document.visibility} className="uwe-input">
          {Object.entries(BRAIN_VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={document.status} className="uwe-input">
          {Object.entries(BRAIN_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
        Speichern
      </button>
      {savedHint ? <p className="uwe-dashboard-muted">{savedHint}</p> : null}
    </form>
  );

  return <ViewEditToggle view={readView} edit={editView} />;
}
