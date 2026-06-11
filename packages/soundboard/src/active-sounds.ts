import type { ActiveSound, ActiveSoundStatus, SoundboardButtonRef } from "./types";

export interface ActiveSoundsState {
  sounds: ActiveSound[];
}

let instanceCounter = 0;

function nextInstanceId(): string {
  instanceCounter += 1;
  return `sound-${instanceCounter}`;
}

export function createActiveSoundsState(): ActiveSoundsState {
  return { sounds: [] };
}

export function playSound(
  state: ActiveSoundsState,
  button: SoundboardButtonRef,
): { state: ActiveSoundsState; sound: ActiveSound } {
  let next = state;

  if (button.sourceType === "spotify") {
    next = stopSoundsBySourceType(next, "spotify");
  }

  const sound: ActiveSound = {
    instanceId: nextInstanceId(),
    buttonId: button.id,
    title: button.title,
    sourceType: button.sourceType,
    sourceUrl: button.sourceUrl ?? null,
    assetId: button.assetId ?? null,
    volume: button.volume,
    loop: button.loop,
    status: "playing",
  };

  return {
    state: {
      sounds: [...next.sounds, sound],
    },
    sound,
  };
}

export function setSoundVolume(
  state: ActiveSoundsState,
  instanceId: string,
  volume: number,
): ActiveSoundsState {
  const clamped = Math.max(0, Math.min(1, volume));
  return {
    sounds: state.sounds.map((sound) =>
      sound.instanceId === instanceId ? { ...sound, volume: clamped } : sound,
    ),
  };
}

export function setSoundStatus(
  state: ActiveSoundsState,
  instanceId: string,
  status: ActiveSoundStatus,
): ActiveSoundsState {
  if (status === "stopped") {
    return {
      sounds: state.sounds.filter((sound) => sound.instanceId !== instanceId),
    };
  }

  return {
    sounds: state.sounds.map((sound) =>
      sound.instanceId === instanceId ? { ...sound, status } : sound,
    ),
  };
}

export function stopSound(state: ActiveSoundsState, instanceId: string): ActiveSoundsState {
  return setSoundStatus(state, instanceId, "stopped");
}

export function pauseSound(state: ActiveSoundsState, instanceId: string): ActiveSoundsState {
  return setSoundStatus(state, instanceId, "paused");
}

export function resumeSound(state: ActiveSoundsState, instanceId: string): ActiveSoundsState {
  return setSoundStatus(state, instanceId, "playing");
}

export function stopAllSounds(): ActiveSoundsState {
  return createActiveSoundsState();
}

export function stopSoundsBySourceType(
  state: ActiveSoundsState,
  sourceType: SoundboardButtonRef["sourceType"],
): ActiveSoundsState {
  return {
    sounds: state.sounds.filter((sound) => sound.sourceType !== sourceType),
  };
}

export function countActiveBySourceType(
  state: ActiveSoundsState,
  sourceType: SoundboardButtonRef["sourceType"],
): number {
  return state.sounds.filter(
    (sound) => sound.sourceType === sourceType && sound.status !== "stopped",
  ).length;
}
