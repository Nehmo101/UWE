import { isSpotifyUrl } from "./spotify";
import type { SoundSourceType } from "./types";
import { isYouTubeUrl } from "./youtube";

export type SoundboardValidationField =
  | "title"
  | "sourceUrl"
  | "assetId"
  | "volume"
  | "sourceType"
  | "thumbnail";

export interface SoundboardValidationError {
  field: SoundboardValidationField;
  message: string;
}

export interface SoundboardButtonValidationInput {
  title: string;
  sourceType: SoundSourceType;
  sourceUrl?: string | null;
  assetId?: string | null;
  volume?: number;
  thumbnail?: string | null;
}

const VALID_SOURCE_TYPES = new Set<SoundSourceType>(["local", "youtube", "spotify"]);

export function validateSoundboardButton(
  input: SoundboardButtonValidationInput,
): SoundboardValidationError[] {
  const errors: SoundboardValidationError[] = [];

  if (!input.title.trim()) {
    errors.push({ field: "title", message: "Titel darf nicht leer sein." });
  }

  const volume = input.volume ?? 1;
  if (typeof volume !== "number" || Number.isNaN(volume) || volume < 0 || volume > 1) {
    errors.push({
      field: "volume",
      message: "Lautstärke muss zwischen 0 und 1 liegen.",
    });
  }

  if (!VALID_SOURCE_TYPES.has(input.sourceType)) {
    errors.push({ field: "sourceType", message: "Ungültige Quelle." });
    return errors;
  }

  switch (input.sourceType) {
    case "local":
      if (!input.assetId?.trim()) {
        errors.push({
          field: "assetId",
          message: "Lokaler Sound benötigt eine Datei/ein Asset.",
        });
      }
      break;
    case "youtube":
      if (!input.sourceUrl?.trim() || !isYouTubeUrl(input.sourceUrl)) {
        errors.push({ field: "sourceUrl", message: "Ungültige YouTube URL" });
      }
      break;
    case "spotify":
      if (!input.sourceUrl?.trim() || !isSpotifyUrl(input.sourceUrl)) {
        errors.push({ field: "sourceUrl", message: "Ungültige Spotify URL" });
      }
      break;
  }

  return errors;
}

export function getSoundboardValidationMessage(
  input: SoundboardButtonValidationInput,
): string | null {
  const errors = validateSoundboardButton(input);
  return errors[0]?.message ?? null;
}

export function assertValidSoundboardButton(input: SoundboardButtonValidationInput): void {
  const message = getSoundboardValidationMessage(input);
  if (message) {
    throw new Error(message);
  }
}
