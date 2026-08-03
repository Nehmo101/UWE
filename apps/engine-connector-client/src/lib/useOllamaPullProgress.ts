import { useEffect, useState } from "react";

import { listen } from "@tauri-apps/api/event";

export type OllamaPullProgressState = {
  status: string;
  fraction?: number;
  done: boolean;
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Live progress for the currently running Ollama pull, fed by the
 * `ollama-pull-progress` events the Rust side emits while streaming the
 * connector CLI's stdout (see `run_client_cli_streaming` in `lib.rs`).
 * Without this, the UI only learns about the pull once it's fully done.
 */
export function useOllamaPullProgress() {
  const [progress, setProgress] = useState<OllamaPullProgressState | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listen<unknown>("ollama-pull-progress", (event) => {
      const payload = asRecord(event.payload);
      if (payload.type === "done") {
        setProgress({ status: "Fertig", fraction: 1, done: true });
        return;
      }
      if (payload.type === "progress") {
        setProgress({
          status: typeof payload.status === "string" ? payload.status : "",
          fraction: typeof payload.fraction === "number" ? payload.fraction : undefined,
          done: false,
        });
      }
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
