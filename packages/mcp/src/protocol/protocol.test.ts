import assert from "node:assert/strict";
import test from "node:test";
import { handleMessage, parseRequest } from "./server";
import { LineBuffer, serializeMessage } from "./transport";
import {
  JSON_RPC_ERROR,
  LATEST_PROTOCOL_VERSION,
  type McpServerDefinition,
  type ToolResult,
} from "./types";

function testServer(overrides: Partial<McpServerDefinition> = {}): McpServerDefinition {
  return {
    name: "uwe-test",
    version: "1.0.0",
    instructions: "Testserver",
    tools: [
      {
        name: "echo",
        description: "Gibt das Argument zurück.",
        inputSchema: { type: "object", properties: { value: { type: "string" } } },
        handler: async (args): Promise<ToolResult> => ({
          content: [{ type: "text", text: String(args.value ?? "") }],
        }),
      },
      {
        name: "explode",
        description: "Wirft immer.",
        inputSchema: { type: "object" },
        handler: async (): Promise<ToolResult> => {
          throw new Error("kaputt");
        },
      },
    ],
    prompts: [
      {
        name: "greet",
        description: "Begrüßung",
        arguments: [{ name: "name", description: "Name", required: true }],
        build: (args) => [{ role: "user", content: { type: "text", text: `Hallo ${args.name}` } }],
      },
    ],
    ...overrides,
  };
}

test("LineBuffer reassembles frames split across chunks", () => {
  const buffer = new LineBuffer();
  assert.deepEqual(buffer.push('{"a":'), []);
  assert.deepEqual(buffer.push('1}\n{"b":2}\n'), ['{"a":1}', '{"b":2}']);
  assert.equal(buffer.pending, "");
});

test("LineBuffer tolerates CRLF and skips blank lines", () => {
  const buffer = new LineBuffer();
  assert.deepEqual(buffer.push('{"a":1}\r\n\n{"b":2}\r\n'), ['{"a":1}', '{"b":2}']);
});

test("serialized messages are newline-terminated single lines", () => {
  const frame = serializeMessage({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  assert.equal(frame.endsWith("\n"), true);
  assert.equal(frame.trimEnd().includes("\n"), false);
});

test("initialize echoes a supported protocol version and advertises capabilities", async () => {
  const response = await handleMessage(testServer(), {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05" },
  });

  const result = response?.result as Record<string, unknown>;
  assert.equal(result.protocolVersion, "2024-11-05");
  assert.deepEqual(result.serverInfo, { name: "uwe-test", version: "1.0.0" });
  assert.ok((result.capabilities as Record<string, unknown>).tools);
  assert.ok((result.capabilities as Record<string, unknown>).prompts);
});

test("initialize falls back to the latest version for unknown revisions", async () => {
  const response = await handleMessage(testServer(), {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "1999-01-01" },
  });

  assert.equal((response?.result as { protocolVersion: string }).protocolVersion, LATEST_PROTOCOL_VERSION);
});

test("a server without prompts does not advertise the prompts capability", async () => {
  const response = await handleMessage(testServer({ prompts: [] }), {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {},
  });

  const capabilities = (response?.result as { capabilities: Record<string, unknown> }).capabilities;
  assert.equal("prompts" in capabilities, false);
});

test("notifications never receive a response", async () => {
  const response = await handleMessage(testServer(), {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  assert.equal(response, null);
});

test("tools/list exposes name, description and schema", async () => {
  const response = await handleMessage(testServer(), { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = (response?.result as { tools: Array<Record<string, unknown>> }).tools;

  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["echo", "explode"],
  );
  assert.equal(typeof tools[0]!.description, "string");
  assert.equal((tools[0]!.inputSchema as { type: string }).type, "object");
  // Handlers must never be serialized onto the wire.
  assert.equal("handler" in tools[0]!, false);
});

test("tools/call returns the handler result", async () => {
  const response = await handleMessage(testServer(), {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "echo", arguments: { value: "hallo" } },
  });

  assert.deepEqual(response?.result, { content: [{ type: "text", text: "hallo" }] });
});

test("a throwing handler becomes an isError result, not a protocol error", async () => {
  const response = await handleMessage(testServer(), {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "explode", arguments: {} },
  });

  assert.equal(response?.error, undefined);
  const result = response?.result as ToolResult;
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /kaputt/);
});

test("unknown tools are rejected with invalidParams", async () => {
  const response = await handleMessage(testServer(), {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "nope", arguments: {} },
  });

  assert.equal(response?.error?.code, JSON_RPC_ERROR.invalidParams);
});

test("prompts/get renders messages from arguments", async () => {
  const response = await handleMessage(testServer(), {
    jsonrpc: "2.0",
    id: 6,
    method: "prompts/get",
    params: { name: "greet", arguments: { name: "Welt" } },
  });

  assert.deepEqual((response?.result as { messages: unknown[] }).messages, [
    { role: "user", content: { type: "text", text: "Hallo Welt" } },
  ]);
});

test("unsupported methods answer with methodNotFound", async () => {
  const response = await handleMessage(testServer(), {
    jsonrpc: "2.0",
    id: 7,
    method: "resources/subscribe",
  });

  assert.equal(response?.error?.code, JSON_RPC_ERROR.methodNotFound);
});

test("malformed JSON yields a parse error without an id", () => {
  const parsed = parseRequest("{not json");
  assert.equal("error" in parsed, true);
  assert.equal((parsed as { error: { code: number } }).error.code, JSON_RPC_ERROR.parse);
});

test("requests without a method are invalid", () => {
  const parsed = parseRequest('{"jsonrpc":"2.0","id":9}');
  assert.equal((parsed as { error: { code: number } }).error.code, JSON_RPC_ERROR.invalidRequest);
});
