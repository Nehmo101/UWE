/**
 * Tracks locally spawned audio player processes so sound_stop / sound_stop_all
 * can terminate playback instead of returning a no-op acknowledgement.
 */

import { spawn, type ChildProcess } from "node:child_process";

export interface AudioPlayResult extends Record<string, unknown> {
  dispatched: true;
  via: string;
  source: string;
  pid: number | null;
  jobId?: string;
}

export interface AudioStopResult extends Record<string, unknown> {
  stopped: boolean;
  stoppedCount: number;
  jobId?: string;
}

export interface AudioVolumeResult extends Record<string, unknown> {
  acknowledged: true;
  volume: number;
  note: string;
}

const activeByJobId = new Map<string, ChildProcess>();
let activeVolume = 1;

function splitCommand(command: string): [string, ...string[]] {
  const parts = command.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Executor-Kommando ist leer.");
  }
  return parts as [string, ...string[]];
}

function trackProcess(jobId: string | undefined, child: ChildProcess): void {
  if (!jobId || child.pid == null) {
    return;
  }
  activeByJobId.set(jobId, child);
  child.once("exit", () => {
    if (activeByJobId.get(jobId) === child) {
      activeByJobId.delete(jobId);
    }
  });
}

function killProcess(child: ChildProcess): boolean {
  if (child.killed || child.exitCode != null) {
    return false;
  }
  try {
    child.kill("SIGTERM");
    return true;
  } catch {
    return false;
  }
}

export function playTrackedSound(
  audioCommand: string,
  source: string,
  jobId?: string,
): AudioPlayResult {
  const [cmd, ...baseArgs] = splitCommand(audioCommand);
  const child = spawn(cmd, [...baseArgs, source], { stdio: "ignore", detached: true });
  child.unref();
  trackProcess(jobId, child);
  return {
    dispatched: true,
    via: cmd,
    source,
    pid: child.pid ?? null,
    jobId,
  };
}

export function stopTrackedSound(jobId?: string): AudioStopResult {
  if (!jobId) {
    return { stopped: false, stoppedCount: 0 };
  }
  const child = activeByJobId.get(jobId);
  if (!child) {
    return { stopped: false, stoppedCount: 0, jobId };
  }
  const stopped = killProcess(child);
  activeByJobId.delete(jobId);
  return { stopped, stoppedCount: stopped ? 1 : 0, jobId };
}

export function stopAllTrackedSounds(): AudioStopResult {
  let stoppedCount = 0;
  for (const [jobId, child] of activeByJobId.entries()) {
    if (killProcess(child)) {
      stoppedCount += 1;
    }
    activeByJobId.delete(jobId);
  }
  return { stopped: stoppedCount > 0, stoppedCount };
}

/** Volume is stored for future play commands; most CLI players lack runtime control. */
export function setTrackedSoundVolume(volume: number): AudioVolumeResult {
  const clamped = Math.max(0, Math.min(1, volume));
  activeVolume = clamped;
  return {
    acknowledged: true,
    volume: activeVolume,
    note: "Lautstärke für künftige sound_play-Jobs gespeichert — kein Live-Update beim laufenden Player.",
  };
}

/** Test helper — clears tracked processes without killing (after tests spawn short-lived cmds). */
export function resetTrackedAudioForTests(): void {
  activeByJobId.clear();
  activeVolume = 1;
}
