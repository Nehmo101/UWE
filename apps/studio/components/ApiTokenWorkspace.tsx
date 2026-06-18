"use client";

import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";

interface ApiTokenView {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ScopeOption {
  value: string;
  label: string;
}

export function ApiTokenWorkspace() {
  const [tokens, setTokens] = useState<ApiTokenView[]>([]);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/api-tokens");
      if (!response.ok) {
        throw new Error(`API-Tokens konnten nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as {
        tokens: ApiTokenView[];
        availableScopes: ScopeOption[];
      };
      setTokens(data.tokens);
      setScopes(data.availableScopes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  async function createToken() {
    setError(null);
    setCreatedToken(null);
    const response = await fetch("/api/admin/api-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes: selectedScopes }),
    });
    const data = (await response.json()) as { plaintextToken?: string; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Token konnte nicht erstellt werden.");
      return;
    }
    setCreatedToken(data.plaintextToken ?? null);
    setName("");
    setSelectedScopes([]);
    await loadTokens();
  }

  async function revokeToken(id: string) {
    const response = await fetch(`/api/admin/api-tokens/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Widerruf fehlgeschlagen.");
      return;
    }
    await loadTokens();
  }

  function toggleScope(scope: string) {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  }

  return (
    <>
      <section className="uwe-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Neuen API-Token erstellen</h2>
        <label>
          Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="z.B. n8n Integration" />
        </label>
        <fieldset>
          <legend>Scopes (eng halten)</legend>
          <div className="uwe-form-grid">
            {scopes.map((scope) => (
              <label key={scope.value} className="uwe-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.value)}
                  onChange={() => toggleScope(scope.value)}
                />
                {scope.label}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" className="uwe-btn uwe-btn-primary" onClick={() => void createToken()}>
          Token erstellen
        </button>
        {createdToken && (
          <p className="uwe-notice uwe-notice-warn" style={{ marginTop: "1rem" }}>
            <strong>Token (nur einmal sichtbar):</strong>{" "}
            <code>{createdToken}</code>
          </p>
        )}
      </section>

      {error && <p className="uwe-notice uwe-notice-error">{error}</p>}

      <section className="uwe-card">
        <h2>Aktive Tokens ({tokens.length})</h2>
        {loading ? (
          <p className="uwe-dashboard-muted">Lade…</p>
        ) : tokens.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine API-Tokens vorhanden.</p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>Letzte Nutzung</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td>{token.name}</td>
                  <td>
                    <code>{token.tokenPrefix}…</code>
                  </td>
                  <td>{token.scopes.join(", ")}</td>
                  <td>{token.lastUsedAt ? formatStudioDate(token.lastUsedAt) : "—"}</td>
                  <td>{token.isActive ? "aktiv" : "widerrufen"}</td>
                  <td>
                    {token.isActive && (
                      <button type="button" className="uwe-btn uwe-btn-ghost" onClick={() => void revokeToken(token.id)}>
                        Widerrufen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
