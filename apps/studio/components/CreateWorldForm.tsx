"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Input, Label, Textarea, cn } from "@/src/components/ui";

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
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold tracking-tight">Neue Welt erstellen</h2>
      <p className="text-sm text-muted-foreground">
        Nur für Owner/Admin. Wähle eine Vorlage für den Startaufbau — Sandbox-Welten sind von
        Backup, Export und Portal ausgeschlossen.
      </p>

      {templates.length > 0 ? (
        <fieldset
          className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2"
          aria-label="Welt-Vorlage"
        >
          <legend className="sr-only">Welt-Vorlage</legend>
          {/* TODO(design-kit): kein Auswahlkarten-Kit-Component vorhanden — natives radio +
              Tailwind verwendet, analog Checkbox-Pattern in settings/page.tsx. */}
          {templates.map((template) => (
            <label
              key={template.id}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-[var(--radius)] border border-border bg-card p-3 text-sm text-card-foreground transition-colors hover:border-primary/60",
                template.id === templateId && "border-primary bg-muted",
              )}
            >
              <input
                type="radio"
                name="templateId"
                value={template.id}
                checked={templateId === template.id}
                onChange={() => setTemplateId(template.id)}
                className="sr-only"
              />
              <strong className="text-sm font-semibold">{template.name}</strong>
              <span className="text-xs text-muted-foreground">{template.description}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {(() => {
        const selected = templates.find((entry) => entry.id === templateId);
        const hint = selected ? formatTemplateHint(selected) : null;
        return hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null;
      })()}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create-world-name">Name</Label>
        <Input
          id="create-world-name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="z. B. Terra"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create-world-description">Beschreibung (optional)</Label>
        <Textarea
          id="create-world-description"
          name="description"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Kurzbeschreibung für Spieler"
        />
      </div>

      {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox]
          + Tailwind verwendet, siehe gleiches Muster in settings/page.tsx. */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isSandbox}
          onChange={(event) => setIsSandbox(event.target.checked)}
          className="size-4 rounded border-input"
        />
        Sandbox-Testwelt — nur im Studio sichtbar, kein Backup/Export/Portal
      </label>

      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Erstelle…" : "Welt erstellen"}
      </Button>
    </form>
  );
}
