"use client";

import Link from "next/link";
import { ViewEditToggle } from "@uwe/shared-ui";
import {
  updateLifeBrainDocumentAction,
  deleteLifeBrainDocumentAction,
  updateLifeBrainDocumentTagsAction,
} from "@/app/life-admin-actions";
import { indexLifeBrainDocumentAction } from "@/app/life-brain-actions";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "@/src/components/ui";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface LinkedCapture {
  id: string;
  title: string | null;
  captureType: string;
  capturedAt: Date;
  content: string | null;
  url: string | null;
}

interface Props {
  document: {
    id: string;
    title: string;
    category: string | null;
    content: string | null;
    updatedAt: Date;
    createdAt: Date;
  };
  categoryLabel: string;
  tags: string[];
  linkedCaptures: LinkedCapture[];
  captureTypeLabels: Record<string, string>;
}

export function LifeBrainDocumentClient({
  document,
  categoryLabel,
  tags,
  linkedCaptures,
  captureTypeLabels,
}: Props) {
  const readView = (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <p className="text-sm text-muted-foreground">
          Kategorie: {categoryLabel} · Tags: {tags.length > 0 ? tags.join(", ") : "—"} · Aktualisiert:{" "}
          {DATE_FORMAT.format(document.updatedAt)}
        </p>
        {document.content ? (
          <div>
            <h2 className="text-sm font-semibold">Inhalt</h2>
            <p className="whitespace-pre-wrap">{document.content}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const editView = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <form action={updateLifeBrainDocumentAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={document.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="life-brain-document-title">Titel</Label>
              <Input id="life-brain-document-title" name="title" defaultValue={document.title} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="life-brain-document-content">Inhalt</Label>
              <Textarea
                id="life-brain-document-content"
                name="content"
                rows={12}
                defaultValue={document.content ?? ""}
              />
            </div>
            <Button type="submit" size="sm" className="self-start">
              Speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateLifeBrainDocumentTagsAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={document.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="life-brain-document-tags">Tags (kommagetrennt)</Label>
              <Input
                id="life-brain-document-tags"
                name="tags"
                defaultValue={tags.join(", ")}
                placeholder="recht, vertrag"
              />
            </div>
            <Button type="submit" size="sm" className="self-end">
              Tags speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <form action={deleteLifeBrainDocumentAction}>
        <input type="hidden" name="id" value={document.id} />
        <Button type="submit" variant="secondary" size="sm">
          Dokument löschen
        </Button>
      </form>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <ViewEditToggle view={readView} edit={editView} />
      {linkedCaptures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quellen / Captures</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {linkedCaptures.map((capture) => (
                <li key={capture.id} className="rounded-[var(--radius)] border border-border bg-card p-3.5">
                  <strong>
                    <Link href={`/capture/${capture.id}`}>{capture.title || "Capture"}</Link>
                  </strong>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {captureTypeLabels[capture.captureType] ?? capture.captureType} ·{" "}
                    {DATE_FORMAT.format(capture.capturedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Indexierung</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={indexLifeBrainDocumentAction}>
            <input type="hidden" name="documentId" value={document.id} />
            <Button type="submit" variant="secondary" size="sm">
              Embedding neu erzeugen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
