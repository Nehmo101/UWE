export type SoundSourceType = "local" | "youtube" | "spotify";

export interface SoundboardButtonRef {
  id: string;
  title: string;
  sourceType: SoundSourceType;
  sourceUrl?: string | null;
  assetId?: string | null;
  thumbnail?: string | null;
  volume: number;
  loop: boolean;
}

export type ActiveSoundStatus = "playing" | "paused" | "stopped";

export interface ActiveSound {
  instanceId: string;
  buttonId: string;
  title: string;
  sourceType: SoundSourceType;
  sourceUrl?: string | null;
  assetId?: string | null;
  volume: number;
  loop: boolean;
  status: ActiveSoundStatus;
}
