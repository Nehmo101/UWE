"use client";

import { useState } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";

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
    <Card aria-label="RTX Inference Test">
      <CardHeader>
        <CardTitle>Inference-Test</CardTitle>
        <p className="text-sm text-muted-foreground">
          Kurzer RTX-Smoke-Test über den AI-Gateway — ohne Secrets in der Antwort.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rtx-inference-test-prompt">Test-Prompt</Label>
          <Input
            id="rtx-inference-test-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={500}
          />
        </div>
        <div>
          <Button
            type="button"
            disabled={loading || prompt.trim().length === 0}
            onClick={() => void runTest()}
          >
            {loading ? "Teste…" : "Inference testen"}
          </Button>
        </div>
        {result ? (
          <Alert tone={result.ok ? "success" : "danger"} role="status">
            {result.ok ? (
              <>
                <p className="text-foreground">
                  <strong>OK</strong>
                  {result.provider ? ` · ${result.provider}` : ""}
                  {result.model ? ` / ${result.model}` : ""}
                  {result.latencyMs != null ? ` · ${result.latencyMs} ms` : ""}
                </p>
                {result.text ? <p className="text-muted-foreground">{result.text}</p> : null}
              </>
            ) : (
              <p>{result.error ?? "Test fehlgeschlagen."}</p>
            )}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
