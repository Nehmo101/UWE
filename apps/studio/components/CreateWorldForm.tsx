"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface WorldTemplateChoice {
  id: string;
  name: string;
  description: string;
}

interface Props {
  templates?: WorldTemplateChoice[];
}

export function CreateWorldForm({ templates = [] }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "blank");
  const [guestModeEnabled, setGuestModeEnabled] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(studioApiUrl("/api/worlds"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
          templateId,
          guestModeEnabled: isSandbox ? false : guestModeEnabled,
          isSandbox,
        }),
      });

      const data = (await response.json()) as { error?: string; world?: { slug: string } };
      if (!response.ok) {
        setError(data.error ?? "Welt konnte nicht erstellt werden.");
        return;
      }

      if (data.world?.slug) {
        router.push(`/worlds/${data.world.slug}/dashboard`);
        router.refresh();
      }
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="uwe-v2-form studio-create-world-form" onSubmit={handleSubmit}>
      <h2 className="uwe-v2-section-title">Neue Welt erstellen</h2>
      <p className="uwe-hint">
        Nur für Owner/Admin. Wähle eine Vorlage für den Startaufbau — Sandbox-Welten sind von
        Backup, Export und Portal ausgeschlossen.
      </p>

      {templates.length > 0 ? (
        <fieldset className="uwe-template-grid" aria-label="Welt-Vorlage">
          <legend className="sr-only">Welt-Vorlage</legend>
          {templates.map((template) => (
            <label
              key={template.id}
              className={`uwe-template-card${template.id === templateId ? " active" : ""}`}
            >
              <input
                type="radio"
                name="templateId"
                value={template.id}
                checked={templateId === template.id}
                onChange={() => setTemplateId(template.id)}
                className="sr-only"
              />
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <label>
        Name
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="z. B. Terra"
        />
      </label>

      <label>
        Beschreibung (optional)
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Kurzbeschreibung für Spieler"
        />
      </label>

      <label className="uwe-checkbox-row">
        <input
          type="checkbox"
          checked={isSandbox}
          onChange={(event) => setIsSandbox(event.target.checked)}
        />
        Sandbox-Testwelt — nur im Studio sichtbar, kein Backup/Export/Portal
      </label>

      <label className={`uwe-checkbox-row${isSandbox ? " uwe-muted" : ""}`}>
        <input
          type="checkbox"
          checked={guestModeEnabled}
          disabled={isSandbox}
          onChange={(event) => setGuestModeEnabled(event.target.checked)}
        />
        Gastmodus aktiv — für Spieler freigegebene Inhalte ohne Login im Portal lesbar
      </label>

      {error ? (
        <p className="uwe-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={submitting}>
        {submitting ? "Erstelle…" : "Welt erstellen"}
      </button>
    </form>
  );
}
