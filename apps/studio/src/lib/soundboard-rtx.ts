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

/** Direct-first Soundboard delivery with pre-acceptance-only queue fallback. */
export type SoundboardRtxAction = "play" | "stop" | "stop_all" | "volume";

const ACTION_JOB_TYPES: Record<SoundboardRtxAction, ConnectorJobType> = {
  play: "sound_play",
  stop: "sound_stop",
  stop_all: "sound_stop_all",
  volume: "sound_volume",
};

export interface SoundboardRtxInput {
  action: SoundboardRtxAction;
  buttonId?: string;
  sourceUrl?: string;
  title?: string;
  volume?: number;
}

export interface SoundboardRtxDeps {
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

function defaultDeps(): SoundboardRtxDeps {
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

export async function dispatchSoundboardRtx(
  worldSlug: string,
  input: SoundboardRtxInput,
  deps: SoundboardRtxDeps = defaultDeps(),
): Promise<NextResponse> {
  const world = await deps.resolveWorld(worldSlug);
  if (!world) return jsonError("Welt nicht gefunden.", 404);

  const type = ACTION_JOB_TYPES[input.action];
  const payload = {
    buttonId: input.buttonId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    title: input.title ?? null,
    volume: input.volume ?? null,
  };

  if (deps.registry.hasCapability("audio_local")) {
    try {
      const direct = await deps.registry.dispatch({ type, worldId: world.id, payload });
      return NextResponse.json({ queued: false, delivery: "direct", requestId: direct.requestId });
    } catch (error) {
      if (!(error instanceof DirectConnectorDispatchError)) throw error;
      if (error.accepted) {
        return NextResponse.json({
          queued: false,
          delivery: "direct",
          requestId: error.requestId ?? null,
          degraded: true,
          uncertain: true,
          message:
            "Der Maschinenraum hat die Sound-Aktion angenommen, aber das Ergebnis konnte nicht bestätigt werden. Sie wird nicht erneut ausgeführt.",
        });
      }
    }
  }

  const summary = await deps.service.summarize();
  if (!hasQueueCapability(summary, "audio_local")) {
    return NextResponse.json({
      queued: false,
      delivery: "unavailable",
      degraded: true,
      message: capabilityOfflineMessage("audio_local"),
    });
  }

  const job = await deps.service.enqueueJob({ type, worldId: world.id, payload });
  return NextResponse.json({ queued: true, delivery: "queue", jobId: job.id });
}
