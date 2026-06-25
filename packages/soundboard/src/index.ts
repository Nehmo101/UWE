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
  listSpotifyDevices,
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
  transferSpotifyPlayback,
  type ParsedSpotifyUrl,
  type SpotifyCoverFetchOptions,
  type SpotifyDevice,
  type SpotifyDevicesResult,
  type SpotifyFetch,
  type SpotifyImage,
  type SpotifyPlaybackConfig,
  type SpotifyPlaybackResult,
  type SpotifyResourceType,
  type SpotifyTokenConfig,
  type SpotifyTransferConfig,
  type SpotifyVolumeConfig,
} from "./spotify";

export {
  buildSpotifyAuthorizationUrl,
  computeTokenExpiry,
  exchangeSpotifyAuthorizationCode,
  refreshSpotifyAccessToken,
  shouldRefreshSpotifyToken,
  SPOTIFY_AUTHORIZE_URL,
  SPOTIFY_PLAYBACK_SCOPES,
  SPOTIFY_TOKEN_REFRESH_BUFFER_MS,
  SPOTIFY_TOKEN_URL,
  type SpotifyOAuthConfig,
  type SpotifyOAuthResult,
  type SpotifyRefreshResult,
  type SpotifyTokenSet,
} from "./spotify-oauth";

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
