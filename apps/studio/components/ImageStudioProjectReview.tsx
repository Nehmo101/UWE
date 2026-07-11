"use client";

import Link from "next/link";
import { useState } from "react";
import type { ImageStudioStatus } from "@uwe/database/integrations-ui";
import {
  adoptImageStudioAssetAction,
  saveImageStudioDraftAction,
} from "@/app/integration-actions";
import { ImageStudioStatusBadge } from "@/components/ImageStudioStatusBadge";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

interface VersionRow {
  id: string;
  versionNumber: number;
  operation: string;
  prompt: string | null;
  assetId: string | null;
  providerMode: string | null;
}

interface LinkRow {
  targetType: string;
  targetId: string;
}

interface ImageStudioProjectReviewProps {
  projectId: string;
  title: string;
  prompt: string | null;
  status: ImageStudioStatus;
  statusLabel: string;
  worldSlug: string | null;
  versions: VersionRow[];
  links: LinkRow[];
}

export function ImageStudioProjectReview({
  projectId,
  title,
  prompt,
  status,
  statusLabel,
  worldSlug,
  versions,
  links,
}: ImageStudioProjectReviewProps) {
  const [draftPrompt, setDraftPrompt] = useState(prompt ?? "");
  const [draftTitle, setDraftTitle] = useState(title);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const latestWithAsset = versions.find((version) => version.assetId);

  async function saveDraft() {
    setPending(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("prompt", draftPrompt);
      formData.set("title", draftTitle);
      await saveImageStudioDraftAction(formData);
      setMessage("Entwurf gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  async function adoptToPage(pageId: string) {
    if (!latestWithAsset?.assetId || !worldSlug) return;
    setPending(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("assetId", latestWithAsset.assetId);
      formData.set("targetType", "page");
      formData.set("targetId", pageId);
      formData.set("worldSlug", worldSlug);
      await adoptImageStudioAssetAction(formData);
      setMessage("Asset übernommen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Übernahme fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Projekt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[minmax(6rem,10rem)_1fr] gap-x-4 gap-y-1 text-sm [&>dt]:text-muted-foreground [&>dd]:m-0">
            <dt>Status</dt>
            <dd>
              <ImageStudioStatusBadge status={status} label={statusLabel} />
            </dd>
            <dt>Welt</dt>
            <dd>{worldSlug ?? "—"}</dd>
          </dl>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="image-studio-review-title">Titel</Label>
              <Input
                id="image-studio-review-title"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="image-studio-review-prompt">Prompt / Notiz</Label>
              <Textarea
                id="image-studio-review-prompt"
                rows={4}
                value={draftPrompt}
                onChange={(event) => setDraftPrompt(event.target.value)}
              />
            </div>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void saveDraft()}>
              Entwurf speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Versionen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Versionen.</p>
          ) : (
            <ul className="grid gap-2">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-card-foreground shadow-sm"
                >
                  <strong>v{version.versionNumber}</strong>
                  <Badge>{version.operation}</Badge>
                  {version.prompt ? (
                    <p className="basis-full text-sm text-muted-foreground">{version.prompt.slice(0, 120)}</p>
                  ) : null}
                  {version.assetId ? (
                    <Link href={`/api/assets/${version.assetId}/file`} target="_blank">
                      Vorschau
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {latestWithAsset?.assetId ? (
            <Link href={`/image-studio/${projectId}/edit`} className={buttonVariants({ variant: "default" })}>
              Canvas-Editor öffnen
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {links.length > 0 && latestWithAsset?.assetId ? (
        <Card>
          <CardHeader>
            <CardTitle>Verknüpfung übernehmen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {links.map((link) => (
                <li key={`${link.targetType}-${link.targetId}`} className="flex flex-wrap items-center gap-2">
                  <span>
                    {link.targetType}: <code>{link.targetId}</code>
                  </span>
                  {link.targetType === "page" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => void adoptToPage(link.targetId)}
                    >
                      Asset übernehmen
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {message ? <Alert tone="success">{message}</Alert> : null}
    </div>
  );
}
