import type { ZodSchema, ZodTypeDef } from "zod";
import { validationError } from "./errors";

export type ParseSuccess<T> = { success: true; data: T };
export type ParseFailure = { success: false; response: Response };
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export async function parseBody<TOutput, TDef extends ZodTypeDef = ZodTypeDef, TInput = TOutput>(
  request: Request,
  schema: ZodSchema<TOutput, TDef, TInput>,
): Promise<ParseResult<TOutput>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return { success: false, response: validationErrorFromMessage("Ungültiger JSON-Body.") };
  }

  return parseValue(raw, schema);
}

export async function parseParams<TOutput, TDef extends ZodTypeDef = ZodTypeDef, TInput = TOutput>(
  params: Promise<Record<string, string | string[] | undefined>>,
  schema: ZodSchema<TOutput, TDef, TInput>,
): Promise<ParseResult<TOutput>> {
  const raw = await params;
  return parseValue(raw, schema);
}

export function parseQuery<TOutput, TDef extends ZodTypeDef = ZodTypeDef, TInput = TOutput>(
  url: string | URL,
  schema: ZodSchema<TOutput, TDef, TInput>,
): ParseResult<TOutput> {
  const searchParams = new URL(url).searchParams;
  const raw = Object.fromEntries(searchParams.entries());
  return parseValue(raw, schema);
}

export function parseFormData<TOutput, TDef extends ZodTypeDef = ZodTypeDef, TInput = TOutput>(
  formData: FormData,
  schema: ZodSchema<TOutput, TDef, TInput>,
): ParseResult<TOutput> {
  const raw = formDataToObject(formData);
  return parseValue(raw, schema);
}

/** Server actions: throws on invalid input with a safe message. */
export function parseFormDataOrThrow<TOutput, TDef extends ZodTypeDef = ZodTypeDef, TInput = TOutput>(
  formData: FormData,
  schema: ZodSchema<TOutput, TDef, TInput>,
): TOutput {
  const result = parseFormData(formData, schema);
  if (!result.success) {
    throw new Error("Ungültige Eingabe.");
  }
  return result.data;
}

function parseValue<TOutput, TDef extends ZodTypeDef, TInput>(
  raw: unknown,
  schema: ZodSchema<TOutput, TDef, TInput>,
): ParseResult<TOutput> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, response: validationError(parsed.error) };
  }
  return { success: true, data: parsed.data };
}

function validationErrorFromMessage(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      result[key] = value;
      continue;
    }

    const stringValue = String(value);
    const existing = result[key];
    if (existing === undefined) {
      result[key] = stringValue;
    } else if (Array.isArray(existing)) {
      existing.push(stringValue);
    } else {
      result[key] = [existing, stringValue];
    }
  }

  return result;
}
