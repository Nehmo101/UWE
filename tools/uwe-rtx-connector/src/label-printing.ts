import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { labelPrintDocumentPath, normalizeLocalPrinters, parseLabelPrintJobPayload, type LocalPrinterInfo } from "@uwe/connector";
import { log } from "./logging";
const execFileAsync = promisify(execFile);
export function discoverLocalPrinters(env: NodeJS.ProcessEnv = process.env): LocalPrinterInfo[] {
  const raw = env.UWE_CONNECTOR_PRINTERS?.trim();
  if (!raw) return [];
  try { return normalizeLocalPrinters(JSON.parse(raw)); } catch { log.warn("UWE_CONNECTOR_PRINTERS invalid"); return []; }
}

/** Win32_Printer.PrinterStatus enum → short, host-facing state label. */
function windowsPrinterState(status: unknown): string | undefined {
  switch (typeof status === "number" ? status : Number(status)) {
    case 3: return "idle";
    case 4: return "printing";
    case 5: return "warmup";
    case 6: return "stopped";
    case 7: return "offline";
    default: return undefined;
  }
}

/**
 * Enumerate printers installed in the Windows print spooler via WMI
 * (`Win32_Printer`). Offline-safe: any failure (no PowerShell, not Windows,
 * spooler error) yields an empty list rather than throwing.
 */
async function enumerateWindowsPrinters(): Promise<LocalPrinterInfo[]> {
  try {
    const script =
      "Get-CimInstance -ClassName Win32_Printer | " +
      "Select-Object Name,Default,PrinterStatus,Comment | ConvertTo-Json -Compress";
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: 8_000, windowsHide: true },
    );
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed) as unknown;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const printers: LocalPrinterInfo[] = [];
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const raw = row as Record<string, unknown>;
      const name = typeof raw.Name === "string" ? raw.Name.trim() : "";
      if (!name) continue;
      const printer: LocalPrinterInfo = { id: name, name };
      const comment = typeof raw.Comment === "string" ? raw.Comment.trim() : "";
      if (comment) printer.description = comment;
      if (raw.Default === true) printer.isDefault = true;
      const state = windowsPrinterState(raw.PrinterStatus);
      if (state) printer.state = state;
      printers.push(printer);
    }
    return normalizeLocalPrinters(printers);
  } catch {
    return [];
  }
}

function cupsPrinterState(line: string): string | undefined {
  if (/\bnow printing\b|\bis printing\b/i.test(line)) return "printing";
  if (/\bdisabled\b/i.test(line)) return "disabled";
  if (/\bis idle\b/i.test(line)) return "idle";
  return undefined;
}

/**
 * Enumerate printers configured in CUPS via `lpstat` (Linux / macOS). The
 * default destination (`lpstat -d`) is folded in as `isDefault`. Offline-safe.
 */
async function enumerateCupsPrinters(): Promise<LocalPrinterInfo[]> {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync("lpstat", ["-p"], { timeout: 5_000 }));
  } catch {
    return [];
  }

  let defaultId = "";
  try {
    const { stdout: defaultOut } = await execFileAsync("lpstat", ["-d"], { timeout: 5_000 });
    defaultId = /:\s*(\S+)\s*$/m.exec(defaultOut.trim())?.[1] ?? "";
  } catch {
    // No default destination configured — fine.
  }

  const printers: LocalPrinterInfo[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^printer\s+(\S+)\s/is.exec(line);
    if (!match?.[1]) continue;
    const id = match[1];
    const printer: LocalPrinterInfo = { id, name: id };
    const state = cupsPrinterState(line);
    if (state) printer.state = state;
    if (id === defaultId) printer.isDefault = true;
    printers.push(printer);
  }
  return normalizeLocalPrinters(printers);
}

/**
 * Enumerate printers actually installed on the host OS (Windows spooler on
 * `win32`, otherwise CUPS). Does not consult `UWE_CONNECTOR_PRINTERS`.
 */
export async function enumerateHostPrinters(
  platform: NodeJS.Platform = process.platform,
): Promise<LocalPrinterInfo[]> {
  return platform === "win32" ? enumerateWindowsPrinters() : enumerateCupsPrinters();
}

/**
 * List every printer available on the RTX host for the desktop client's printer
 * picker: statically configured printers (`UWE_CONNECTOR_PRINTERS`) merged with
 * the ones enumerated from the OS. Configured entries win on id collisions.
 */
export async function listInstalledPrinters(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<LocalPrinterInfo[]> {
  const configured = discoverLocalPrinters(env);
  const detected = await enumerateHostPrinters(platform);
  return normalizeLocalPrinters([...configured, ...detected]);
}

export async function discoverLocalPrintersAsync(env: NodeJS.ProcessEnv = process.env): Promise<LocalPrinterInfo[]> {
  const staticPrinters = discoverLocalPrinters(env);
  if (staticPrinters.length > 0) return staticPrinters;
  return enumerateHostPrinters();
}
export async function runPrinterDiscover() { return { printers: await discoverLocalPrintersAsync() }; }

/**
 * Print a file to a named Windows printer with no extra software: uses the
 * OS-registered "print to" ShellExecute verb (`Start-Process -Verb PrintTo`),
 * which hands the file to whatever app Windows already associates with its
 * extension (Edge for PDF, the default browser for HTML). `file` and
 * `printerName` are passed as separate PowerShell parameters bound via
 * `param(...)`, not interpolated into the script string, so neither can break
 * out of the command.
 */
export async function printFileWindows(filePath: string, printerName: string): Promise<void> {
  const script = "param($file,$printer); Start-Process -FilePath $file -Verb PrintTo -ArgumentList $printer -Wait";
  await execFileAsync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", script, filePath, printerName],
    { timeout: 60_000, windowsHide: true },
  );
}
export async function runLabelPrintJob(payload: Record<string, unknown>, ctx: { hostUrl: string; connectorToken: string; printCommand?: string; requestTimeoutMs: number; jobId: string }) {
  const parsed = parseLabelPrintJobPayload(payload);
  if (!parsed) throw new Error("label_print: invalid payload");
  const url = `${ctx.hostUrl.replace(/\/+$/, "")}${labelPrintDocumentPath(ctx.jobId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${ctx.connectorToken}` }, signal: AbortSignal.timeout(ctx.requestTimeoutMs) });
  if (!response.ok) throw new Error(`document HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const dir = await mkdtemp(join(tmpdir(), "uwe-label-print-"));
  const filePath = join(dir, response.headers.get("content-type")?.includes("pdf") ? "doc.pdf" : "doc.html");
  try {
    await writeFile(filePath, bytes);
    if (ctx.printCommand) {
      const parts = ctx.printCommand.split(/\s+/).filter(Boolean) as [string, ...string[]];
      const [cmd, ...args] = parts;
      await execFileAsync(cmd, [...args, "--printer", parsed.printerId, "--file", filePath], { timeout: 120_000 });
      return { printed: true, via: "custom", printerId: parsed.printerId };
    }
    if (process.platform === "win32") {
      await printFileWindows(filePath, parsed.printerId);
      return { printed: true, via: "windows", printerId: parsed.printerId };
    }
    await execFileAsync("lp", ["-d", parsed.printerId, filePath], { timeout: 60_000 });
    return { printed: true, via: "cups", printerId: parsed.printerId };
  } catch (error) {
    if (!ctx.printCommand && /ENOENT|not found/i.test(String(error))) throw new Error("CUPS lp unavailable");
    throw error;
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => undefined); }
}
