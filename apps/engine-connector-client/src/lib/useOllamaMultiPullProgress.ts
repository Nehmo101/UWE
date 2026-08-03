import { useEffect, useRef, useState } from "react";

import { listen } from "@tauri-apps/api/event";

export type OllamaPullEntryState = {
  status: string;
  fraction?: number;
  done: boolean;
};

export type OllamaMultiPullState = Record<string, OllamaPullEntryState>;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Live progress for several concurrent Ollama pulls, keyed by model name.
 *
 * All pulls share the single `ollama-pull-progress` event channel, so the Rust
 * side tags each event with `pullName` (see `run_client_cli_streaming_tagged` in
 * `lib.rs`). This hook fans those tagged events out into a per-model map so the
 * UI can show one progress row per download running at the same time. Events
 * without a `pullName` (older single-pull callers) are ignored here.
 */
export function useOllamaMultiPullProgress() {
  const [entries, setEntries] = useState<OllamaMultiPullState>({});
  const entriesRef = useRef<OllamaMultiPullState>({});

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listen<unknown>("ollama-pull-progress", (event) => {
      const payload = asRecord(event.payload);
      const name = typeof payload.pullName === "string" ? payload.pullName : "";
      if (!name) {
        return;
      }

      const next: OllamaPullEntryState =
        payload.type === "done"
          ? { status: "Fertig", fraction: 1, done: true }
          : {
              status: typeof payload.status === "string" ? payload.status : "",
              fraction: typeof payload.fraction === "number" ? payload.fraction : undefined,
              done: false,
            };

      entriesRef.current = { ...entriesRef.current, [name]: next };
      setEntries(entriesRef.current);
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

  function reset(names?: string[]) {
    if (!names) {
      entriesRef.current = {};
      setEntries(entriesRef.current);
      return;
    }
    const cleared = { ...entriesRef.current };
    for (const name of names) {
      delete cleared[name];
    }
    entriesRef.current = cleared;
    setEntries(cleared);
  }

  return { entries, reset };
}
