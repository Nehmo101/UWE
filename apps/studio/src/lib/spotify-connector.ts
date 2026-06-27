import { NextResponse } from "next/server";

import {
  capabilityOfflineMessage,
  type ConnectorCapability,
  type ConnectorJobType,
} from "@uwe/connector";
import {
  createConnectorService,
  getDbWorldBySlug,
  prisma,
  type ConnectorJob,
  type ConnectorSummary,
  type EnqueueConnectorJobInput,
} from "@uwe/database/server";

/**
 * Spotify → connector queue bridge.
 *
 * Spotify OAuth lives only on the RTX Connector Client (never the Studio host).
 * The Studio soundboard still triggers playback, but instead of calling the
 * Spotify Web API with host-held tokens it enqueues a connector job that the RTX
 * Host Connector — which holds the Spotify session and an active Spotify Connect
 * device — claims and executes locally.
 *
 * When no connector advertises `spotify_connect`, callers fall back to the
 * legacy host path (see `spotify-handlers.ts`); the world DB tokens remain in the
 * schema but are unused on this path.
 */

export type SpotifyConnectorAction = "play" | "resume" | "pause" | "stop" | "volume";

const ACTION_JOB_TYPES: Record<SpotifyConnectorAction, ConnectorJobType> = {
  // Resume is a play with no body; stop maps to pause (Spotify has no stop).
  play: "spotify_play",
  resume: "spotify_play",
  pause: "spotify_pause",
  stop: "spotify_pause",
  volume: "spotify_volume",
};

export interface SpotifyConnectorInput {
  action: SpotifyConnectorAction;
  uri?: string;
  volume?: number;
}

/**
 * Minimal connector surface used by the Spotify bridge. Injectable so the
 * dispatch logic can be unit-tested without a database.
 */
export interface SpotifyConnectorDeps {
  service: {
    summarize: () => Promise<ConnectorSummary>;
    capabilityAvailable: (summary: ConnectorSummary, capability: ConnectorCapability) => boolean;
    enqueueJob: (input: EnqueueConnectorJobInput) => Promise<ConnectorJob>;
  };
  resolveWorld: (worldSlug: string) => Promise<{ id: string } | null>;
}

function defaultDeps(): SpotifyConnectorDeps {
  return {
    service: createConnectorService(prisma),
    resolveWorld: (worldSlug) => getDbWorldBySlug(worldSlug),
  };
}

/** True when at least one online connector advertises `spotify_connect`. */
export async function isSpotifyConnectAvailable(
  deps: SpotifyConnectorDeps = defaultDeps(),
): Promise<boolean> {
  const summary = await deps.service.summarize();
  return deps.service.capabilityAvailable(summary, "spotify_connect");
}

/**
 * Enqueue a Spotify connector job when `spotify_connect` is online.
 *
 * Returns `null` when no connector advertises the capability, so the caller can
 * fall back to the legacy host path. When the capability is online it always
 * returns a `NextResponse` (queued, world-not-found, or a calm degraded notice).
 */
export async function tryDispatchSpotifyConnector(
  worldSlug: string,
  input: SpotifyConnectorInput,
  deps: SpotifyConnectorDeps = defaultDeps(),
): Promise<NextResponse | null> {
  const summary = await deps.service.summarize();

  if (!deps.service.capabilityAvailable(summary, "spotify_connect")) {
    // Connector path inactive — let the caller decide on a fallback.
    return null;
  }

  const world = await deps.resolveWorld(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
  }

  const payload: Record<string, unknown> = {};
  if (input.uri?.trim()) {
    payload.uri = input.uri.trim();
  }
  if (typeof input.volume === "number") {
    payload.volume = input.volume;
  }

  const job = await deps.service.enqueueJob({
    type: ACTION_JOB_TYPES[input.action],
    worldId: world.id,
    payload,
  });

  return NextResponse.json({
    queued: true,
    jobId: job.id,
    via: "rtx-connector",
    message: "Spotify-Aktion an den RTX Connector übergeben.",
  });
}

/** Calm degraded response when the connector is offline (HTTP 200, not an error). */
export function spotifyConnectorOfflineResponse(): NextResponse {
  return NextResponse.json({
    queued: false,
    degraded: true,
    message: capabilityOfflineMessage("spotify_connect"),
  });
}
