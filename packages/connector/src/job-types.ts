/**
 * Connector job catalogue — the work the UWE Host can hand to the Maschinenraum
 * via the queue. Each job type maps to an execution lane, a default
 * priority and the capability a connector must advertise to claim it.
 *
 * Priorities (higher runs first):
 *   100  emergency stop / stop all
 *    90  sound controls (play / volume)
 *    80  spotify controls
 *    60  model refresh / status
 *    50  llm generation
 *    45  speech-to-text (a user is waiting on the transcript)
 *    40  vision extraction
 *    30  image generation
 *    20  embeddings / batch
 *
 * Lanes keep latency-sensitive audio/spotify work from being stuck behind long
 * GPU jobs — the host only runs one GPU job at a time, but audio and spotify
 * jobs live in their own lanes and may overtake.
 */

import type { ConnectorCapability } from "./capabilities";

export const CONNECTOR_LANES = ["audio", "spotify", "gpu", "printing", "maintenance"] as const;
export type ConnectorLane = (typeof CONNECTOR_LANES)[number];

/** How many jobs a single connector should run concurrently per lane. */
export const LANE_CONCURRENCY: Record<ConnectorLane, number> = {
  audio: 4,
  spotify: 1,
  gpu: 1,
  printing: 1,
  maintenance: 1,
};

export const CONNECTOR_JOB_TYPES = [
  "sound_play",
  "sound_stop",
  "sound_stop_all",
  "sound_volume",
  "spotify_play",
  "spotify_pause",
  "spotify_volume",
  "spotify_transfer_device",
  "llm_generate",
  "image_generate",
  "embedding_generate",
  "vision_extract",
  "audio_transcribe",
  "connector_refresh_models",
  "label_print",
  "printer_discover",
] as const;

export type ConnectorJobType = (typeof CONNECTOR_JOB_TYPES)[number];

export interface ConnectorJobDescriptor {
  lane: ConnectorLane;
  priority: number;
  capability: ConnectorCapability;
  /** Job has no payload to compute — runs quickly and must not be GPU-blocked. */
  latencySensitive: boolean;
}

export const CONNECTOR_JOB_DESCRIPTORS: Record<ConnectorJobType, ConnectorJobDescriptor> = {
  sound_play: { lane: "audio", priority: 90, capability: "audio_local", latencySensitive: true },
  sound_stop: { lane: "audio", priority: 100, capability: "audio_local", latencySensitive: true },
  sound_stop_all: { lane: "audio", priority: 100, capability: "audio_local", latencySensitive: true },
  sound_volume: { lane: "audio", priority: 90, capability: "audio_local", latencySensitive: true },
  spotify_play: { lane: "spotify", priority: 80, capability: "spotify_connect", latencySensitive: true },
  spotify_pause: { lane: "spotify", priority: 80, capability: "spotify_connect", latencySensitive: true },
  spotify_volume: { lane: "spotify", priority: 80, capability: "spotify_connect", latencySensitive: true },
  spotify_transfer_device: {
    lane: "spotify",
    priority: 80,
    capability: "spotify_connect",
    latencySensitive: true,
  },
  llm_generate: { lane: "gpu", priority: 50, capability: "llm_local", latencySensitive: false },
  image_generate: { lane: "gpu", priority: 30, capability: "image_generation", latencySensitive: false },
  vision_extract: { lane: "gpu", priority: 40, capability: "vision_local", latencySensitive: false },
  // Dictation: a user is waiting on the result, so it outranks vision and image
  // work, but it is still GPU work and shares the single-GPU lane.
  audio_transcribe: { lane: "gpu", priority: 45, capability: "stt_local", latencySensitive: false },
  embedding_generate: {
    lane: "gpu",
    priority: 20,
    capability: "embedding_local",
    latencySensitive: false,
  },
  connector_refresh_models: {
    lane: "maintenance",
    priority: 60,
    capability: "system_info",
    latencySensitive: false,
  },
  label_print: {
    lane: "printing",
    priority: 70,
    capability: "label_printing",
    latencySensitive: false,
  },
  printer_discover: {
    lane: "maintenance",
    priority: 55,
    capability: "label_printing",
    latencySensitive: false,
  },
};

const JOB_TYPE_SET = new Set<string>(CONNECTOR_JOB_TYPES);

export function isConnectorJobType(value: unknown): value is ConnectorJobType {
  return typeof value === "string" && JOB_TYPE_SET.has(value);
}

export function describeConnectorJob(type: ConnectorJobType): ConnectorJobDescriptor {
  return CONNECTOR_JOB_DESCRIPTORS[type];
}

export function laneForJobType(type: ConnectorJobType): ConnectorLane {
  return CONNECTOR_JOB_DESCRIPTORS[type].lane;
}

export function defaultPriorityForJobType(type: ConnectorJobType): number {
  return CONNECTOR_JOB_DESCRIPTORS[type].priority;
}

export function capabilityForJobType(type: ConnectorJobType): ConnectorCapability {
  return CONNECTOR_JOB_DESCRIPTORS[type].capability;
}
