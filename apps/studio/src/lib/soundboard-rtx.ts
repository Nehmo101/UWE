import { NextResponse } from "next/server";

import { capabilityOfflineMessage, type ConnectorJobType } from "@uwe/connector";
import { createConnectorService, getDbWorldBySlug, prisma } from "@uwe/database/server";

/**
 * Soundboard → queue bridge.
 *
 * The browser never talks to the RTX machine directly. A soundboard action is
 * turned into a queued connector job that the RTX Host Connector claims and
 * plays locally. When no connector with local audio is online the call returns
 * a calm degraded response (HTTP 200) — never an error or a crash.
 */

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

export async function dispatchSoundboardRtx(
  worldSlug: string,
  input: SoundboardRtxInput,
): Promise<NextResponse> {
  const world = await getDbWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
  }

  const service = createConnectorService(prisma);
  const summary = await service.summarize();

  if (!service.capabilityAvailable(summary, "audio_local")) {
    // Expected steady state when the RTX PC is off — not an error.
    return NextResponse.json({
      queued: false,
      degraded: true,
      message: capabilityOfflineMessage("audio_local"),
    });
  }

  const job = await service.enqueueJob({
    type: ACTION_JOB_TYPES[input.action],
    worldId: world.id,
    payload: {
      buttonId: input.buttonId ?? null,
      sourceUrl: input.sourceUrl ?? null,
      title: input.title ?? null,
      volume: input.volume ?? null,
    },
  });

  return NextResponse.json({ queued: true, jobId: job.id });
}
