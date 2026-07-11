"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";
import { Alert, Button, Input, Label } from "@/src/components/ui";

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
      <p className="text-sm text-muted-foreground">
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
    <form onSubmit={runTest} className="mt-4 flex flex-col gap-4">
      {action === "mail" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="owner-setup-test-email">Empfänger</Label>
          <Input
            id="owner-setup-test-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="owner@example.org"
          />
        </div>
      )}
      <Button type="submit" variant="secondary" disabled={loading}>
        {loading ? "Teste…" : ACTION_LABELS[action]}
      </Button>
      {status && <Alert>{status}</Alert>}
    </form>
  );
}
