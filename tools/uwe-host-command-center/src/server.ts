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

export function createHostCommandCenterServer(
  options: HostCommandCenterServerOptions = {},
): http.Server {
  const host = options.host ?? process.env.HOST_COMMAND_CENTER_BIND ?? "127.0.0.1";
  const port = Number(options.port ?? process.env.HOST_COMMAND_CENTER_PORT ?? 3099);
  const baseDir = options.baseDir ?? process.env.UWE_HOME ?? process.cwd();
  const dashboardHtml = readFileSync(path.join(__dirname, "dashboard.html"), "utf8");

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${host}:${port}`);

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
        const [meta, token] = await Promise.all([getControlMeta(), resolveControlToken()]);
        sendJson(res, 200, { ...meta, token });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Control bootstrap failed";
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/control/action") {
      try {
        const body = (await readJsonBody(req)) as { action?: string; token?: string };
        const result = await executeControlAction(body.action ?? "", body.token);
        sendJson(res, result.ok ? 200 : 400, result);
      } catch {
        sendJson(res, 400, { ok: false, message: "Ungültige Anfrage" });
      }
      return;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(dashboardHtml);
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
