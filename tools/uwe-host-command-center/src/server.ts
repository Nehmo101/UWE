import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectExtendedSnapshot } from "./extended-snapshot";
import { executeControlAction, getControlMeta, resolveControlToken } from "./control";
import { getHostUpdateProgress } from "./host-update-progress";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface HostCommandCenterServerOptions {
  host?: string;
  port?: number;
  baseDir?: string;
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/**
 * Reject requests whose Host header is not a loopback name. This is the primary
 * defense against DNS-rebinding: the server binds to 127.0.0.1, so the only way a
 * remote page reaches it is by rebinding its own hostname (e.g. evil.com) to
 * 127.0.0.1 — in which case the browser still sends `Host: evil.com`, which we
 * refuse here. Direct localhost access (browser on the host, curl) carries a
 * loopback Host and passes.
 */
export function isAllowedHostHeader(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const trimmed = hostHeader.trim().toLowerCase();
  // Strip an optional trailing port (":3099"), keeping bracketed IPv6 intact.
  // The hostname allowlist is the DNS-rebinding defense; the port is not pinned
  // because the server may be bound to an ephemeral port (e.g. in tests).
  const withoutPort = trimmed.replace(/:\d+$/, "");
  return LOCAL_HOSTNAMES.has(withoutPort);
}

/**
 * For state-changing requests, additionally require that any Origin/Sec-Fetch-Site
 * signals indicate a same-origin (loopback) caller. Cross-site fetches carry a
 * remote Origin and are refused even before the token is checked.
 */
export function isAllowedControlOrigin(req: http.IncomingMessage): boolean {
  const site = req.headers["sec-fetch-site"];
  if (typeof site === "string" && site !== "same-origin" && site !== "same-site" && site !== "none") {
    return false;
  }
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    try {
      return LOCAL_HOSTNAMES.has(new URL(origin).hostname.toLowerCase());
    } catch {
      return false;
    }
  }
  return true;
}

function injectControlToken(html: string, token: string): string {
  // Token is base64url (A-Za-z0-9_-) so it is safe inside an HTML attribute value.
  return html.replace(/__UWE_HCC_CONTROL_TOKEN__/g, token);
}

export function createHostCommandCenterServer(
  options: HostCommandCenterServerOptions = {},
): http.Server {
  const host = options.host ?? process.env.HOST_COMMAND_CENTER_BIND ?? "127.0.0.1";
  const port = Number(options.port ?? process.env.HOST_COMMAND_CENTER_PORT ?? 3099);
  const baseDir = options.baseDir ?? process.env.UWE_HOME ?? process.cwd();
  const dashboardHtml = readFileSync(path.join(__dirname, "dashboard.html"), "utf8");

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${host}:${port}`);

    if (!isAllowedHostHeader(req.headers.host)) {
      sendJson(res, 403, { error: "Ungültiger Host-Header" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "uwe-host-command-center" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/snapshot") {
      try {
        const snapshot = await collectExtendedSnapshot(baseDir);
        res.writeHead(snapshot.overall === "error" ? 503 : 200, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify(snapshot));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Snapshot failed";
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/host-update") {
      try {
        const progress = await getHostUpdateProgress();
        sendJson(res, 200, progress);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Host-Update status failed";
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/control/bootstrap") {
      try {
        // The control token is no longer served here — it is injected into the
        // dashboard HTML server-side (see the "/" handler). This endpoint returns
        // only the control metadata (available actions / enabled state).
        const meta = await getControlMeta();
        sendJson(res, 200, meta);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Control bootstrap failed";
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/control/action") {
      try {
        if (!isAllowedControlOrigin(req)) {
          sendJson(res, 403, { ok: false, message: "Ungültige Herkunft" });
          return;
        }
        const body = (await readJsonBody(req)) as { action?: string; token?: string };
        const result = await executeControlAction(body.action ?? "", body.token);
        sendJson(res, result.ok ? 200 : 400, result);
      } catch {
        sendJson(res, 400, { ok: false, message: "Ungültige Anfrage" });
      }
      return;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      try {
        const token = await resolveControlToken();
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(injectControlToken(dashboardHtml, token));
      } catch {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(injectControlToken(dashboardHtml, ""));
      }
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });
}

export function startHostCommandCenterServer(
  options: HostCommandCenterServerOptions = {},
): Promise<{ server: http.Server; host: string; port: number }> {
  const host = options.host ?? process.env.HOST_COMMAND_CENTER_BIND ?? "127.0.0.1";
  const port = Number(options.port ?? process.env.HOST_COMMAND_CENTER_PORT ?? 3099);
  const server = createHostCommandCenterServer({ ...options, host, port });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve({ server, host, port });
    });
  });
}
