import type { z } from "zod";
import {
  parseBody,
  parseParams,
  worldSlugParamSchema,
  type StudioGuardOptions,
} from "@uwe/security";
import { guardStudioApiRequest } from "./studio-admin-auth";

interface WorldRouteContext {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Wrapper für die vielen kleinen `worlds/[worldSlug]/…`-Routen, deren Handler
 * nur „Guard → Slug parsen → Fachfunktion" sind. Die zehn Spotify-Routen waren
 * acht nahezu identische Dateien à 17–35 Zeilen — der Unterschied war genau
 * eine Zeile. Der Guard ist derselbe für GET und POST: CSRF greift in
 * `requireStudioApiAuth` ohnehin methodenbasiert (siehe D8-Kommentar in
 * studio-admin-auth.ts).
 */
export function withWorldRoute(
  handler: (worldSlug: string, request: Request) => Promise<Response> | Response,
  options: StudioGuardOptions = {},
): (request: Request, context: WorldRouteContext) => Promise<Response> {
  return async (request, { params }) => {
    const authError = await guardStudioApiRequest(request, options);
    if (authError) return authError;

    const parsedParams = await parseParams(params, worldSlugParamSchema);
    if (!parsedParams.success) return parsedParams.response;

    return handler(parsedParams.data.worldSlug, request);
  };
}

/** Wie {@link withWorldRoute}, plus Zod-validierter JSON-Body. */
export function withWorldBodyRoute<TOutput, TInput = TOutput>(
  schema: z.ZodType<TOutput, TInput>,
  handler: (
    worldSlug: string,
    body: TOutput,
    request: Request,
  ) => Promise<Response> | Response,
  options: StudioGuardOptions = {},
): (request: Request, context: WorldRouteContext) => Promise<Response> {
  return withWorldRoute(async (worldSlug, request) => {
    const parsed = await parseBody(request, schema);
    if (!parsed.success) return parsed.response;
    return handler(worldSlug, parsed.data, request);
  }, options);
}
