/**
 * Review-only validators for structured AI/RTX output.
 *
 * Every model answer that is meant to become data — not prose — goes through
 * one of these: a whitelist parse that rejects executable payloads, clamps
 * numeric ranges, checks registry references, and returns a freshly built
 * object, never the raw one. The prompt context is derived from the same
 * constants the validator enforces, so prompt and validator cannot drift.
 *
 * Only one validator is left. `gouache-registry`, `plot-fill-proposal` and
 * `rtx-asset-proposal` (with `rtx-asset-schema` and `rtx-asset-prompt-context`,
 * ~1.660 Zeilen) came from the retired `@uwe/atlas` package and validated Atlas
 * gouache assets and AtlasObject scatter recipes. Both data models went with
 * Atlas 3D; the two Brain actions that fed them went on 28.07.2026, and the
 * validators with them — a validator without a caller is exactly the dead
 * weight `packages/atlas` became.
 */

export * from "./terra-world-draft";
