import * as React from "react";

export type Visibility =
  | "private"
  | "dm_only"
  | "player_visible"
  | "public"
  | "specific_players"
  | "unlock_after_session"
  | "archived";

export interface VisibilityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Content visibility. `dm_only` renders terracotta, `player_visible` teal. */
  visibility?: Visibility;
}

export function VisibilityBadge(props: VisibilityBadgeProps): React.JSX.Element;
export const VISIBILITY_LABELS: Record<Visibility, string>;
