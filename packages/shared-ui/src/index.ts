export {
  WikiContent,
  WikiSidebar,
} from "./WikiComponents";

export {
  EmptyState,
  SidebarSection,
  StatGrid,
} from "./AppShell";

export { TopBarSessionMount } from "./TopBarSessionMount";

export {
  Tabs,
  ToolWindow,
  Collapsible,
  LoadingState,
  ContextActions,
  CopyToClipboardButton,
  cn,
  type ContextActionsProps,
  type CopyToClipboardButtonProps,
  type TabItem,
  type CollapsibleProps,
  type ToolWindowProps,
} from "./components";

/** @deprecated Legacy shared-ui shell widgets — new product code uses app-local shells. */
export {
  WorldCockpitCard,
  WorldCockpitHeader,
  WorldCockpitTag,
} from "./shells";

export {
  SettingToggleRow,
  SettingsToggleGroup,
} from "./SettingToggleRow";

export {
  CollapsibleSection,
  MobileBottomNav,
  SidebarContextProvider,
  StickyActionBar,
  type BottomNavItem,
} from "./MobileComponents";

export { ViewEditToggle, type ViewEditToggleProps } from "./ViewEditToggle";

export { NavSearch, type NavSearchProps } from "./NavSearch";
export { NavIcon, resolveLucideIcon, type NavIconProps } from "./NavIcon";
export type { NavSearchEntry, NavSearchHit } from "@uwe/shared-utils/nav-search";

export {
  ErrorAlert,
  LoadingPage,
  LoadingSpinner,
} from "./Feedback";

export {
  LogoutButton,
  MaintenanceRecoveryPoller,
  PasswordRequirements,
  PasswordStrengthMeter,
  SessionIdleGuard,
  TurnstileWidget,
  UweLandingPage,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  PASSWORD_STRENGTH_LABELS,
  evaluatePasswordStrength,
  formatForgotPasswordError,
  isPasskeySupported,
  loginWithPasskey,
  readPublicAppUrls,
  registerPasskey,
  resolveAuthLinks,
  type AuthLinkTargets,
  type MaintenanceAppSurface,
  type MaintenanceRecoveryPollerProps,
  type PasswordRequirementsProps,
  type PasswordRule,
  type PasswordStrengthLevel,
  type PasskeyLoginResult,
  type PasskeyLoginSuccessUser,
  type PasskeyRegisterResult,
  type PasswordStrengthMeterProps,
  type PasswordStrengthResult,
  type TurnstileWidgetProps,
  type UweLandingPageProps,
  type UweAuthApp,
} from "./auth";

export {
  AppAccentScope,
  AppUrlsProvider,
  CrossAppBottomNav,
  crossAppBottomNavItems,
  readClientAppUrls,
  useClientAppUrls,
  PaintedScene,
  SceneContent,
  SceneHero,
  ThemeModeToggle,
  type AccentApp,
  type AccentScopeLayout,
  type ClientAppUrls,
  type CrossAppBottomNavProps,
  type CrossAppTarget,
  type PaintedSceneProps,
  type SceneHeroProps,
  type SceneVeil,
  type ThemeModeToggleSize,
} from "./scene";

export {
  dayIndex,
  getScenePool,
  pickScene,
  resolveScenePair,
  sceneCssUrl,
  sceneUrl,
  scenesForAreas,
  HANDOUT_PREVIEW,
  SCENE_AREAS,
  SCENE_BREAKPOINT_PX,
  SCENE_FILE_EXTENSION,
  SCENE_MODES,
  SCENE_POOLS,
  SCENE_PUBLIC_DIR,
  SCENE_TIME_ZONE,
  SCENE_VARIANTS,
  type Scene,
  type SceneArea,
  type SceneCadence,
  type SceneMode,
  type ScenePair,
  type SceneVariant,
} from "./scene";

export {
  GlobalSearchForm,
  SearchFilterBar,
  SearchResultsList,
  type SearchResultViewModel,
} from "./SearchResults";

export {
  ASSET_TYPE_LABELS,
  BLOCK_TYPE_LABELS,
  CANONICAL_LABELS,
  CANONICAL_DESCRIPTIONS,
  DUNGEON_PREP_STATUS_LABELS,
  GAME_SESSION_STATUS_LABELS,
  PAGE_TYPE_LABELS,
  PLAYER_NOTE_STATUS_LABELS,
  QUEST_STATUS_DESCRIPTIONS,
  QUEST_STATUS_LABELS,
  ENGINE_STATE_DESCRIPTIONS,
  ENGINE_STATE_LABELS,
  AssetTypeBadge,
  CanonicalBadge,
  DungeonPrepStatusBadge,
  GameSessionStatusBadge,
  PageTypeBadge,
  PlayerNoteStatusBadge,
  AiReviewedBadge,
  QuestStatusBadge,
  EngineStatusBadge,
  mapEngineReadinessToConnectorState,
  type EngineReadinessLike,
  TagChip,
  type EngineConnectorState,
} from "./StatusBadges";

export {
  ContentBlockList,
  MetaPanel,
  type ContentBlockViewModel,
} from "./ContentBlocks";


export {
  ThemePicker,
  THEME_OPTIONS,
  type ThemePickerProps,
} from "./ThemePicker";

export { HealthBadge } from "./HealthBadge";

export {
  BACKGROUND_PATTERN_LABELS,
  applyThemeAppearance,
  buildVisualThemeHtmlAttributes,
  type BackgroundPattern,
  type ThemeAppearance,
  type VisualThemeAppVariant,
  type VisualThemeHtmlAttributes,
  type VisualThemeSettings,
} from "./visual-theme";

export { ThemeDocumentSync } from "./ThemeDocumentSync";

export { VisualThemePreview, type VisualThemePreviewProps } from "./VisualThemePreview";

export {
  GraphRelationList,
  GraphView,
  type GraphViewProps,
  type GraphRelationListProps,
} from "./GraphView";


export {
  SoundboardWorkspace,
  type SoundboardButtonView,
  type SoundboardLinkedPage,
} from "./SoundboardWorkspace";

export {
  ThemeBootstrapScript,
  ThemeProvider,
  ThemeSettingsPanel,
  ThemeScopeSettingsPanel,
  UWE_THEMES,
  THEME_LIST,
  applyColorTokens,
  applyThemePreferences,
  defaultPreferences,
  fromUweThemePreferences,
  loadPreferences,
  toUweThemePreferences,
  getTheme,
  isThemeId,
  resolveThemeId,
  setCustomThemes,
  getCustomThemes,
  getCustomThemesForScope,
  toCustomThemeDefinition,
  toCustomThemeDefinitions,
  type AppScope,
  type ThemeId,
  type ThemeColorTokens,
  type UweThemePreferences,
  type CustomThemeDefinition,
  type CustomThemeScope,
  type CustomThemeInput,
  useUweTheme,
} from "./theme";

export {
  DashboardWidgetGrid,
  type DashboardWidgetGridProps,
} from "./dashboard-widget-grid";

export {
  CharacterLevelUpPanel,
  type CharacterLevelUpPanelProps,
} from "./CharacterLevelUpPanel";

export {
  CharacterSpellSection,
  type CharacterSpellSectionProps,
  type SpellSearchResult,
} from "./CharacterSpellSection";

export {
  CharacterDerivedStatsSection,
  CharacterProficiencyFields,
  type CharacterDerivedStatsSectionProps,
  type CharacterProficiencyFieldsProps,
} from "./CharacterDerivedStats";

export {
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableProps,
} from "./ResponsiveTable";

export {
  ErrorState,
  SkeletonLines,
  StatusPill,
  type ErrorStateProps,
  type SkeletonLinesProps,
  type StatusPillProps,
  type StatusTone,
} from "./StateViews";
