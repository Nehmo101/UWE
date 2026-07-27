/**
 * Shared plumbing for the three tool catalogs: HTTP clients derived from the
 * config plus a declarative builder for the common "GET an endpoint, hand the
 * JSON back" shape.
 */
import type { McpConfig } from "../client/config";
import { UweHttpClient, type QueryValue } from "../client/http";
import type { ToolDefinition, ToolInputSchema, ToolResult } from "../protocol/types";
import { httpResult } from "./result";

export interface ToolContext {
  config: McpConfig;
  /** The app this server represents — health and app-owned routes. */
  primary: UweHttpClient;
  /** Where this surface's content API lives (Studio for Portal and Brain). */
  dataApi: UweHttpClient;
}

export function createToolContext(config: McpConfig): ToolContext {
  return {
    config,
    primary: new UweHttpClient(config.primary, config.timeoutMs),
    dataApi: new UweHttpClient(config.dataApi, config.timeoutMs),
  };
}

export interface HttpToolSpec {
  name: string;
  title: string;
  description: string;
  /** Which client to use — defaults to the content API. */
  client?: "primary" | "dataApi";
  method?: "GET" | "POST";
  inputSchema: ToolInputSchema;
  path: (args: Record<string, unknown>) => string;
  query?: (args: Record<string, unknown>) => Record<string, QueryValue | QueryValue[]>;
  body?: (args: Record<string, unknown>) => unknown;
  /** Post-processes the payload before it reaches the model (privacy filters). */
  transform?: (data: unknown, context: ToolContext) => unknown;
  annotations?: ToolDefinition["annotations"];
}

/** Builds a tool that maps arguments onto one UWE HTTP request. */
export function httpTool(context: ToolContext, spec: HttpToolSpec): ToolDefinition {
  const method = spec.method ?? "GET";

  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: spec.annotations ?? { readOnlyHint: method === "GET" },
    handler: async (args): Promise<ToolResult> => {
      const client = spec.client === "primary" ? context.primary : context.dataApi;
      const result = await client.request(spec.path(args), {
        method,
        query: spec.query?.(args),
        body: spec.body?.(args),
      });

      if (result.ok && spec.transform) {
        return httpResult(
          { ...result, data: spec.transform(result.data, context) },
          context.config.maxResponseChars,
        );
      }

      return httpResult(result, context.config.maxResponseChars);
    },
  };
}

/** `{ type: "object" }` shorthand — every UWE tool takes a plain argument bag. */
export function objectSchema(
  properties: Record<string, unknown>,
  required: string[] = [],
): ToolInputSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

export const stringArg = (description: string) => ({ type: "string", description });
export const numberArg = (description: string) => ({ type: "integer", description });
export const booleanArg = (description: string) => ({ type: "boolean", description });
export const enumArg = (description: string, values: string[]) => ({
  type: "string",
  description,
  enum: values,
});
