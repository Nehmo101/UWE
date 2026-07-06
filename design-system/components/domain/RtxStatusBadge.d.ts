import * as React from "react";

export type RtxConnectorState = "online" | "offline" | "disabled" | "starting" | "error";

export interface RtxStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Connector runtime state. */
  state?: RtxConnectorState;
  /** Override the default German label. */
  label?: React.ReactNode;
}

/** @deprecated Import from `@uwe/shared-ui` instead — canonical RTX status badge. */
export function RtxStatusBadge(props: RtxStatusBadgeProps): React.JSX.Element;
export const RTX_STATE_LABELS: Record<RtxConnectorState, string>;
