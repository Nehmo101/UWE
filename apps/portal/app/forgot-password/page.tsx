"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    setSubmitted(true);

    const payload = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(payload.error ?? "Anfrage fehlgeschlagen.");
      return;
    }

    setMessage(
      payload.message ??
        "Wenn ein Konto mit dieser E-Mail existiert, erhältst du in Kürze Anweisungen zum Zurücksetzen.",
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Passwort vergessen</h1>
        <p className="auth-lead">
          Gib deine E-Mail-Adresse ein. Wenn ein Konto existiert, senden wir dir einen Link zum
          Zurücksetzen.
        </p>

        {submitted && message ? (
          <p className="auth-success">{message}</p>
        ) : (
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

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Sende Anfrage…" : "Reset-Link anfordern"}
            </button>
          </form>
        )}

        <p className="auth-footer">
          <Link href="/login">← Zurück zur Anmeldung</Link>
        </p>
      </section>
    </main>
  );
}
