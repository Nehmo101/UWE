export {
  WikiContent,
  WikiSidebar,
} from "./WikiComponents";

export {
  AppShell,
  Breadcrumb,
  EmptyState,
  PageHeader,
  SearchField,
  SidebarNav,
  SidebarSection,
  StatGrid,
  TopBarBrand,
} from "./AppShell";

export { TopBarSessionMount } from "./TopBarSessionMount";

export {
  NavSidebarSections,
  CollapsibleNavSidebar,
  SectionHeader,
  type BreadcrumbItem,
  type NavSection,
  type SectionHeaderProps,
} from "./navigation";

export {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Badge,
  Tabs,
  Dialog,
  ToolWindow,
  Collapsible,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ToastProvider,
  useToast,
  ErrorState,
  LoadingState,
  SidebarItem,
  RailButton,
  BackLink,
  ContextActions,
  CopyToClipboardButton,
  cn,
  type BackLinkProps,
  type ButtonProps,
  type ButtonVariant,
  type ContextActionsProps,
  type CopyToClipboardButtonProps,
  type CardProps,
  type InputProps,
  type BadgeVariant,
  type TabItem,
  type DialogProps,
  type CollapsibleProps,
  type ToolWindowProps,
  type ToastMessage,
} from "./components";

export {
  ButtonV2,
  CardV2,
  PageHeaderV2,
  type ButtonV2Props,
  type ButtonV2Size,
  type ButtonV2Variant,
  type CardV2Props,
  type PageHeaderV2Props,
} from "./components-v2";

/** Package export path for design v2 CSS (import in app layouts). */
export const UWE_DESIGN_V2_CSS = "@uwe/shared-ui/uwe-v2.css";

/** @deprecated Legacy shared-ui shell widgets — new product code uses app-local shells. */
export {
  AdminStatusCard,
  AdminStatusGrid,
  StudioStatusFooter,
  WorldCockpitTabs,
  WorldCockpitCard,
  WorldCockpitHeader,
  WorldCockpitTag,
  type CockpitStatusItem,
  type CockpitStatusLevel,
} from "./shells";

export {
  SettingToggleRow,
  SettingsToggleGroup,
} from "./SettingToggleRow";

export {
  CollapsibleSection,
  MobileBottomNav,
  MobileContextPanel,
  MobileFilterSheet,
  MobileSidebarContent,
  PageListCards,
  SidebarContextProvider,
  StickyActionBar,
  type BottomNavItem,
  type PageListItem,
} from "./MobileComponents";

export { ViewEditToggle, type ViewEditToggleProps } from "./ViewEditToggle";

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
  readPublicAppUrls,
  resolveAuthLinks,
  type AuthLinkTargets,
  type MaintenanceAppSurface,
  type MaintenanceRecoveryPollerProps,
  type PasswordRequirementsProps,
  type PasswordRule,
  type PasswordStrengthLevel,
  type PasswordStrengthMeterProps,
  type PasswordStrengthResult,
  type TurnstileWidgetProps,
  type UweLandingPageProps,
  type UweAuthApp,
} from "./auth";

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
  ContentBlockList,
  DUNGEON_PREP_STATUS_LABELS,
  GAME_SESSION_STATUS_LABELS,
  MetaPanel,
  PAGE_TYPE_LABELS,
  PLAYER_NOTE_STATUS_LABELS,
  PUBLISH_LABELS,
  QUEST_STATUS_DESCRIPTIONS,
  QUEST_STATUS_LABELS,
  REVEAL_STATE_DESCRIPTIONS,
  REVEAL_STATE_LABELS,
  RTX_STATE_DESCRIPTIONS,
  RTX_STATE_LABELS,
  SECRET_LEVEL_DESCRIPTIONS,
  SECRET_LEVEL_LABELS,
  VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS,
  AssetTypeBadge,
  CanonicalBadge,
  DungeonPrepStatusBadge,
  GameSessionStatusBadge,
  PageTypeBadge,
  PlayerNoteStatusBadge,
  PublishBadge,
  AiReviewedBadge,
  QuestStatusBadge,
  RevealStateBadge,
  RtxStatusBadge,
  SecretLevelBadge,
  TagChip,
  VisibilityBadge,
  type ContentBlockViewModel,
  type RtxConnectorState,
} from "./StatusBadges";

export { SecretReveal, type SecretRevealProps } from "./SecretReveal";

export {
  CommandPalette,
  filterPaletteCommands,
  type CommandPaletteCommand,
  type CommandPaletteProps,
  type CommandPaletteSearchResult,
} from "./CommandPalette";

export {
  ThemePicker,
  THEME_OPTIONS,
  type ThemePickerProps,
} from "./ThemePicker";

export { BrandHeader } from "./BrandHeader";
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

export { CATEGORY_LABELS, WikiPageList, type WikiNavItem } from "./WikiComponents";

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
