/**
 * Lightweight, process-local progress reporting for the desktop host actions
 * (setup / update / start …). The Tauri Command Center spawns
 * `desktop-host-cli.ts` as a one-shot child per action and streams its stdout
 * line-by-line, so a module-level stepper is safe: each CLI process owns a
 * single action and a single, sequential progress counter.
 *
 * The CLI installs a sink that serialises every event as one NDJSON line on
 * stdout; the Rust side forwards `progress` events to the frontend as a Tauri
 * event and treats the final `result` line as the action's return value.
 */

export interface HostProgressEvent {
  type: "progress";
  /** Stable machine key for the current step (e.g. "studio-build"). */
  phase: string;
  /** Human-readable German label shown next to the bar. */
  label: string;
  /** 1-based index of the step that just started. */
  step: number;
  /** Total number of steps for the whole action. */
  total: number;
}

type Sink = (event: HostProgressEvent) => void;

let sink: Sink | null = null;
let currentStep = 0;
let currentTotal = 0;

/** Install (or clear) the sink that receives progress events. */
export function setHostProgressSink(next: Sink | null): void {
  sink = next;
}

/** Start a new progress run with a known total number of steps. */
export function beginHostProgress(total: number): void {
  currentTotal = total;
  currentStep = 0;
}

/**
 * Mark the start of the next step. Increments the shared counter so callers
 * that span several modules (update → setup) share one continuous 1..total
 * sequence without threading a counter through every function.
 */
export function reportHostStep(phase: string, label: string): void {
  currentStep += 1;
  sink?.({ type: "progress", phase, label, step: currentStep, total: currentTotal });
}
