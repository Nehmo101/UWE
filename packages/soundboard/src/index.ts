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
  clearSpotifyCoverCache,
  fetchSpotifyCoverUrl,
  fetchSpotifyCoverViaOEmbed,
  fetchSpotifyCoverViaWebApi,
  getCachedSpotifyCoverUrl,
  isSpotifyUrl,
  mapButtonVolumeToSpotifyPercent,
  mapSpotifyHttpError,
  normalizeSpotifyUri,
  parseSpotifyUrl,
  pauseSpotifyPlayback,
  pickBestSpotifyImage,
  playSpotifyTrack,
  resumeSpotifyPlayback,
  setSpotifyVolume,
  stopSpotifyPlayback,
  type ParsedSpotifyUrl,
  type SpotifyCoverFetchOptions,
  type SpotifyFetch,
  type SpotifyImage,
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
