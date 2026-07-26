/**
 * HTTP client for the UWE apps.
 *
 * Requests carry no `Origin` header, so UWE's CSRF guard treats them as
 * non-browser clients and falls through to bearer-token / role checks — the same
 * path `tools/uwe-rtx-connector` uses. Token material never reaches a message
 * body returned to the model.
 */
import type { SurfaceEndpoint } from "./config";

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, QueryValue | QueryValue[]>;
  body?: unknown;
}

export type HttpResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; message: string };

function buildUrl(
  baseUrl: string,
  path: string,
  query: RequestOptions["query"],
): string {
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (entry !== null && entry !== undefined && entry !== "") {
        url.searchParams.append(key, String(entry));
      }
    }
  }

  return url.toString();
}

/** Maps UWE's `{ error }` envelopes and raw bodies onto a short, safe message. */
function describeFailure(status: number, label: string, payload: unknown, raw: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return `${label} antwortete ${status}: ${error}`;
    }
  }

  const snippet = raw.trim().slice(0, 300);
  if (status === 401 || status === 403) {
    return `${label} antwortete ${status}: Zugriff verweigert. Prüfe API-Token und Rolle (Scopes in Studio → Admin → API-Tokens).`;
  }
  if (status === 404) {
    return `${label} antwortete 404: Route oder Ressource nicht gefunden.`;
  }
  return snippet ? `${label} antwortete ${status}: ${snippet}` : `${label} antwortete ${status}.`;
}

export class UweHttpClient {
  constructor(
    private readonly endpoint: SurfaceEndpoint,
    private readonly timeoutMs: number,
  ) {}

  get label(): string {
    return this.endpoint.label;
  }

  get baseUrl(): string {
    return this.endpoint.baseUrl;
  }

  get hasToken(): boolean {
    return Boolean(this.endpoint.token);
  }

  async request(path: string, options: RequestOptions = {}): Promise<HttpResult> {
    const method = options.method ?? "GET";
    const url = buildUrl(this.endpoint.baseUrl, path, options.query);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.endpoint.token) {
      headers.Authorization = `Bearer ${this.endpoint.token}`;
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const hint =
        reason.includes("timed out") || reason.includes("aborted")
          ? `Zeitüberschreitung nach ${this.timeoutMs} ms.`
          : `Läuft ${this.endpoint.label} unter ${this.endpoint.baseUrl}?`;
      return { ok: false, status: 0, message: `${this.endpoint.label} nicht erreichbar — ${hint}` };
    }

    const raw = await response.text();
    let payload: unknown = raw;
    if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: describeFailure(response.status, this.endpoint.label, payload, raw),
      };
    }

    return { ok: true, status: response.status, data: payload };
  }
}
