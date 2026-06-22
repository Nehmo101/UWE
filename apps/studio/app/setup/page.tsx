"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard, AuthPageLayout, authClasses } from "@uwe/shared-ui";

export default function SetupPage() {
  const router = useRouter();
  const classes = authClasses("studio");
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
    return (
      <AuthPageLayout variant="studio">
        <section className={classes.card}>
          <p className="uwe-auth-loading">Setup wird geprüft…</p>
        </section>
      </AuthPageLayout>
    );
  }

  if (!setupAvailable) {
    return (
      <AuthPageLayout variant="studio">
        <AuthCard
          variant="studio"
          title="Setup abgeschlossen"
          lead="Ein Owner-Konto existiert bereits. Das einmalige Setup ist deaktiviert."
          footer={
            <>
              <Link href="/login">Zur Anmeldung</Link>
              {" · "}
              <Link href="/forgot-password">Passwort vergessen?</Link>
            </>
          }
        />
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout variant="studio">
      <AuthCard
        variant="studio"
        title="UWE Studio — Erstes Setup"
        lead={
          "Lege den ersten Owner an. Dieser Schritt ist nur einmal möglich und erfordert das " +
          "Setup-Token aus UWE_SETUP_TOKEN in deiner .env."
        }
        footer={<Link href="/login">Bereits ein Konto? Anmelden</Link>}
      >
        {!setupConfigured && (
          <p className={classes.error} role="alert">
            <code>UWE_SETUP_TOKEN</code> ist nicht gesetzt. Generiere ein Token (z. B.{" "}
            <code>openssl rand -hex 32</code>), trage es in <code>.env</code> ein und starte den
            Server neu.
          </p>
        )}

        <div className="studio-auth-seed-users">
          <h2>Produktions-Checkliste</h2>
          <ol>
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

        <form className={classes.form} onSubmit={handleSubmit}>
          <label htmlFor="setupToken">Setup-Token</label>
          <input
            id="setupToken"
            name="setupToken"
            type="password"
            autoComplete="off"
            value={setupToken}
            onChange={(event) => setSetupToken(event.target.value)}
            required
            disabled={!setupConfigured}
          />

          <label htmlFor="displayName">Anzeigename</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            disabled={!setupConfigured}
          />

          <label htmlFor="email">E-Mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={!setupConfigured}
          />

          <label htmlFor="password">Passwort (min. 8 Zeichen)</label>
          <input
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

          {error && (
            <p className={classes.error} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="uwe-btn uwe-btn-primary"
            disabled={loading || !setupConfigured}
          >
            {loading ? "Owner anlegen…" : "Owner anlegen"}
          </button>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
