import { NextResponse } from "next/server";

import { jsonError } from "@/src/lib/api-response";
import {
  capabilityOfflineMessage,
  type ConnectorCapability,
  type ConnectorJobType,
} from "@uwe/connector";
import {
  DirectConnectorDispatchError,
  getDirectConnectorRegistry,
  type DirectDispatchInput,
  type DirectDispatchResult,
} from "@uwe/connector/direct";
import {
  createConnectorService,
  getDbWorldBySlug,
  prisma,
  type ConnectorJob,
  type ConnectorSummary,
  type EnqueueConnectorJobInput,
} from "@uwe/database/server";

export type SpotifyConnectorAction = "play" | "resume" | "pause" | "stop" | "volume";

const ACTION_JOB_TYPES: Record<SpotifyConnectorAction, ConnectorJobType> = {
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

export interface SpotifyConnectorDeps {
  service: {
    summarize: () => Promise<ConnectorSummary>;
    enqueueJob: (input: EnqueueConnectorJobInput) => Promise<ConnectorJob>;
  };
  registry: {
    hasCapability: (capability: ConnectorCapability) => boolean;
    dispatch: (input: DirectDispatchInput) => Promise<DirectDispatchResult>;
  };
  resolveWorld: (worldSlug: string) => Promise<{ id: string } | null>;
}

function defaultDeps(): SpotifyConnectorDeps {
  return {
    service: createConnectorService(prisma),
    registry: getDirectConnectorRegistry(),
    resolveWorld: (worldSlug) => getDbWorldBySlug(worldSlug),
  };
}

function hasQueueCapability(summary: ConnectorSummary, capability: ConnectorCapability): boolean {
  return summary.connectors.some(
    (connector) =>
      !connector.disabled &&
      connector.queueEnabled &&
      (connector.status === "online" || connector.status === "degraded") &&
      connector.capabilities.includes(capability),
  );
}

/** True when Spotify is currently reachable through Direct or the queue. */
export async function isSpotifyConnectAvailable(
  deps: SpotifyConnectorDeps = defaultDeps(),
): Promise<boolean> {
  if (deps.registry.hasCapability("spotify_connect")) return true;
  return hasQueueCapability(await deps.service.summarize(), "spotify_connect");
}

/**
 * Prefer Direct delivery and use the queue only before a Direct request was
 * accepted. Returns null only when no connector delivery path is available so
 * callers may use the legacy host-side Spotify fallback.
 */
export async function tryDispatchSpotifyConnector(
  worldSlug: string,
  input: SpotifyConnectorInput,
  deps: SpotifyConnectorDeps = defaultDeps(),
): Promise<NextResponse | null> {
  const type = ACTION_JOB_TYPES[input.action];
  const payload: Record<string, unknown> = {};
  if (input.uri?.trim()) payload.uri = input.uri.trim();
  if (typeof input.volume === "number") payload.volume = input.volume;

  let world: { id: string } | null = null;
  const resolveWorld = async () => {
    world ??= await deps.resolveWorld(worldSlug);
    return world;
  };

  if (deps.registry.hasCapability("spotify_connect")) {
    const directWorld = await resolveWorld();
    if (!directWorld) return jsonError("Welt nicht gefunden.", 404);

    try {
      const direct = await deps.registry.dispatch({
        type,
        worldId: directWorld.id,
        payload,
      });
      return NextResponse.json({
        queued: false,
        delivery: "direct",
        requestId: direct.requestId,
        via: "rtx-connector",
        message: "Spotify-Aktion direkt an den Maschinenraum übergeben.",
      });
    } catch (error) {
      if (!(error instanceof DirectConnectorDispatchError)) throw error;
      if (error.accepted) {
        return NextResponse.json({
          queued: false,
          delivery: "direct",
          requestId: error.requestId ?? null,
          via: "rtx-connector",
          degraded: true,
          uncertain: true,
          message:
            "Der Maschinenraum hat die Spotify-Aktion angenommen, aber das Ergebnis konnte nicht bestätigt werden. Sie wird nicht erneut ausgeführt.",
        });
      }
    }
  }

  const summary = await deps.service.summarize();
  if (!hasQueueCapability(summary, "spotify_connect")) return null;

  const queueWorld = await resolveWorld();
  if (!queueWorld) return jsonError("Welt nicht gefunden.", 404);

  const job = await deps.service.enqueueJob({
    type,
    worldId: queueWorld.id,
    payload,
  });

  return NextResponse.json({
    queued: true,
    delivery: "queue",
    jobId: job.id,
    via: "rtx-connector",
    message: "Spotify-Aktion an die Maschinenraum-Queue übergeben.",
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
