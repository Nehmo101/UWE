/**
 * Connector runner — the outbound work loop.
 *
 *   • Heartbeat on an interval (capabilities, models, status).
 *   • Poll the host for claimable jobs, scheduling by lane so latency-sensitive
 *     audio/spotify work overtakes a long-running GPU job (gpu lane concurrency
 *     is 1, so while a GPU job runs only the other lanes stay available).
 *   • Execute claimed jobs, report complete/fail.
 *   • Reconnect on transient host errors; exit on a rejected token.
 *   • Graceful shutdown: stop claiming, drain active jobs, final heartbeat.
 */

import {
  CONNECTOR_LANES,
  LANE_CONCURRENCY,
  type ConnectorLane,
  type ConnectorRuntimeConfig,
} from "@uwe/connector";

import { executeJob, type ExecutorContext, type JobResult } from "./executors";
import { HostClient, HostClientError, type ClaimedJob, type HostConfig } from "./host-client";
import type { JobHistory } from "./job-history";
import type { DetectedCapabilities } from "./local-capabilities";
import { log } from "./logging";

export interface RunnerOptions {
  client: HostClient;
  config: ConnectorRuntimeConfig;
  version: string;
  discover: () => Promise<DetectedCapabilities>;
  executorBase: Omit<ExecutorContext, "refreshModels">;
  execute?: (job: ClaimedJob, ctx: ExecutorContext) => Promise<JobResult>;
  /** Optional bounded, privacy-safe record of finished jobs. */
  history?: JobHistory;
}

export class ConnectorRunner {
  private readonly client: HostClient;
  private readonly config: ConnectorRuntimeConfig;
  private snapshot: DetectedCapabilities = { capabilities: [], models: [], printers: [] };
  private readonly laneCounts: Record<ConnectorLane, number> = {
    audio: 0,
    spotify: 0,
    gpu: 0,
    printing: 0,
    maintenance: 0,
  };
  private readonly active = new Set<Promise<void>>();
  private hostQueueEnabled = true;
  private lastError: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private accepting = true;
  private stopped = false;
  private ticking = false;

  constructor(private readonly options: RunnerOptions) {
    this.client = options.client;
    this.config = options.config;
  }

  /** Re-run local discovery and refresh the advertised capability snapshot. */
  async refresh(): Promise<number> {
    this.snapshot = await this.options.discover();
    return this.snapshot.models.length;
  }

  availableLanes(): ConnectorLane[] {
    if (!this.accepting || !this.config.queueEnabled || !this.hostQueueEnabled) {
      return [];
    }
    return CONNECTOR_LANES.filter((lane) => this.laneCounts[lane] < LANE_CONCURRENCY[lane]);
  }

  get activeJobCount(): number {
    return this.active.size;
  }

  async sendHeartbeat(): Promise<void> {
    try {
      const response = await this.client.heartbeat({
        capabilities: this.snapshot.capabilities,
        models: this.snapshot.models,
        printers: this.snapshot.printers,
        version: this.options.version,
        queueEnabled: this.config.queueEnabled,
        currentJobs: this.active.size,
        lastError: this.lastError,
      });
      this.applyHostConfig(response.config);
      this.lastError = null;
    } catch (error) {
      this.handleHostError(error, "Heartbeat");
    }
  }

  /** Refresh the snapshot (best-effort), then heartbeat. Skips if a tick is
   * already in flight so a slow discovery can't stack overlapping runs. */
  private async tick(): Promise<void> {
    if (this.ticking) {
      return;
    }
    this.ticking = true;
    try {
      try {
        await this.refresh();
      } catch (error) {
        // A discovery hiccup (e.g. Ollama briefly unreachable) must not stop
        // heartbeats — keep reporting the last known snapshot.
        const message = error instanceof Error ? error.message : String(error);
        log.warn("Fähigkeits-Refresh fehlgeschlagen — nutze letzten Stand.", { error: message });
      }
      await this.sendHeartbeat();
    } finally {
      this.ticking = false;
    }
  }

  private applyHostConfig(config: HostConfig): void {
    this.hostQueueEnabled = config.queueEnabled;
  }

  /** One poll iteration: claim at most one job per available lane batch. */
  async pollOnce(): Promise<ClaimedJob | null> {
    const lanes = this.availableLanes();
    if (lanes.length === 0) {
      return null;
    }

    let job: ClaimedJob | null;
    try {
      job = await this.client.claimJob(lanes);
    } catch (error) {
      this.handleHostError(error, "Claim");
      return null;
    }

    if (!job) {
      return null;
    }

    this.dispatch(job);
    return job;
  }

  private dispatch(job: ClaimedJob): void {
    const lane = job.lane;
    this.laneCounts[lane] += 1;
    log.event("jobs", "info", `Job beansprucht: ${job.type}`, { jobId: job.id, lane });

    const ctx: ExecutorContext = {
      ...this.options.executorBase,
      refreshModels: () => this.refresh(),
    };
    const exec = this.options.execute ?? executeJob;
    const startedAt = Date.now();

    const promise = (async () => {
      try {
        const result = await exec(job, ctx);
        await this.client.completeJob(job.id, result);
        log.event("jobs", "info", `Job abgeschlossen: ${job.type}`, { jobId: job.id });
        this.recordHistory(job, "completed", Date.now() - startedAt);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        try {
          await this.client.failJob(job.id, reason);
        } catch (failError) {
          this.handleHostError(failError, "Fail-Meldung");
        }
        log.event("jobs", "warn", `Job fehlgeschlagen: ${job.type}`, { jobId: job.id, reason });
        this.recordHistory(job, "failed", Date.now() - startedAt, reason);
      } finally {
        this.laneCounts[lane] = Math.max(0, this.laneCounts[lane] - 1);
      }
    })();

    this.active.add(promise);
    void promise.finally(() => this.active.delete(promise));
  }

  private recordHistory(
    job: ClaimedJob,
    status: "completed" | "failed",
    durationMs: number,
    reason?: string,
  ): void {
    // Only non-sensitive descriptors — never the payload or result.
    this.options.history?.record({
      id: job.id,
      type: job.type,
      lane: job.lane,
      status,
      durationMs,
      reason,
    });
  }

  private handleHostError(error: unknown, context: string): void {
    if (error instanceof HostClientError && (error.status === 401 || error.status === 403)) {
      log.error(`${context}: Token abgelehnt — Connector wird beendet. Token am Host prüfen.`);
      void this.stop();
      process.exitCode = 1;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    this.lastError = `${context}: ${message}`.slice(0, 500);
    log.warn(`${context} fehlgeschlagen — versuche es erneut.`, { error: message });
  }

  async start(): Promise<void> {
    log.info(`RTX Host Connector startet → ${this.config.hostUrl}`, { name: this.config.name });
    await this.refresh();
    log.info("Lokale Fähigkeiten erkannt.", {
      capabilities: this.snapshot.capabilities,
      models: this.snapshot.models.length,
    });
    await this.sendHeartbeat();

    // Re-run discovery before each heartbeat so changes made after startup —
    // e.g. a model freshly enabled for UWE, a new pull, or Ollama coming online —
    // reach the host without a manual connector restart. Without this the very
    // first snapshot would be advertised forever.
    this.heartbeatTimer = setInterval(() => {
      void this.tick();
    }, this.config.heartbeatIntervalMs);

    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, this.config.pollIntervalMs);

    this.installSignalHandlers();
  }

  private installSignalHandlers(): void {
    const shutdown = (signal: string) => {
      log.info(`Signal ${signal} empfangen — fahre sauber herunter.`);
      void this.stop();
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  }

  async stop(drainTimeoutMs = 15_000): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.accepting = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);

    // Drain active jobs (best effort).
    if (this.active.size > 0) {
      log.info(`Warte auf ${this.active.size} laufende Jobs …`);
      await Promise.race([
        Promise.allSettled([...this.active]),
        new Promise((resolve) => setTimeout(resolve, drainTimeoutMs)),
      ]);
    }

    try {
      await this.client.heartbeat({
        capabilities: this.snapshot.capabilities,
        models: this.snapshot.models,
        printers: this.snapshot.printers,
        version: this.options.version,
        queueEnabled: false,
        currentJobs: this.active.size,
        lastError: "Connector wurde beendet.",
      });
    } catch {
      // Host may be unreachable during shutdown — that is fine.
    }
    log.info("RTX Host Connector beendet.");
  }
}
