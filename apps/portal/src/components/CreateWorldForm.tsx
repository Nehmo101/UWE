"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <form className="uwe-form auth-create-world-form" onSubmit={handleSubmit}>
      <h2>Neue Welt erstellen</h2>
      <p className="auth-lead">
        Nur für Owner/Admin. Gastzugang bleibt read-only — neue Welten sind zunächst nur für
        angemeldete Spieler sichtbar.
      </p>

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
          checked={guestModeEnabled}
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
