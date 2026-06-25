import { LEGACY_THEME_ID_MAP, UWE_THEMES } from "./themes";
import { CSS_VARS, LAYOUT_TOKENS } from "./tokens";
import { resolveThemeColorTokens } from "./resolveColorTokens";
import type { UweThemePreferences } from "./storage";

export interface ThemeBootstrapOptions {
  serverPreferences?: UweThemePreferences | null;
  serverUpdatedAt?: string | null;
}

/** Minimal inline bootstrap to prevent theme flash before React hydrates. */
export function buildThemeBootstrapScript(
  scope: "studio" | "portal",
  options?: ThemeBootstrapOptions,
): string {
  const storageKey =
    scope === "portal"
      ? "uwe-theme-preferences-portal"
      : "uwe-theme-preferences-studio";
  const defaultTheme = "uwe-parchment-os";

  const colorMap: Record<string, Record<string, string>> = {};
  for (const theme of Object.values(UWE_THEMES)) {
    const resolved = resolveThemeColorTokens(theme.colors);
    colorMap[theme.id] = {
      bg: resolved.bg,
      bgElevated: resolved.bgElevated,
      surface: resolved.surface,
      panel: resolved.panel,
      border: resolved.border,
      borderMuted: resolved.borderMuted,
      fg: resolved.fg,
      fgMuted: resolved.fgMuted,
      fgSubtle: resolved.fgSubtle,
      accent: resolved.accent,
      accentHover: resolved.accentHover,
      accentMuted: resolved.accentMuted,
      onAccent: resolved.onAccent,
      link: resolved.link,
      danger: resolved.danger,
      warning: resolved.warning,
      success: resolved.success,
      info: resolved.info,
      wikiLink: resolved.wikiLink,
      wikiLinkHover: resolved.wikiLinkHover,
      dmOnly: resolved.dmOnly,
      playerVisible: resolved.playerVisible,
      shellGradientStart: resolved.shellGradientStart,
      shellGradientMid: resolved.shellGradientMid,
      shellGradientEnd: resolved.shellGradientEnd,
      sidebarBg: resolved.sidebarBg,
      sidebarFg: resolved.sidebarFg,
      sidebarFgMuted: resolved.sidebarFgMuted,
      cardBg: resolved.cardBg,
      inputBg: resolved.inputBg,
      focusRing: resolved.focusRing,
      focusShadow: resolved.focusShadow,
    };
  }

  const cssVarKeys = Object.entries({
    bg: CSS_VARS.bg,
    bgElevated: CSS_VARS.bgElevated,
    surface: CSS_VARS.surface,
    panel: CSS_VARS.panel,
    border: CSS_VARS.border,
    borderMuted: CSS_VARS.borderMuted,
    fg: CSS_VARS.fg,
    fgMuted: CSS_VARS.fgMuted,
    fgSubtle: CSS_VARS.fgSubtle,
    accent: CSS_VARS.accent,
    accentHover: CSS_VARS.accentHover,
    accentMuted: CSS_VARS.accentMuted,
    onAccent: CSS_VARS.onAccent,
    link: CSS_VARS.link,
    danger: CSS_VARS.danger,
    warning: CSS_VARS.warning,
    success: CSS_VARS.success,
    info: CSS_VARS.info,
    wikiLink: CSS_VARS.wikiLink,
    wikiLinkHover: CSS_VARS.wikiLinkHover,
    dmOnly: CSS_VARS.dmOnly,
    playerVisible: CSS_VARS.playerVisible,
    shellGradientStart: CSS_VARS.shellGradientStart,
    shellGradientMid: CSS_VARS.shellGradientMid,
    shellGradientEnd: CSS_VARS.shellGradientEnd,
    sidebarBg: CSS_VARS.sidebarBg,
    sidebarFg: CSS_VARS.sidebarFg,
    sidebarFgMuted: CSS_VARS.sidebarFgMuted,
    cardBg: CSS_VARS.cardBg,
    inputBg: CSS_VARS.inputBg,
    focusRing: CSS_VARS.focusRing,
    focusShadow: CSS_VARS.focusShadow,
  });

  return `(function(){
  var KEY=${JSON.stringify(storageKey)};
  var DEFAULT=${JSON.stringify(defaultTheme)};
  var MAP=${JSON.stringify(colorMap)};
  var VARS=${JSON.stringify(cssVarKeys)};
  var FONTS={mono:"var(--uwe-font-space-mono, ui-monospace), 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace",sans:"system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",serif:"var(--uwe-font-newsreader, Georgia), 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif"};
  var DENSITY={compact:0.92,comfortable:1,spacious:1.08};
  var LEGACY=${JSON.stringify(LEGACY_THEME_ID_MAP)};
  var LAYOUT=${JSON.stringify(LAYOUT_TOKENS)};
  var SERVER_PREFS=${JSON.stringify(options?.serverPreferences ?? null)};
  var SERVER_UPDATED_AT=${JSON.stringify(options?.serverUpdatedAt ?? null)};
  var SYNC_KEY=${JSON.stringify(scope === "portal" ? "uwe-theme-sync-at-portal" : "uwe-theme-sync-at-studio")};
  try{
    var raw=localStorage.getItem(KEY);
    var localSyncedAt=localStorage.getItem(SYNC_KEY);
    var useServer=SERVER_PREFS&&(!raw||!localSyncedAt||(SERVER_UPDATED_AT&&SERVER_UPDATED_AT>localSyncedAt));
    var prefs=useServer?SERVER_PREFS:(raw?JSON.parse(raw):null);
    var tid=prefs&&prefs.themeId;
    if(tid&&LEGACY[tid]) tid=LEGACY[tid];
    var themeId=(tid&&MAP[tid])?tid:DEFAULT;
    var colors=MAP[themeId];
    var root=document.documentElement;
    var style=root.style;
    for(var i=0;i<VARS.length;i++){
      var pair=VARS[i];
      if(colors[pair[0]]) style.setProperty(pair[1],colors[pair[0]]);
    }
    style.setProperty('--uwe-radius-sm',LAYOUT.radiusSm);
    style.setProperty('--uwe-radius-md',LAYOUT.radiusMd);
    style.setProperty('--uwe-radius-lg',LAYOUT.radiusLg);
    style.setProperty('--uwe-shadow-sm',LAYOUT.shadowSm);
    style.setProperty('--uwe-shadow-md',LAYOUT.shadowMd);
    style.setProperty('--uwe-shadow-lg',LAYOUT.shadowLg);
    style.setProperty('--uwe-spacing-xs',LAYOUT.spacingXs);
    style.setProperty('--uwe-spacing-sm',LAYOUT.spacingSm);
    style.setProperty('--uwe-spacing-md',LAYOUT.spacingMd);
    style.setProperty('--uwe-spacing-lg',LAYOUT.spacingLg);
    style.setProperty('--uwe-spacing-xl',LAYOUT.spacingXl);
    style.setProperty('--uwe-spacing-2xl',LAYOUT.spacing2xl);
    root.dataset.uweTheme=themeId;
    if(prefs&&prefs.font&&FONTS[prefs.font]) style.setProperty('--uwe-font-family',FONTS[prefs.font]);
    if(prefs&&prefs.density&&DENSITY[prefs.density]!=null) style.setProperty('--uwe-density-scale',String(DENSITY[prefs.density]));
    if(prefs&&prefs.uiScale>=0.9&&prefs.uiScale<=1.1) style.setProperty('--uwe-ui-scale',String(prefs.uiScale));
    var body=document.body;
    if(!body) return;
    var bg=(prefs&&prefs.background)||'none';
    if(bg!=='none') body.classList.add('uwe-bg-'+bg);
    body.dataset.uweBackground=bg;
    if(prefs&&prefs.frostedGlass) body.classList.add('uwe-theme-frosted');
    var m=document.querySelector('meta[name="theme-color"]');
    if(m&&colors.bg) m.setAttribute('content',colors.bg);
  }catch(e){}
})();`;
}
