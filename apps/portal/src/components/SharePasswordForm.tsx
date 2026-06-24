"use client";

import { useState } from "react";

interface SharePasswordFormProps {
  token: string;
}

export function SharePasswordForm({ token }: SharePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/share/${token}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Passwort ungültig");
      return;
    }

    window.location.reload();
  }

  return (
    <form className="uwe-form share-password-form" onSubmit={handleSubmit}>
      <h1>Passwort erforderlich</h1>
      <p>Dieser Freigabelink ist passwortgeschützt.</p>
      <label>
        Passwort
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoFocus
        />
      </label>
      {error && <p className="uwe-flash uwe-flash-error">{error}</p>}
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={loading}>
        {loading ? "Prüfe…" : "Zugang anfordern"}
      </button>
    </form>
  );
}
