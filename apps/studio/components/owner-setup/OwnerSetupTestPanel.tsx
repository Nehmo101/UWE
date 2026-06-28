"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";

export type OwnerSetupTestAction = "mail" | "urls" | "rtx" | "printer";

interface OwnerSetupTestPanelProps {
  action: OwnerSetupTestAction;
  canEdit: boolean;
  defaultEmail?: string;
}

const ACTION_LABELS: Record<OwnerSetupTestAction, string> = {
  mail: "Testmail senden",
  urls: "URLs testen",
  rtx: "RTX testen",
  printer: "Label-Export testen",
};

export function OwnerSetupTestPanel({
  action,
  canEdit,
  defaultEmail = "",
}: OwnerSetupTestPanelProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!canEdit) {
    return (
      <p className="uwe-hint">
        Nur OWNER darf Tests ausführen und Einstellungen speichern.
      </p>
    );
  }

  async function runTest(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const body =
        action === "mail"
          ? JSON.stringify({ email })
          : JSON.stringify({});
      const response = await fetch(studioApiUrl(`/api/admin/setup/test/${action}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      setStatus(
        data.ok
          ? data.message ?? "Test erfolgreich."
          : data.error ?? data.message ?? "Test fehlgeschlagen.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Anfrage fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={runTest} className="uwe-form" style={{ marginTop: "1rem" }}>
      {action === "mail" && (
        <label>
          Empfänger
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="owner@example.org"
          />
        </label>
      )}
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary" disabled={loading}>
        {loading ? "Teste…" : ACTION_LABELS[action]}
      </button>
      {status && <p className="uwe-notice">{status}</p>}
    </form>
  );
}
