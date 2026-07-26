/**
 * Tool-result helpers: uniform text/JSON envelopes plus context-window guards.
 */
import type { HttpResult } from "../client/http";
import type { ToolResult } from "../protocol/types";

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/**
 * Serializes a payload for the model, truncating oversized responses. A world
 * graph or audit log can be megabytes — silently blowing the context window is
 * worse than an explicit, visible cut.
 */
export function jsonResult(data: unknown, maxChars: number): ToolResult {
  const serialized = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  if (serialized.length <= maxChars) {
    return textResult(serialized);
  }

  return textResult(
    `${serialized.slice(0, maxChars)}\n\n[… gekürzt: ${serialized.length - maxChars} von ${serialized.length} Zeichen. Grenze über UWE_MCP_MAX_RESPONSE_CHARS anpassen oder die Anfrage einschränken.]`,
  );
}

/** Converts an HTTP result into a tool result, preserving failure messages. */
export function httpResult(result: HttpResult, maxChars: number): ToolResult {
  return result.ok ? jsonResult(result.data, maxChars) : errorResult(result.message);
}

/** Reads a required string argument, throwing a message the model can act on. */
export function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Argument "${key}" ist erforderlich.`);
  }
  return value.trim();
}

export function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function optionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return undefined;
}
