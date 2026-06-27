/**
 * Ollama administration — model download (`pull`) and listing.
 *
 * Pulling streams NDJSON progress events from Ollama's `/api/pull` endpoint and
 * forwards them to a caller-supplied progress callback so the desktop client can
 * show a download bar. Listing mirrors discovery's `/api/tags` probe.
 *
 * Everything is local to the connector machine; no model bytes pass through the
 * UWE Host.
 */

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  /** Convenience 0–1 fraction when total/completed are present. */
  fraction?: number;
}

export interface OllamaModelListEntry {
  name: string;
  sizeBytes?: number;
  contextLength?: number;
  family?: string;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export class OllamaAdmin {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /**
   * List models known to the local Ollama server (the same source discovery
   * uses). Returns an empty list when Ollama is not reachable.
   */
  async listModels(timeoutMs = 5_000): Promise<OllamaModelListEntry[]> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${trimSlash(this.baseUrl)}/api/tags`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return [];
    }
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json().catch(() => null)) as {
      models?: Array<{
        name?: string;
        size?: number;
        details?: { family?: string };
      }>;
    } | null;

    const out: OllamaModelListEntry[] = [];
    for (const entry of payload?.models ?? []) {
      const name = entry.name?.trim();
      if (!name) continue;
      const item: OllamaModelListEntry = { name };
      if (typeof entry.size === "number") item.sizeBytes = entry.size;
      if (entry.details?.family) item.family = entry.details.family;
      out.push(item);
    }
    return out;
  }

  /**
   * Pull a model, streaming progress. Resolves when the pull completes and
   * rejects on transport/HTTP errors or an error event in the stream.
   */
  async pullModel(
    name: string,
    onProgress?: (progress: OllamaPullProgress) => void,
    options: { timeoutMs?: number } = {},
  ): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("pullModel: Modellname fehlt.");
    }

    const response = await this.fetchImpl(`${trimSlash(this.baseUrl)}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName, stream: true }),
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Ollama pull HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    if (!response.body) {
      throw new Error("Ollama pull lieferte keinen Stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = this.consumeLines(buffer, onProgress);
      }
    } finally {
      reader.releaseLock();
    }

    // Flush any trailing line.
    const trailing = buffer.trim();
    if (trailing) {
      this.handleLine(trailing, onProgress);
    }
  }

  /** Process complete NDJSON lines from the buffer; returns the remainder. */
  private consumeLines(
    buffer: string,
    onProgress?: (progress: OllamaPullProgress) => void,
  ): string {
    let working = buffer;
    let newlineIndex = working.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = working.slice(0, newlineIndex).trim();
      working = working.slice(newlineIndex + 1);
      if (line) {
        this.handleLine(line, onProgress);
      }
      newlineIndex = working.indexOf("\n");
    }
    return working;
  }

  private handleLine(
    line: string,
    onProgress?: (progress: OllamaPullProgress) => void,
  ): void {
    let parsed: {
      status?: string;
      error?: string;
      digest?: string;
      total?: number;
      completed?: number;
    };
    try {
      parsed = JSON.parse(line);
    } catch {
      return; // Ignore non-JSON noise.
    }

    if (parsed.error) {
      throw new Error(`Ollama pull: ${parsed.error}`);
    }

    if (!onProgress) {
      return;
    }

    const total = typeof parsed.total === "number" ? parsed.total : undefined;
    const completed = typeof parsed.completed === "number" ? parsed.completed : undefined;
    onProgress({
      status: parsed.status ?? "",
      digest: parsed.digest,
      total,
      completed,
      fraction:
        total && total > 0 && completed != null
          ? Math.max(0, Math.min(1, completed / total))
          : undefined,
    });
  }
}
