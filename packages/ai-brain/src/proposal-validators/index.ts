/**
 * Review-only validators for structured AI/RTX output.
 *
 * Every model answer that is meant to become data — not prose — goes through
 * one of these: a whitelist parse that rejects executable payloads, clamps
 * numeric ranges, checks registry references, and returns a freshly built
 * object, never the raw one. The prompt context is derived from the same
 * constants the validator enforces, so prompt and validator cannot drift.
 *
 * Moved here from the retired `@uwe/atlas` package; `@uwe/ai-brain` is the
 * only consumer.
 */

export * from "./gouache-registry";
export * from "./plot-fill-proposal";
export * from "./rtx-asset-proposal";
