/**
 * Shared entrypoint for the three `uwe-mcp-*` binaries.
 */
import { configWarnings, loadConfig, type McpSurface } from "../client/config";
import { serveStdio } from "../protocol/server";
import { logDiagnostic } from "../protocol/transport";
import { createServer } from "../servers";

export async function runServer(surface: McpSurface): Promise<void> {
  const definition = createServer(surface);

  for (const warning of configWarnings(loadConfig(surface))) {
    logDiagnostic(definition.name, `Hinweis: ${warning}`);
  }

  try {
    await serveStdio(definition);
  } catch (error) {
    logDiagnostic(definition.name, `Abbruch: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
