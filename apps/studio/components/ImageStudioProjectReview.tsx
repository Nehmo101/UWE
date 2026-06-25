"use client";

import Link from "next/link";
import { useState } from "react";
import type { ImageStudioStatus } from "@uwe/database/server";
import {
  adoptImageStudioAssetAction,
  saveImageStudioDraftAction,
} from "@/app/integration-actions";
import { ImageStudioStatusBadge } from "@/components/ImageStudioStatusBadge";

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
    <div className="uwe-image-studio-review">
      <section className="uwe-v2-card">
        <h2 className="uwe-v2-section-title">Projekt</h2>
        <dl className="uwe-kv-list">
          <div>
            <dt>Status</dt>
            <dd>
              <ImageStudioStatusBadge status={status} label={statusLabel} />
            </dd>
          </div>
          <div>
            <dt>Welt</dt>
            <dd>{worldSlug ?? "—"}</dd>
          </div>
        </dl>

        <div className="uwe-form" style={{ marginTop: "1rem" }}>
          <label>
            Titel
            <input
              className="uwe-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
            />
          </label>
          <label>
            Prompt / Notiz
            <textarea
              className="uwe-input"
              rows={4}
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            disabled={pending}
            onClick={() => void saveDraft()}
          >
            Entwurf speichern
          </button>
        </div>
      </section>

      <section className="uwe-v2-card" style={{ marginTop: "1.5rem" }}>
        <h2 className="uwe-v2-section-title">Versionen</h2>
        {versions.length === 0 ? (
          <p className="uwe-v2-empty">Noch keine Versionen.</p>
        ) : (
          <ul className="uwe-list-cards">
            {versions.map((version) => (
              <li key={version.id} className="uwe-list-card">
                <strong>v{version.versionNumber}</strong>
                <span className="uwe-badge">{version.operation}</span>
                {version.prompt ? (
                  <p className="uwe-dashboard-muted">{version.prompt.slice(0, 120)}</p>
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
          <p style={{ marginTop: "1rem" }}>
            <Link
              href={`/image-studio/${projectId}/edit`}
              className="uwe-v2-btn uwe-v2-btn-primary"
            >
              Canvas-Editor öffnen
            </Link>
          </p>
        ) : null}
      </section>

      {links.length > 0 && latestWithAsset?.assetId ? (
        <section className="uwe-v2-card" style={{ marginTop: "1.5rem" }}>
          <h2 className="uwe-v2-section-title">Verknüpfung übernehmen</h2>
          <ul className="uwe-list-plain">
            {links.map((link) => (
              <li key={`${link.targetType}-${link.targetId}`}>
                {link.targetType}: <code>{link.targetId}</code>
                {link.targetType === "page" ? (
                  <button
                    type="button"
                    className="uwe-v2-btn uwe-v2-btn-secondary"
                    style={{ marginLeft: "0.5rem" }}
                    disabled={pending}
                    onClick={() => void adoptToPage(link.targetId)}
                  >
                    Asset übernehmen
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {message ? <p className="uwe-notice">{message}</p> : null}
    </div>
  );
}
