"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [resetToken, setResetToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, resetToken, newPassword }),
    });

    setLoading(false);

    const payload = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(payload.error ?? "Passwort konnte nicht zurückgesetzt werden.");
      return;
    }

    setSuccess(payload.message ?? "Passwort wurde zurückgesetzt.");
    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1500);
  }

  return (
    <section className="auth-card">
      <h1>Neues Passwort setzen</h1>
      <p className="auth-lead">
        Wähle ein neues Passwort (mindestens 8 Zeichen). Alle aktiven Sitzungen werden beendet.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">E-Mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="resetToken">Reset-Token</label>
        <input
          id="resetToken"
          name="resetToken"
          type="text"
          autoComplete="off"
          value={resetToken}
          onChange={(event) => setResetToken(event.target.value)}
          required
        />

        <label htmlFor="newPassword">Neues Passwort</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={8}
          required
        />

        <label htmlFor="confirmPassword">Passwort bestätigen</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />

        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}

        <button type="submit" disabled={loading || Boolean(success)}>
          {loading ? "Speichere…" : "Passwort speichern"}
        </button>
      </form>

      <p className="auth-footer">
        <Link href="/login">← Zurück zur Anmeldung</Link>
        {" · "}
        <Link href="/forgot-password">Neuen Reset-Link anfordern</Link>
      </p>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <Suspense fallback={<section className="auth-card">Lade Formular…</section>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
