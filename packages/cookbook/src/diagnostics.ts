/**
 * Serve/runtime diagnosis patterns.
 *
 * Struktur und Meldungstexte sind UWE-eigen. Die Idee einer Muster→Diagnose-Tabelle
 * und zwei der Fehlermuster orientieren sich an Odysseus' `cookbook-diagnosis.js`
 * (AGPL-3.0-or-later); die Muster selbst matchen fremde Werkzeug-Ausgaben
 * (llama.cpp/vLLM) und beschreiben Tatsachen, keine schutzfähige Ausdrucksform.
 * Siehe THIRD-PARTY-NOTICES.md.
 */

import type { ServeDiagnosis } from "./types";

const DIAGNOSIS_PATTERNS: Array<{
  pattern: RegExp;
  summary: string;
  suggestions: string[];
}> = [
  {
    pattern: /No available memory for the cache blocks|Available KV cache memory:.*-/i,
    summary: "Kein GPU-Speicher mehr für KV-Cache nach dem Modell-Laden.",
    suggestions: [
      "Kontext auf 2048–4096 reduzieren",
      "Kleinere Quantisierung (z. B. Q4_K_M statt Q8_0)",
      "GPU-Memory-Utilization senken (vLLM: --gpu-memory-utilization 0.80)",
    ],
  },
  {
    pattern: /CUDA out of memory|OutOfMemoryError|out of memory/i,
    summary: "GPU-Speicher erschöpft während Start oder Warmup.",
    suggestions: [
      "Kleineres Modell oder aggressivere Quantisierung wählen",
      "Kontextlänge reduzieren",
      "Nur eine GPU / tensor-parallel-size=1",
    ],
  },
  {
    pattern: /Address already in use|bind.*in use/i,
    summary: "Port bereits belegt.",
    suggestions: [
      "Anderen Port wählen (z. B. 11435 für Ollama)",
      "Laufenden Prozess beenden: lsof -i :11434",
    ],
  },
  {
    pattern: /connection refused|ECONNREFUSED|fetch failed/i,
    summary: "Lokaler Inference-Endpunkt nicht erreichbar.",
    suggestions: [
      "Ollama/RTX-Worker starten",
      "AI_INFERENCE_BASE_URL und RTX_BASE_URL prüfen",
      "Firewall/Heimnetz-Routing prüfen",
    ],
  },
  {
    pattern: /No CUDA GPUs are available|no GPU.*found/i,
    summary: "Keine GPU für den Serve-Prozess sichtbar.",
    suggestions: [
      "nvidia-smi auf dem Inference-Host ausführen",
      "Docker: --gpus all setzen",
      "CPU-only Backend (llama.cpp CPU) als Fallback",
    ],
  },
  {
    pattern: /ollama.*not found|command not found.*ollama/i,
    summary: "Ollama ist nicht installiert oder nicht im PATH.",
    suggestions: [
      "Ollama installieren: https://ollama.com/download",
      "Oder Docker: ollama/ollama Container nutzen",
    ],
  },
  {
    pattern: /401|403|unauthorized|invalid.*token/i,
    summary: "Authentifizierung am lokalen Agent fehlgeschlagen.",
    suggestions: [
      "RTX_SERVICE_TOKEN in UWE .env mit RTX-Worker-Konfiguration abgleichen",
      "Token nicht in Logs oder UI anzeigen",
    ],
  },
  {
    pattern: /public.*url|öffentlich|exposure/i,
    summary: "RTX/Inference-URL ist öffentlich erreichbar — Datenschutzrisiko.",
    suggestions: [
      "Nur loopback oder private IP (192.168.x.x) verwenden",
      "Cloudflare Tunnel mit Access Policy für Studio, nicht für RTX",
    ],
  },
];

export function diagnoseServeOutput(text: string): ServeDiagnosis[] {
  if (!text.trim()) return [];
  const tail = text.slice(-6000);
  const results: ServeDiagnosis[] = [];

  for (const entry of DIAGNOSIS_PATTERNS) {
    if (entry.pattern.test(tail)) {
      results.push({
        pattern: entry.pattern.source,
        summary: entry.summary,
        suggestions: entry.suggestions,
      });
    }
  }

  return results;
}

export function diagnoseRuntimeMessages(messages: string[]): ServeDiagnosis[] {
  const combined = messages.join("\n");
  return diagnoseServeOutput(combined);
}
