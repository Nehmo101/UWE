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
// A local named-tunnel config (own tunnel + credentials-file + 127.0.0.1 ingress).
// Preferred over a raw token because it maps hostnames to the correct local ports
// and avoids sharing a tunnel with connectors on other machines.
const configFile = () => path.join(dataRoot(), "cloudflared-config.yml");

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
          // "configured" — either a local named-tunnel config or a stored token.
          hasToken: Boolean(readToken()) || fs.existsSync(configFile()),
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
        const hasConfig = fs.existsSync(configFile());
        const token = readToken();
        if (!hasConfig && !token) {
          throw new Error("Keine Tunnel-Konfiguration und kein Token hinterlegt.");
        }
        const existing = readPid();
        if (processRunning(existing)) {
          result = { ok: true, pid: existing, message: "cloudflared läuft bereits." };
          break;
        }
        fs.mkdirSync(path.dirname(pidFile()), { recursive: true });
        fs.mkdirSync(path.dirname(logFile()), { recursive: true });
        const out = fs.openSync(logFile(), "a");
        // Prefer the local named-tunnel config (own tunnel + 127.0.0.1 ingress);
        // fall back to a raw token only if no config is present.
        const args = hasConfig
          ? ["tunnel", "--no-autoupdate", "--config", configFile(), "run"]
          : ["tunnel", "--no-autoupdate", "run", "--token", token as string];
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
