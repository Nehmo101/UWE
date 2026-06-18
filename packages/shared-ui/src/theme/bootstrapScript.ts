import { LEGACY_THEME_ID_MAP, UWE_THEMES } from "./themes";
import { CSS_VARS } from "./tokens";

/** Minimal inline bootstrap to prevent theme flash before React hydrates. */
export function buildThemeBootstrapScript(scope: "studio" | "portal"): string {
  const storageKey =
    scope === "portal"
      ? "uwe-theme-preferences-portal"
      : "uwe-theme-preferences-studio";
  const defaultTheme =
    scope === "portal" ? "uwe-portal-purple" : "uwe-default";

  const colorMap: Record<string, Record<string, string>> = {};
  for (const theme of Object.values(UWE_THEMES)) {
    colorMap[theme.id] = {
      bg: theme.colors.bg,
      bgElevated: theme.colors.bgElevated,
      surface: theme.colors.surface,
      panel: theme.colors.panel,
      border: theme.colors.border,
      borderMuted: theme.colors.borderMuted,
      fg: theme.colors.fg,
      fgMuted: theme.colors.fgMuted,
      fgSubtle: theme.colors.fgSubtle,
      accent: theme.colors.accent,
      accentHover: theme.colors.accentHover,
      accentMuted: theme.colors.accentMuted,
      danger: theme.colors.danger,
      warning: theme.colors.warning,
      success: theme.colors.success,
      info: theme.colors.info,
      wikiLink: theme.colors.wikiLink,
      wikiLinkHover: theme.colors.wikiLinkHover,
      dmOnly: theme.colors.dmOnly,
      playerVisible: theme.colors.playerVisible,
      shellGradientStart: theme.colors.shellGradientStart,
      shellGradientMid: theme.colors.shellGradientMid,
      shellGradientEnd: theme.colors.shellGradientEnd,
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
  });

  return `(function(){
  var KEY=${JSON.stringify(storageKey)};
  var DEFAULT=${JSON.stringify(defaultTheme)};
  var MAP=${JSON.stringify(colorMap)};
  var VARS=${JSON.stringify(cssVarKeys)};
  var FONTS={mono:"ui-monospace, 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace",sans:"system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",serif:"Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif"};
  var DENSITY={compact:0.92,comfortable:1,spacious:1.08};
  var LEGACY=${JSON.stringify(LEGACY_THEME_ID_MAP)};
  try{
    var raw=localStorage.getItem(KEY);
    var prefs=raw?JSON.parse(raw):null;
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
