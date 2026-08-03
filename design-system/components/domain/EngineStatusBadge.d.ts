import * as React from "react";

export type EngineConnectorState = "online" | "offline" | "disabled" | "starting" | "error";

export interface EngineStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Connector runtime state. */
  state?: EngineConnectorState;
  /** Override the default German label. */
  label?: React.ReactNode;
}

/** @deprecated Import from `@uwe/shared-ui` instead — canonical Maschinenraum status badge. */
export function EngineStatusBadge(props: EngineStatusBadgeProps): React.JSX.Element;
export const ENGINE_STATE_LABELS: Record<EngineConnectorState, string>;
