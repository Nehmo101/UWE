export interface ContextBuilderConfig {
  maxChars: number;
  allowDmOnlyDefault: boolean;
}

const DEFAULT_MAX_CHARS = 24_000;

export function resolveContextBuilderConfig(
  overrides?: Partial<ContextBuilderConfig>,
): ContextBuilderConfig {
  const envMax = process.env.BRAIN_MAX_CONTEXT_CHARS;
  const parsedMax = envMax ? Number.parseInt(envMax, 10) : Number.NaN;

  return {
    maxChars: overrides?.maxChars ?? (Number.isFinite(parsedMax) ? parsedMax : DEFAULT_MAX_CHARS),
    allowDmOnlyDefault:
      overrides?.allowDmOnlyDefault ??
      (process.env.BRAIN_ALLOW_DM_ONLY_CONTEXT !== "false"),
  };
}
