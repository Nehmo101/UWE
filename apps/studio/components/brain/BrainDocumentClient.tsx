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
import { Button, Card, Input, Label, Textarea } from "@/src/components/ui";

/** TODO(design-kit): natives Select statt Kit-Select — Server-Action-Formular (FormData)
 * braucht name/defaultValue ohne Client-State; Kit-Select (Radix) unterstützt das nicht. */
const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
    <Card className="flex flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground">
        {BRAIN_DOCUMENT_TYPE_LABELS[document.documentType]} ·{" "}
        {BRAIN_VISIBILITY_LABELS[document.visibility]} · {BRAIN_STATUS_LABELS[document.status]}
      </p>
      {document.content ? (
        <p className="whitespace-pre-wrap">{document.content}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Kein Inhalt.</p>
      )}
      <p className="text-sm text-muted-foreground">
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
    </Card>
  );

  const editView = (
    <form
      action={async (formData) => {
        await updateBrainDocumentAction(formData);
        setSavedHint("Gespeichert.");
        router.refresh();
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="documentId" value={document.id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brain-document-title">Titel</Label>
        <Input id="brain-document-title" name="title" defaultValue={document.title} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brain-document-content">Inhalt</Label>
        <Textarea id="brain-document-content" name="content" defaultValue={document.content} rows={12} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brain-document-type">Typ</Label>
        <select
          id="brain-document-type"
          name="documentType"
          defaultValue={document.documentType}
          className={SELECT_CLASS}
        >
          {Object.entries(BRAIN_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brain-document-visibility">Sichtbarkeit</Label>
        <select
          id="brain-document-visibility"
          name="visibility"
          defaultValue={document.visibility}
          className={SELECT_CLASS}
        >
          {Object.entries(BRAIN_VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brain-document-status">Status</Label>
        <select id="brain-document-status" name="status" defaultValue={document.status} className={SELECT_CLASS}>
          {Object.entries(BRAIN_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit">Speichern</Button>
      {savedHint ? <p className="text-sm text-muted-foreground">{savedHint}</p> : null}
    </form>
  );

  return <ViewEditToggle view={readView} edit={editView} />;
}
