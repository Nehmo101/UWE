/**
 * MCP request dispatch.
 *
 * `handleMessage` is pure with respect to IO — it takes a parsed request and
 * returns the response (or `null` for notifications), so the whole protocol
 * surface is unit-testable without spawning a process.
 */
import { logDiagnostic, readLines, writeMessage } from "./transport";
import {
  JSON_RPC_ERROR,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  type JsonRpcErrorBody,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpServerDefinition,
  type ToolDefinition,
} from "./types";

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function fail(id: JsonRpcId | null, error: JsonRpcErrorBody): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error };
}

function negotiateProtocolVersion(requested: unknown): string {
  if (
    typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
  ) {
    return requested;
  }
  return LATEST_PROTOCOL_VERSION;
}

function describeTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    ...(tool.title ? { title: tool.title } : {}),
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  };
}

function readArguments(params: Record<string, unknown> | undefined): Record<string, unknown> {
  const args = params?.arguments;
  return args && typeof args === "object" && !Array.isArray(args)
    ? (args as Record<string, unknown>)
    : {};
}

function readStringArguments(params: Record<string, unknown> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(readArguments(params))) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

async function callTool(
  definition: McpServerDefinition,
  id: JsonRpcId,
  params: Record<string, unknown> | undefined,
): Promise<JsonRpcResponse> {
  const name = params?.name;
  if (typeof name !== "string") {
    return fail(id, { code: JSON_RPC_ERROR.invalidParams, message: "tools/call requires a tool name." });
  }

  const tool = definition.tools.find((candidate) => candidate.name === name);
  if (!tool) {
    return fail(id, { code: JSON_RPC_ERROR.invalidParams, message: `Unknown tool: ${name}` });
  }

  try {
    return ok(id, await tool.handler(readArguments(params)));
  } catch (error) {
    // A throwing handler is a tool-level failure, not a broken protocol: report
    // it as content so the model can react instead of killing the session.
    const message = error instanceof Error ? error.message : String(error);
    return ok(id, {
      content: [{ type: "text", text: `Fehler in ${name}: ${message}` }],
      isError: true,
    });
  }
}

function getPrompt(
  definition: McpServerDefinition,
  id: JsonRpcId,
  params: Record<string, unknown> | undefined,
): JsonRpcResponse {
  const name = params?.name;
  const prompt = definition.prompts?.find((candidate) => candidate.name === name);
  if (!prompt) {
    return fail(id, {
      code: JSON_RPC_ERROR.invalidParams,
      message: `Unknown prompt: ${typeof name === "string" ? name : "(missing)"}`,
    });
  }

  return ok(id, {
    description: prompt.description,
    messages: prompt.build(readStringArguments(params)),
  });
}

/**
 * Handles one parsed JSON-RPC message. Returns `null` for notifications
 * (messages without an `id`), which must never receive a response.
 */
export async function handleMessage(
  definition: McpServerDefinition,
  request: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  const { id, method, params } = request;

  if (id === undefined || id === null) {
    return null;
  }

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: negotiateProtocolVersion(params?.protocolVersion),
        capabilities: {
          tools: { listChanged: false },
          ...(definition.prompts?.length ? { prompts: { listChanged: false } } : {}),
        },
        serverInfo: { name: definition.name, version: definition.version },
        ...(definition.instructions ? { instructions: definition.instructions } : {}),
      });

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: definition.tools.map(describeTool) });

    case "tools/call":
      return callTool(definition, id, params);

    case "prompts/list":
      return ok(id, {
        prompts: (definition.prompts ?? []).map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments ?? [],
        })),
      });

    case "prompts/get":
      return getPrompt(definition, id, params);

    case "resources/list":
      return ok(id, { resources: [] });

    default:
      return fail(id, {
        code: JSON_RPC_ERROR.methodNotFound,
        message: `Method not supported: ${method}`,
      });
  }
}

/** Parses one NDJSON frame; returns a protocol error response on malformed input. */
export function parseRequest(line: string): JsonRpcRequest | JsonRpcResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return fail(null, { code: JSON_RPC_ERROR.parse, message: "Invalid JSON." });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fail(null, { code: JSON_RPC_ERROR.invalidRequest, message: "Request must be an object." });
  }

  const candidate = parsed as Partial<JsonRpcRequest>;
  if (typeof candidate.method !== "string") {
    return fail(candidate.id ?? null, {
      code: JSON_RPC_ERROR.invalidRequest,
      message: "Request is missing a method.",
    });
  }

  return { jsonrpc: "2.0", id: candidate.id, method: candidate.method, params: candidate.params };
}

function isResponse(value: JsonRpcRequest | JsonRpcResponse): value is JsonRpcResponse {
  return "error" in value || "result" in value;
}

/** Runs the server on stdin/stdout until the client closes the stream. */
export async function serveStdio(definition: McpServerDefinition): Promise<void> {
  logDiagnostic(definition.name, `bereit (${definition.tools.length} Tools)`);

  // Frames are processed sequentially: MCP allows concurrent requests, but
  // serialising keeps ordering obvious and the UWE APIs are the bottleneck anyway.
  let queue: Promise<void> = Promise.resolve();

  await readLines(process.stdin, (line) => {
    queue = queue.then(async () => {
      const parsed = parseRequest(line);
      if (isResponse(parsed)) {
        writeMessage(process.stdout, parsed);
        return;
      }

      const response = await handleMessage(definition, parsed);
      if (response) {
        writeMessage(process.stdout, response);
      }
    });
  });

  await queue;
}
