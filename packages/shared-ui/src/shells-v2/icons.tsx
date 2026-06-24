import type { ReactNode } from "react";

function NavSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="uwe-v2-nav-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconToday() {
  return (
    <NavSvg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </NavSvg>
  );
}

export function IconCapture() {
  return (
    <NavSvg>
      <path d="M12 5v14M5 12h14" />
    </NavSvg>
  );
}

export function IconSearch() {
  return (
    <NavSvg>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </NavSvg>
  );
}

export function IconAi() {
  return (
    <NavSvg>
      <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z" />
    </NavSvg>
  );
}

export function IconMenu() {
  return (
    <NavSvg>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </NavSvg>
  );
}

export function IconHome() {
  return (
    <NavSvg>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </NavSvg>
  );
}

export function IconSessions() {
  return (
    <NavSvg>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h10M7 13h6" />
    </NavSvg>
  );
}

export function IconAssets() {
  return (
    <NavSvg>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 15-5-5L5 19" />
    </NavSvg>
  );
}

export type V2NavIconKey =
  | "today"
  | "capture"
  | "search"
  | "ai"
  | "menu"
  | "home"
  | "sessions"
  | "assets";

export const V2_NAV_ICONS: Record<V2NavIconKey, ReactNode> = {
  today: <IconToday />,
  capture: <IconCapture />,
  search: <IconSearch />,
  ai: <IconAi />,
  menu: <IconMenu />,
  home: <IconHome />,
  sessions: <IconSessions />,
  assets: <IconAssets />,
};

/** Map legacy bottom-nav emoji strings to V2 SVG icons. */
export function resolveV2BottomNavIcon(icon: string): ReactNode {
  const map: Record<string, V2NavIconKey> = {
    "☀": "today",
    "+": "capture",
    "🔍": "search",
    "✦": "ai",
    "☰": "menu",
    "⌂": "home",
    "📄": "sessions",
    "🛡": "search",
  };
  const key = map[icon];
  return key ? V2_NAV_ICONS[key] : icon;
}
