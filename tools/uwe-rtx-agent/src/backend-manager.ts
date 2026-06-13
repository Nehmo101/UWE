import { spawn } from "node:child_process";

import type { AgentConfig } from "./config.js";
import { checkOllamaReachable } from "./ollama.js";
import type { BackendState } from "./types.js";

export class BackendManager {
  private state: BackendState = "unknown";
  private startAttempted = false;
  private startProcess: ReturnType<typeof spawn> | null = null;

  constructor(private readonly config: AgentConfig) {}

  getState(): BackendState {
    return this.state;
  }

  async refresh(): Promise<BackendState> {
    if (!this.config.enabled) {
      this.state = "unknown";
      return this.state;
    }

    const reachable = await checkOllamaReachable(
      this.config.ollamaBaseUrl,
      Math.min(this.config.requestTimeoutMs, 5000),
    );

    if (reachable) {
      this.state = "ready";
      return this.state;
    }

    if (this.config.startOllamaCommand && !this.startAttempted) {
      this.startAttempted = true;
      this.state = "starting";
      this.tryStartOllama();
      return this.state;
    }

    this.state = "offline";
    return this.state;
  }

  private tryStartOllama(): void {
    const command = this.config.startOllamaCommand;
    if (!command) {
      return;
    }

    this.startProcess = spawn(command, {
      shell: true,
      detached: true,
      stdio: "ignore",
    });
    this.startProcess.unref();

    void this.pollUntilReady();
  }

  private async pollUntilReady(): Promise<void> {
    const deadline = Date.now() + this.config.requestTimeoutMs;
    while (Date.now() < deadline) {
      await sleep(1000);
      const reachable = await checkOllamaReachable(
        this.config.ollamaBaseUrl,
        Math.min(this.config.requestTimeoutMs, 5000),
      );
      if (reachable) {
        this.state = "ready";
        return;
      }
    }

    this.state = "offline";
  }

  async restartBackend(): Promise<BackendState> {
    this.stop();
    this.startAttempted = false;
    this.state = "unknown";
    return this.refresh();
  }

  stop(): void {
    if (this.startProcess && !this.startProcess.killed) {
      this.startProcess.kill();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
