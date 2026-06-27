/**
 * @deprecated Legacy module path. The implementation moved to
 * `./rtx-worker-config` (canonical "RtxWorker" terminology). This shim re-exports
 * everything for backward compatibility — including the deprecated "RtxAgent"
 * aliases — and will be removed once all importers use `rtx-worker-config`.
 */
export * from "./rtx-worker-config";
