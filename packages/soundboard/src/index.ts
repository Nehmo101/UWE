export type {
  ActiveSound,
  ActiveSoundStatus,
  SoundboardButtonRef,
  SoundSourceType,
} from "./types";

export {
  countActiveBySourceType,
  createActiveSoundsState,
  pauseSound,
  playSound,
  resumeSound,
  setSoundStatus,
  setSoundVolume,
  stopAllSounds,
  stopSound,
  stopSoundsBySourceType,
  type ActiveSoundsState,
} from "./active-sounds";

export {
  isSpotifyUrl,
  normalizeSpotifyUri,
  parseSpotifyUrl,
  playSpotifyTrack,
  type ParsedSpotifyUrl,
  type SpotifyPlaybackConfig,
  type SpotifyPlaybackResult,
  type SpotifyResourceType,
} from "./spotify";

export {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  isYouTubeUrl,
} from "./youtube";

export {
  assertValidSoundboardButton,
  getSoundboardValidationMessage,
  validateSoundboardButton,
  type SoundboardButtonValidationInput,
  type SoundboardValidationError,
  type SoundboardValidationField,
} from "./validation";
