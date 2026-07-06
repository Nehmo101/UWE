import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { z } from "zod";
import {
  createLabelPrintQueueService,
} from "@uwe/database/server";
import { LabelPrintDocumentAccessError } from "@uwe/database/label-print-queue";
import { idSchema, parseParams } from "@uwe/security";
import { authenticateConnector } from "@/src/lib/connector-auth";

const paramSchema = z.object({ jobId: idSchema });

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await authenticateConnector(request);
  if (!auth.ok) return auth.response;

  const parsedParams = await parseParams(context.params, paramSchema);
  if (!parsedParams.success) return parsedParams.response;

  const queue = createLabelPrintQueueService();
  try {
    await queue.assertConnectorPrintDocumentAccess(parsedParams.data.jobId, auth.connector.id);
  } catch (error) {
    if (error instanceof LabelPrintDocumentAccessError) {
      return jsonError(error.message, error.code === "not_found" ? 404 : 403);
    }
    throw error;
  }

  try {
    const doc = await queue.renderDocument(parsedParams.data.jobId, new URL(request.url).origin);
    const body = typeof doc.body === "string" ? doc.body : new Uint8Array(doc.body);
    return new NextResponse(body, {
      headers: { "Content-Type": doc.contentType, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "error", 500);
  }
}
