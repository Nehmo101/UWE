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
  mapButtonVolumeToSpotifyPercent,
  mapSpotifyHttpError,
  normalizeSpotifyUri,
  parseSpotifyUrl,
  pauseSpotifyPlayback,
  playSpotifyTrack,
  resumeSpotifyPlayback,
  setSpotifyVolume,
  stopSpotifyPlayback,
  type ParsedSpotifyUrl,
  type SpotifyFetch,
  type SpotifyPlaybackConfig,
  type SpotifyPlaybackResult,
  type SpotifyResourceType,
  type SpotifyTokenConfig,
  type SpotifyVolumeConfig,
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
