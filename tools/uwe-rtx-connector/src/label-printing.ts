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
export async function discoverLocalPrintersAsync(env: NodeJS.ProcessEnv = process.env): Promise<LocalPrinterInfo[]> {
  const staticPrinters = discoverLocalPrinters(env);
  if (staticPrinters.length > 0) return staticPrinters;
  try {
    const { stdout } = await execFileAsync("lpstat", ["-p"], { timeout: 5_000 });
    const printers: LocalPrinterInfo[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const match = /^printer\s+(\S+)\s/is.exec(line);
      if (match?.[1]) printers.push({ id: match[1], name: match[1] });
    }
    return normalizeLocalPrinters(printers);
  } catch { return []; }
}
export async function runPrinterDiscover() { return { printers: await discoverLocalPrintersAsync() }; }
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
    await execFileAsync("lp", ["-d", parsed.printerId, filePath], { timeout: 60_000 });
    return { printed: true, via: "cups", printerId: parsed.printerId };
  } catch (error) {
    if (!ctx.printCommand && /ENOENT|not found/i.test(String(error))) throw new Error("CUPS lp unavailable");
    throw error;
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => undefined); }
}
