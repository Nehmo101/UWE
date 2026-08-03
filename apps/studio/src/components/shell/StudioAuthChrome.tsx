"use client";

import { LogoutButton, SessionIdleGuard } from "@uwe/shared-ui";
import { buttonVariants } from "../ui/button";
import { cn } from "../ui/cn";

export interface StudioAuthChromeProps {
  user: {
    displayName: string;
  };
  /** Apex-Origin der öffentlichen Startseite (`resolveLandingPublicBaseUrl`). */
  startHref?: string | null;
  inactivityTimeoutMs?: number;
  logoutRedirect?: string;
}

/**
 * Top-bar actions for authenticated Studio shells (UWE Start + logout).
 *
 * Statt „Portal öffnen": die Startseite ist der eine Ort, von dem aus man
 * zwischen Studio, Portal, Brain und Family wechselt — ein Knopf pro Bereich
 * in der Topbar skaliert mit vier Apps nicht mehr.
 */
export function StudioAuthChrome({
  user,
  startHref,
  inactivityTimeoutMs = 0,
  logoutRedirect = "/login",
}: StudioAuthChromeProps) {
  return (
    <div className="flex shrink-0 items-center gap-2" data-testid="uwe-session-chrome">
      {startHref ? (
        <a href={startHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          UWE Start
        </a>
      ) : null}
      <SessionIdleGuard
        timeoutMs={inactivityTimeoutMs}
        logoutRedirect={`${logoutRedirect}?reason=idle`}
      />
      <LogoutButton
        displayName={user.displayName}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        redirectTo={logoutRedirect}
      />
    </div>
  );
}
