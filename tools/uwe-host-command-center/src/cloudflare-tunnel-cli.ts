import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Cloudflare tunnel control for the UWE Command Center. Runs the local
 * `cloudflared` connector for the (dashboard-managed) tunnel using the tunnel
 * TOKEN — the only piece not stored in the repo. The token is a secret, so it is
 * kept in the Command Center data dir with owner-only permissions and passed to
 * cloudflared on start; it is never echoed back.
 *
 * Actions:
 *   status                  → { ok, hasToken, running, pid, bin }
 *   set-token  (stdin JSON) → { ok, hasToken:true }   body: { token }
 *   clear-token             → { ok }
 *   start                   → { ok, pid }              (uses the stored token)
 *   stop                    → { ok }
 */

function dataRoot(): string {
  const configured = process.env.UWE_COMMAND_CENTER_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "UWE", "rtx-connector-client", "host");
  }
  return path.join(os.homedir(), ".local", "share", "UWE", "rtx-connector-client", "host");
}

const tokenFile = () => path.join(dataRoot(), "cloudflare-tunnel.token");
const pidFile = () => path.join(dataRoot(), "runtime", "cloudflared.pid");
const logFile = () => path.join(dataRoot(), "logs", "cloudflared.log");
const credentialsFile = () => path.join(dataRoot(), "cloudflared-credentials.json");
const configFile = () => path.join(dataRoot(), "cloudflared-config.yml");

/** Minimal .env reader from the monorepo root (cwd) for ports + public URLs. */
function readRootEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

function hostnameOf(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url.trim()).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Build a LOCAL cloudflared config from the stored connector token: decode the
 * token ({a,t,s}) into a credentials file and write an ingress config that maps
 * each configured public hostname (NEXT_PUBLIC_*_URL) to its local service port
 * (STUDIO_PORT/PORTAL_PORT/BRAIN_PORT). Running from a local config — rather than
 * the dashboard config the raw token would use — keeps ports/hostnames in sync
 * with the Command Center's own .env, so a wrong dashboard ingress can't break it.
 * Returns the config path, or null if the token can't be decoded.
 */
function buildLocalConfig(token: string): string | null {
  let decoded: { a?: string; t?: string; s?: string };
  try {
    decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!decoded.t || !decoded.s || !decoded.a) return null;

  fs.writeFileSync(
    credentialsFile(),
    JSON.stringify({ AccountTag: decoded.a, TunnelID: decoded.t, TunnelSecret: decoded.s }),
    "utf8",
  );
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(credentialsFile(), 0o600);
    } catch {
      // best-effort
    }
  }

  const env = readRootEnv();
  const services: Array<{ host: string | null; port: string }> = [
    { host: hostnameOf(env.NEXT_PUBLIC_STUDIO_URL), port: env.STUDIO_PORT || "3100" },
    { host: hostnameOf(env.NEXT_PUBLIC_PORTAL_URL), port: env.PORTAL_PORT || "3101" },
    { host: hostnameOf(env.NEXT_PUBLIC_BRAIN_URL), port: env.BRAIN_PORT || "3102" },
  ];
  const lines = [`tunnel: ${decoded.t}`, `credentials-file: ${credentialsFile().split(path.sep).join("/")}`, "ingress:"];
  for (const service of services) {
    if (!service.host) continue;
    lines.push(`  - hostname: ${service.host}`);
    lines.push(`    service: http://localhost:${service.port}`);
  }
  lines.push("  - service: http_status:404", "");
  fs.writeFileSync(configFile(), lines.join("\n"), "utf8");
  return configFile();
}

/** Prefer the Windows default install path, else rely on PATH. */
function cloudflaredBin(): string {
  if (process.platform === "win32") {
    const known = "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
    if (fs.existsSync(known)) return known;
  }
  return "cloudflared";
}

function readToken(): string | null {
  try {
    const value = fs.readFileSync(tokenFile(), "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

function readPid(): number | null {
  try {
    const pid = Number.parseInt(fs.readFileSync(pidFile(), "utf8").trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function processRunning(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function stopProcess(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

async function main(): Promise<void> {
  const action = process.argv[2] ?? "status";
  let result: unknown;
  try {
    switch (action) {
      case "status": {
        const pid = readPid();
        const running = processRunning(pid);
        result = {
          ok: true,
          hasToken: Boolean(readToken()),
          running,
          pid: running ? pid : null,
          bin: cloudflaredBin(),
        };
        break;
      }
      case "set-token": {
        const input = JSON.parse(await readStdin()) as { token?: string };
        const token = input.token?.trim();
        if (!token) throw new Error("Tunnel-Token darf nicht leer sein.");
        fs.mkdirSync(dataRoot(), { recursive: true });
        fs.writeFileSync(tokenFile(), token, { encoding: "utf8" });
        if (process.platform !== "win32") {
          try {
            fs.chmodSync(tokenFile(), 0o600);
          } catch {
            // best-effort
          }
        }
        result = { ok: true, hasToken: true };
        break;
      }
      case "clear-token": {
        fs.rmSync(tokenFile(), { force: true });
        result = { ok: true, hasToken: false };
        break;
      }
      case "start": {
        const token = readToken();
        if (!token) throw new Error("Kein Tunnel-Token gespeichert. Bitte zuerst das Token hinterlegen.");
        const existing = readPid();
        if (processRunning(existing)) {
          result = { ok: true, pid: existing, message: "cloudflared läuft bereits." };
          break;
        }
        fs.mkdirSync(path.dirname(pidFile()), { recursive: true });
        fs.mkdirSync(path.dirname(logFile()), { recursive: true });
        const out = fs.openSync(logFile(), "a");
        // Prefer a local ingress config derived from the token + .env (correct,
        // self-managed ports/hostnames); fall back to the raw token (dashboard
        // ingress) only if the token can't be decoded.
        const config = buildLocalConfig(token);
        const args = config
          ? ["tunnel", "--no-autoupdate", "--config", config, "run"]
          : ["tunnel", "--no-autoupdate", "run", "--token", token];
        const child = spawn(cloudflaredBin(), args, {
          detached: true,
          windowsHide: true,
          stdio: ["ignore", out, out],
        });
        fs.closeSync(out);
        if (!child.pid) throw new Error("cloudflared konnte nicht gestartet werden.");
        fs.writeFileSync(pidFile(), String(child.pid), "utf8");
        child.unref();
        result = { ok: true, pid: child.pid };
        break;
      }
      case "stop": {
        const pid = readPid();
        if (pid) stopProcess(pid);
        fs.rmSync(pidFile(), { force: true });
        result = { ok: true };
        break;
      }
      default:
        throw new Error(`Unbekannte Aktion: ${action}`);
    }
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main();
