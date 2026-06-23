import type { ReactNode } from "react";

function RailSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="uwe-rail-svg"
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

export const STUDIO_RAIL_ICON_MAP: Record<string, ReactNode> = {
  today: (
    <RailSvg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </RailSvg>
  ),
  capture: (
    <RailSvg>
      <path d="M12 5v14M5 12h14" />
    </RailSvg>
  ),
  search: (
    <RailSvg>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </RailSvg>
  ),
  "image-studio": (
    <RailSvg>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 15-5-5L5 19" />
    </RailSvg>
  ),
  ai: (
    <RailSvg>
      <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z" />
    </RailSvg>
  ),
};
