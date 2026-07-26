/**
 * Minimal Model Context Protocol type surface.
 *
 * UWE speaks MCP over stdio without an SDK dependency: the wire format is
 * newline-delimited JSON-RPC 2.0 and the method set we need is small. Keeping it
 * dependency-free matters for a self-hosted host that may run offline and for
 * `pnpm audit:prod` — see docs/engineering/mcp-servers.md.
 */

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: JsonRpcErrorBody;
}

/** JSON-RPC 2.0 reserved error codes (see spec §5.1). */
export const JSON_RPC_ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

/**
 * Protocol revisions this server accepts, newest first. On `initialize` we echo
 * back the client's version when we support it, otherwise the newest we know —
 * the client then decides whether to continue.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** A JSON Schema object describing a tool's arguments. */
export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolContent {
  type: "text";
  text: string;
}

export interface ToolResult {
  content: ToolContent[];
  /** True marks a tool-level failure; the client shows it to the model, not as a protocol error. */
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  /** Short human/model-readable title shown in tool pickers. */
  title?: string;
  description: string;
  inputSchema: ToolInputSchema;
  /** Non-standard hints are namespaced under `annotations` per the MCP spec. */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface PromptArgumentDefinition {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: ToolContent;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgumentDefinition[];
  build: (args: Record<string, string>) => PromptMessage[];
}

export interface McpServerDefinition {
  name: string;
  version: string;
  /** Free-text guidance surfaced to the model after `initialize`. */
  instructions?: string;
  tools: ToolDefinition[];
  prompts?: PromptDefinition[];
}
