import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadClientRuntimeConfig, type ClientRuntimeConfig } from "./client-config-store";
import { printFileCups, printFileWindows } from "./label-printing";
import {
  buildAuthorizationUrl,
  clearSpotifySession,
  exchangeCodeAndStore,
  listDevices,
  setDevice,
  testPlayback,
  type SpotifyLocalConfig,
} from "./spotify-local-store";

function splitCommand(command: string): [string, ...string[]] {
  const parts = command.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Kommando ist leer.");
  }
  return parts as [string, ...string[]];
}

function clientConfig(dataDir: string): ClientRuntimeConfig {
  return loadClientRuntimeConfig(dataDir);
}

function spotifyConfig(dataDir: string): SpotifyLocalConfig {
  const config = clientConfig(dataDir);
  return {
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret,
    redirectUri: config.spotifyRedirectUri,
  };
}

export function cmdSpotifyAuthUrl(dataDir: string): void {
  const state = randomBytes(16).toString("hex");
  const url = buildAuthorizationUrl(spotifyConfig(dataDir), state);
  process.stdout.write(`${JSON.stringify({ url, state })}\n`);
}

export async function cmdSpotifyExchangeCode(dataDir: string, code?: string): Promise<void> {
  const trimmed = code?.trim();
  if (!trimmed) {
    console.error("spotify-exchange-code: Authorization-Code fehlt.");
    process.exit(1);
  }
  const result = await exchangeCodeAndStore(dataDir, spotifyConfig(dataDir), trimmed);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

export async function cmdSpotifyDevices(dataDir: string): Promise<void> {
  const result = await listDevices(dataDir, spotifyConfig(dataDir));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

export function cmdSpotifySetDevice(dataDir: string, deviceId?: string): void {
  const trimmed = deviceId?.trim() ?? "";
  const result = setDevice(dataDir, trimmed || null);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

export async function cmdSpotifyTest(dataDir: string, action?: string): Promise<void> {
  const mode = action?.trim() === "play" ? "play" : "pause";
  const result = await testPlayback(dataDir, spotifyConfig(dataDir), mode);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

export function cmdSpotifyDisconnect(dataDir: string): void {
  clearSpotifySession(dataDir);
  process.stdout.write(`${JSON.stringify({ ok: true, message: "Spotify getrennt." })}\n`);
}

export function cmdTestAudio(dataDir: string, source?: string): void {
  const audioCommand = clientConfig(dataDir).audioCommand;
  if (!audioCommand) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        message: "Kein Audio-Kommando konfiguriert (Audio-Panel im RTX-Client).",
      })}\n`,
    );
    return;
  }

  const [cmd, ...baseArgs] = splitCommand(audioCommand);
  const args = source?.trim() ? [...baseArgs, source.trim()] : baseArgs;

  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.unref();
    process.stdout.write(
      `${JSON.stringify({ ok: true, via: cmd, message: "Audio-Kommando gestartet." })}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        via: cmd,
        message: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
  }
}

export async function cmdTestPrint(dataDir: string, printerId?: string): Promise<void> {
  const printCommand = clientConfig(dataDir).printCommand;

  if (printCommand) {
    const [cmd, ...baseArgs] = splitCommand(printCommand);

    try {
      const child = spawn(cmd, [...baseArgs, "--help"], { stdio: "ignore", detached: false });
      child.on("error", (error) => {
        process.stdout.write(
          `${JSON.stringify({ ok: false, via: cmd, message: error.message })}\n`,
        );
      });
      child.on("close", () => {
        process.stdout.write(
          `${JSON.stringify({ ok: true, via: cmd, message: "Print-Kommando gefunden und ausführbar." })}\n`,
        );
      });
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          via: cmd,
          message: error instanceof Error ? error.message : String(error),
        })}\n`,
      );
    }
    return;
  }

  const trimmed = printerId?.trim();
  if (!trimmed) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        message: "Kein Drucker ausgewählt (Drucker-Panel im RTX-Client).",
      })}\n`,
    );
    return;
  }

  // Without a custom print command the OS print path is used directly:
  // ShellExecute "print to" on Windows, CUPS `lp` elsewhere. Windows gets an
  // HTML page (rendered by the associated app); CUPS gets plain text so its
  // text filter prints it as-is instead of raw markup.
  const isWindows = process.platform === "win32";
  const via = isWindows ? "windows" : "cups";
  const dir = await mkdtemp(join(tmpdir(), "uwe-print-test-"));
  const filePath = join(dir, isWindows ? "uwe-testdruck.html" : "uwe-testdruck.txt");
  const contents = isWindows
    ? "<html><body><h1>UWE RTX Connector — Testdruck</h1></body></html>"
    : "UWE RTX Connector — Testdruck\n";
  try {
    await writeFile(filePath, contents, "utf8");
    if (isWindows) {
      await printFileWindows(filePath, trimmed);
    } else {
      await printFileCups(filePath, trimmed);
    }
    process.stdout.write(
      `${JSON.stringify({ ok: true, via, message: `Testdruck an "${trimmed}" gesendet.` })}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        via,
        message: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function cmdTestImage(dataDir: string, prompt?: string): Promise<void> {
  const imageCommand = clientConfig(dataDir).imageCommand;
  if (!imageCommand) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        message: "Kein Image-Kommando konfiguriert (Bild-Panel im RTX-Client).",
      })}\n`,
    );
    return;
  }

  const payload = { prompt: prompt?.trim() || "UWE connector test image", test: true };
  const [cmd, ...args] = splitCommand(imageCommand);

  const result = await new Promise<Record<string, unknown>>((resolve) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      resolve({ ok: false, via: cmd, message: "Image-Kommando hat das Timeout erreicht." });
    }, 120_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, via: cmd, message: error.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          ok: false,
          via: cmd,
          message: `Image-Kommando Exit ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
        });
        return;
      }
      resolve({ ok: true, via: cmd, message: "Image-Kommando erfolgreich.", output: stdout.trim() });
    });
    child.stdin.end(JSON.stringify(payload));
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

/** Returns true when the command was handled by this module. */
export async function runIntegrationCliCommand(
  dataDir: string,
  command: string,
  args: string[],
): Promise<boolean> {
  switch (command) {
    case "spotify-auth-url":
      cmdSpotifyAuthUrl(dataDir);
      return true;
    case "spotify-exchange-code":
      await cmdSpotifyExchangeCode(dataDir, args[0]);
      return true;
    case "spotify-devices":
      await cmdSpotifyDevices(dataDir);
      return true;
    case "spotify-set-device":
      cmdSpotifySetDevice(dataDir, args[0]);
      return true;
    case "spotify-test":
      await cmdSpotifyTest(dataDir, args[0]);
      return true;
    case "spotify-disconnect":
      cmdSpotifyDisconnect(dataDir);
      return true;
    case "test-audio":
      cmdTestAudio(dataDir, args[0]);
      return true;
    case "test-image":
      await cmdTestImage(dataDir, args[0]);
      return true;
    case "test-print":
      await cmdTestPrint(dataDir, args[0]);
      return true;
    default:
      return false;
  }
}
