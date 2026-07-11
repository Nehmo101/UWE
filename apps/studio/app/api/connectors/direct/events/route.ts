import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DIRECT_PROTOCOL_VERSION,
  parseDirectProtocolFrame,
  type DirectConnectorEvent,
} from "@uwe/connector";
import { DIRECT_MAX_FRAME_BYTES, getDirectConnectorRegistry } from "@uwe/connector/direct";

import { authenticateConnector } from "@/src/lib/connector-auth";
import { resolveHostConnectorConfig } from "@/src/lib/connector-config";

const requestIdSchema = z.string().min(1).max(128);
const eventSchema = z.discriminatedUnion("kind", [
  z
    .object({
      version: z.literal(DIRECT_PROTOCOL_VERSION),
      kind: z.literal("accepted"),
      requestId: requestIdSchema,
      acceptedAt: z.string().min(1).max(64).optional(),
    })
    .strict(),
  z
    .object({
      version: z.literal(DIRECT_PROTOCOL_VERSION),
      kind: z.literal("progress"),
      requestId: requestIdSchema,
      progress: z.number().min(0).max(1),
      message: z.string().min(1).max(1_000).optional(),
    })
    .strict(),
  z
    .object({
      version: z.literal(DIRECT_PROTOCOL_VERSION),
      kind: z.literal("result"),
      requestId: requestIdSchema,
      result: z.unknown(),
    })
    .strict(),
  z
    .object({
      version: z.literal(DIRECT_PROTOCOL_VERSION),
      kind: z.literal("error"),
      requestId: requestIdSchema,
      message: z.string().min(1).max(4_000),
      code: z.string().min(1).max(128).optional(),
      retryable: z.boolean().optional(),
    })
    .strict(),
]);

async function readBoundedJson(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse }
> {
  if (!request.body) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body is required." }, { status: 400 }),
    };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let json = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > DIRECT_MAX_FRAME_BYTES) {
        await reader.cancel("Direct event exceeds the size limit.");
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Direct event exceeds the size limit." },
            { status: 413 },
          ),
        };
      }
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Could not read request body." }, { status: 400 }),
    };
  } finally {
    reader.releaseLock();
  }

  try {
    return { ok: true, value: JSON.parse(json) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }
}

export async function POST(request: Request) {
  const auth = await authenticateConnector(request);
  if (!auth.ok) return auth.response;

  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > DIRECT_MAX_FRAME_BYTES) {
    return NextResponse.json({ error: "Direct event exceeds the size limit." }, { status: 413 });
  }

  if (!resolveHostConnectorConfig().directEnabled) {
    getDirectConnectorRegistry().disconnect(
      auth.connector.id,
      "Direct transport is disabled by the host.",
    );
    return NextResponse.json(
      { error: "Direct Connector transport is disabled by the host." },
      { status: 503 },
    );
  }

  const body = await readBoundedJson(request);
  if (!body.ok) return body.response;
  const parsed = eventSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Direct Connector event." }, { status: 400 });
  }

  const frame = parseDirectProtocolFrame(parsed.data);
  if (frame == null || !["accepted", "progress", "result", "error"].includes(frame.kind)) {
    return NextResponse.json({ error: "Invalid Direct Connector event." }, { status: 400 });
  }

  const handled = getDirectConnectorRegistry().handleEvent(
    auth.connector.id,
    frame as DirectConnectorEvent,
  );
  if (!handled.ok) {
    const status = handled.reason === "wrong_connector" ? 403 : 409;
    return NextResponse.json({ error: handled.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}