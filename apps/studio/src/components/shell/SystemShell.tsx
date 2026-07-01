"use client";

import * as React from "react";
import { StudioShell, type StudioShellProps } from "./StudioShell";

export type SystemShellProps = StudioShellProps;

/**
 * Backward-compatible alias for {@link StudioShell}.
 * Admin/system pages keep importing SystemShell, but the sidebar always uses
 * the full Studio IA so navigation stays consistent across routes.
 */
export function SystemShell(props: SystemShellProps) {
  return <StudioShell {...props} />;
}
