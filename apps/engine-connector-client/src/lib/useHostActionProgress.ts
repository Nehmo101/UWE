import { useEffect, useState } from "react";

import { listen } from "@tauri-apps/api/event";

export type HostActionProgressState = {
  /** Machine key for the current step (e.g. "studio-build"). */
  phase: string;
  /** Human-readable German label shown next to the bar. */
  label: string;
  /** 1-based index of the step in progress. */
  step: number;
  /** Total number of steps for the whole action. */
  total: number;
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Live, determinate progress for the currently running host action (setup /
 * update), fed by the `host-action-progress` events the Rust side emits while
 * streaming `desktop-host-cli.ts` stdout (see `run_host_command_streaming` in
 * `command_center.rs`). Quick actions emit no events — the caller falls back to
 * an indeterminate bar from its own `busy` flag.
 *
 * `reset()` must be called by the caller when it starts an action so a stale bar
 * from a previous run does not flash before the first event of the new one.
 */
export function useHostActionProgress() {
  const [progress, setProgress] = useState<HostActionProgressState | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listen<unknown>("host-action-progress", (event) => {
      const payload = asRecord(event.payload);
      if (payload.type !== "progress") return;
      const step = typeof payload.step === "number" ? payload.step : 0;
      const total = typeof payload.total === "number" ? payload.total : 0;
      setProgress({
        phase: typeof payload.phase === "string" ? payload.phase : "",
        label: typeof payload.label === "string" ? payload.label : "",
        step,
        total,
      });
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  function reset() {
    setProgress(null);
  }

  return { progress, reset };
}
