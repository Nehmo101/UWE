"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input, Textarea } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export function CreateWorldForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [guestModeEnabled, setGuestModeEnabled] = useState(false);
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
          guestModeEnabled,
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
          Nur für Owner/Admin. Gastzugang bleibt read-only — neue Welten sind zunächst nur für
          angemeldete Spieler sichtbar.
        </p>
      </div>

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
          checked={guestModeEnabled}
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
