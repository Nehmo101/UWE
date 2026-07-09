"use client";

import { useState } from "react";

interface TestResult {
  ok: boolean;
  provider?: string;
  model?: string;
  text?: string;
  message?: string;
  error?: string;
  latencyMs?: number;
}

/** RTX inference smoke test from the connector page (#617). */
export function RtxInferenceTestPanel({ useMock = false }: { useMock?: boolean }) {
  const [prompt, setPrompt] = useState("Antworte nur mit: RTX OK");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function runTest() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/inference/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mock: useMock }),
      });
      const data = (await response.json()) as { test?: TestResult; error?: string };
      if (!response.ok) {
        setResult({
          ok: false,
          error: data.error ?? data.test?.error ?? "Test fehlgeschlagen.",
        });
        return;
      }
      setResult({
        ok: data.test?.ok ?? false,
        provider: data.test?.provider,
        model: data.test?.model,
        text: data.test?.text,
        error: data.test?.message ?? data.test?.error,
        latencyMs: data.test?.latencyMs,
      });
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Test fehlgeschlagen.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section" aria-label="RTX Inference Test">
      <h2 className="uwe-v2-section-title">Inference-Test</h2>
      <p className="uwe-dashboard-muted">
        Kurzer RTX-Smoke-Test über den AI-Gateway — ohne Secrets in der Antwort.
      </p>
      <label className="uwe-v2-field" style={{ display: "block", marginTop: "0.75rem" }}>
        <span className="uwe-v2-label">Test-Prompt</span>
        <input
          className="uwe-v2-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={500}
        />
      </label>
      <p style={{ marginTop: "0.75rem" }}>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-primary"
          disabled={loading || prompt.trim().length === 0}
          onClick={() => void runTest()}
        >
          {loading ? "Teste…" : "Inference testen"}
        </button>
      </p>
      {result ? (
        <div
          className={result.ok ? "uwe-v2-card" : "uwe-form-error"}
          role="status"
          style={{ marginTop: "0.75rem", padding: "0.75rem" }}
        >
          {result.ok ? (
            <>
              <p>
                <strong>OK</strong>
                {result.provider ? ` · ${result.provider}` : ""}
                {result.model ? ` / ${result.model}` : ""}
                {result.latencyMs != null ? ` · ${result.latencyMs} ms` : ""}
              </p>
              {result.text ? <p className="uwe-dashboard-muted">{result.text}</p> : null}
            </>
          ) : (
            <p>{result.error ?? "Test fehlgeschlagen."}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
