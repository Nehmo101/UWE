// AUTHORITATIVE product-boundary contracts. Canonical spec: docs/engineering/domain-contracts.md
// Framework-agnostic: no DB clients, IO, providers or app imports.

export const APP_AUDIENCE = {
  portal: "portal",
  studio: "studio",
  brain: "brain",
  platform: "platform",
} as const;

export type AppAudience = (typeof APP_AUDIENCE)[keyof typeof APP_AUDIENCE];

export const DATA_DOMAIN = {
  dndWorld: "dnd_world",
  dndBrain: "dnd_brain",
  portalPlayer: "portal_player",
  personalBrain: "personal_brain",
  adminLife: "admin_life",
  platformAuth: "platform_auth",
  platformOps: "platform_ops",
  assets: "assets",
  jobs: "jobs",
  integrations: "integrations",
  aiControl: "ai_control",
  sharedReference: "shared_reference",
} as const;

export type DataDomain = (typeof DATA_DOMAIN)[keyof typeof DATA_DOMAIN];

export const PRIVACY_CLASS = {
  public: "public",
  playerVisible: "player_visible",
  dmOnly: "dm_only",
  ownerPrivateLocal: "owner_private_local",
} as const;

export type PrivacyClass = (typeof PRIVACY_CLASS)[keyof typeof PRIVACY_CLASS];

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export const isAppAudience = (value: unknown): value is AppAudience =>
  isOneOf(Object.values(APP_AUDIENCE), value);

export const isDataDomain = (value: unknown): value is DataDomain =>
  isOneOf(Object.values(DATA_DOMAIN), value);

export const isPrivacyClass = (value: unknown): value is PrivacyClass =>
  isOneOf(Object.values(PRIVACY_CLASS), value);

export const BRAIN_ONLY_DATA_DOMAINS = [
  DATA_DOMAIN.personalBrain,
  DATA_DOMAIN.adminLife,
] as const satisfies readonly DataDomain[];

export function isBrainOnlyDataDomain(
  value: DataDomain,
): value is (typeof BRAIN_ONLY_DATA_DOMAINS)[number] {
  return isOneOf(BRAIN_ONLY_DATA_DOMAINS, value);
}
