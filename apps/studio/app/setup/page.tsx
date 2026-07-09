"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StudioAuthShell } from "@/src/components/StudioAuthShell";
import { Alert, LoadingState } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export default function SetupPage() {
  const router = useRouter();
  const [setupAvailable, setSetupAvailable] = useState<boolean | null>(null);
  const [setupConfigured, setSetupConfigured] = useState(true);
  const [setupToken, setSetupToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch(studioApiUrl("/api/auth/setup"))
      .then((response) => response.json())
      .then((payload: { setupAvailable?: boolean; setupConfigured?: boolean }) => {
        setSetupAvailable(Boolean(payload.setupAvailable));
        setSetupConfigured(payload.setupConfigured !== false);
      })
      .catch(() => setSetupAvailable(false));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(studioApiUrl("/api/auth/setup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupToken, displayName, email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Setup fehlgeschlagen.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (setupAvailable === null) {
    return <LoadingState title="Setup wird geprüft…" />;
  }

  if (!setupAvailable) {
    return (
      <StudioAuthShell
        title="Setup abgeschlossen"
        description="Ein Owner-Konto existiert bereits. Das einmalige Setup ist deaktiviert."
        footer={
          <>
            <Link href="/login" className="text-primary hover:underline">
              Zur Anmeldung
            </Link>
            {" · "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Passwort vergessen?
            </Link>
          </>
        }
      />
    );
  }

  return (
    <StudioAuthShell
      title="UWE Studio — Erstes Setup"
      description={
        "Lege den ersten Owner an. Dieser Schritt ist nur einmal möglich und erfordert das " +
        "Setup-Token aus UWE_SETUP_TOKEN in deiner .env."
      }
      wide
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Bereits ein Konto? Anmelden
        </Link>
      }
    >
      {!setupConfigured ? (
        <Alert tone="danger">
          <code>UWE_SETUP_TOKEN</code> ist nicht gesetzt. Generiere ein Token (z. B.{" "}
          <code>openssl rand -hex 32</code>), trage es in <code>.env</code> ein und starte den
          Server neu.
        </Alert>
      ) : null}

      <p className="uwe-notice" style={{ marginBottom: "1rem" }}>
        Für laufende Host- und Owner-Konfiguration nach der Erstinstallation:{" "}
        <Link href="/admin/setup">Einrichtung (Admin)</Link>
        {" · "}
        <Link href="/settings">Einstellungen</Link>
      </p>

      <div className="rounded-[var(--radius)] border border-border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Produktions-Checkliste</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            <code>UWE_SETUP_TOKEN</code> und <code>AUTH_SECRET</code> in <code>.env</code> setzen
          </li>
          <li>Owner-Konto hier anlegen (wird danach automatisch deaktiviert)</li>
          <li>
            <code>RUN_DB_SEED=false</code> in Produktion — keine Demo-Benutzer
          </li>
          <li>
            Portal: <code>AUTH_REQUIRED=true</code> für öffentliche Deployments
          </li>
        </ol>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="setupToken">Setup-Token</Label>
          <Input
            id="setupToken"
            name="setupToken"
            type="password"
            autoComplete="off"
            value={setupToken}
            onChange={(event) => setSetupToken(event.target.value)}
            required
            disabled={!setupConfigured}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Anzeigename</Label>
          <Input
            id="displayName"
            name="displayName"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            disabled={!setupConfigured}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={!setupConfigured}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Passwort (min. 8 Zeichen)</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            disabled={!setupConfigured}
          />
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Button type="submit" disabled={loading || !setupConfigured}>
          {loading ? "Owner anlegen…" : "Owner anlegen"}
        </Button>
      </form>
    </StudioAuthShell>
  );
}
