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
  worlds: (
    <RailSvg>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </RailSvg>
  ),
  create: (
    <RailSvg>
      <path d="M12 5v14M5 12h14" />
    </RailSvg>
  ),
  "media-ai": (
    <RailSvg>
      <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z" />
    </RailSvg>
  ),
  system: (
    <RailSvg>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.05.05-2.12 2.12-.05-.05A1.7 1.7 0 0 0 15.75 18.6a1.7 1.7 0 0 0-1 .58 1.7 1.7 0 0 0-.38 1.08V20.5h-3v-.24a1.7 1.7 0 0 0-.38-1.08 1.7 1.7 0 0 0-1-.58 1.7 1.7 0 0 0-1.87.34l-.05.05-2.12-2.12.05-.05A1.7 1.7 0 0 0 4.6 15.75a1.7 1.7 0 0 0-.58-1 1.7 1.7 0 0 0-1.08-.38H2.7v-3h.24a1.7 1.7 0 0 0 1.08-.38 1.7 1.7 0 0 0 .58-1 1.7 1.7 0 0 0-.34-1.87l-.05-.05L6.33 5.95l.05.05A1.7 1.7 0 0 0 8.25 6.4a1.7 1.7 0 0 0 1-.58 1.7 1.7 0 0 0 .38-1.08V4.5h3v.24a1.7 1.7 0 0 0 .38 1.08 1.7 1.7 0 0 0 1 .58 1.7 1.7 0 0 0 1.87-.34l.05-.05 2.12 2.12-.05.05A1.7 1.7 0 0 0 19.4 10.25a1.7 1.7 0 0 0 .58 1 1.7 1.7 0 0 0 1.08.38h.24v3h-.24a1.7 1.7 0 0 0-1.08.38 1.7 1.7 0 0 0-.58 1z" />
    </RailSvg>
  ),
};
