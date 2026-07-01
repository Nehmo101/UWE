"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input, Textarea } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export interface WorldTemplateChoice {
  id: string;
  name: string;
  description: string;
  seedPageCount?: number;
  includesCampaign?: boolean;
  includesCalendar?: boolean;
}

interface Props {
  templates?: WorldTemplateChoice[];
}

function formatTemplateHint(template: WorldTemplateChoice): string | null {
  if (template.id === "blank") {
    return "Keine Startseiten — du legst alles selbst an.";
  }

  const parts: string[] = [];
  if (template.seedPageCount) {
    parts.push(`${template.seedPageCount} Startseite(n)`);
  }
  if (template.includesCampaign) {
    parts.push("Standard-Kampagne");
  }
  if (template.includesCalendar) {
    parts.push("Weltkalender");
  }
  return parts.length > 0 ? `Enthält: ${parts.join(" · ")}` : null;
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
      const response = await fetch("/api/worlds", {
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
        router.push(`/auth/worlds/${data.world.slug}`);
        router.refresh();
      }
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mb-6 space-y-4 rounded-[var(--radius)] border border-border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-lg font-semibold">Neue Welt erstellen</h2>
        <p className="text-sm text-muted-foreground">
          Nur für Owner/Admin. Wähle eine Vorlage für den Startaufbau. Sandbox-Welten sind von
          Backup, Export und Portal-Listen ausgeschlossen.
        </p>
      </div>

      {templates.length > 0 ? (
        <fieldset className="grid gap-3 sm:grid-cols-2" aria-label="Welt-Vorlage">
          <legend className="sr-only">Welt-Vorlage</legend>
          {templates.map((template) => (
            <label
              key={template.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm${
                template.id === templateId ? " border-primary bg-muted/40" : " border-border"
              }`}
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
              <span className="text-muted-foreground">{template.description}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {(() => {
        const selected = templates.find((entry) => entry.id === templateId);
        const hint = selected ? formatTemplateHint(selected) : null;
        return hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null;
      })()}

      <div className="space-y-2">
        <Label htmlFor="world-name">Name</Label>
        <Input
          id="world-name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="z. B. Terra"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="world-description">Beschreibung (optional)</Label>
        <Textarea
          id="world-description"
          name="description"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Kurzbeschreibung für Spieler"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={isSandbox}
          onChange={(event) => setIsSandbox(event.target.checked)}
        />
        Sandbox-Testwelt — nur im Studio sichtbar, kein Backup/Export/Portal
      </label>

      <label className={`flex items-start gap-2 text-sm${isSandbox ? " opacity-60" : ""}`}>
        <input
          type="checkbox"
          className="mt-1"
          checked={guestModeEnabled}
          disabled={isSandbox}
          onChange={(event) => setGuestModeEnabled(event.target.checked)}
        />
        Gastmodus aktiv — für Spieler freigegebene Inhalte ohne Login im Portal lesbar
      </label>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Erstelle…" : "Welt erstellen"}
      </Button>
    </form>
  );
}
