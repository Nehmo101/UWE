"use client";

import { LogoutButton, SessionIdleGuard } from "@uwe/shared-ui";
import { buttonVariants } from "../ui/button";
import { cn } from "../ui/cn";

export interface StudioAuthChromeProps {
  user: {
    displayName: string;
  };
  portalHref?: string | null;
  inactivityTimeoutMs?: number;
  logoutRedirect?: string;
}

/** Top-bar actions for authenticated Studio shells (Portal link + logout). */
export function StudioAuthChrome({
  user,
  portalHref,
  inactivityTimeoutMs = 0,
  logoutRedirect = "/login",
}: StudioAuthChromeProps) {
  return (
    <div className="flex shrink-0 items-center gap-2" data-testid="uwe-session-chrome">
      {portalHref ? (
        <a href={portalHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Portal öffnen
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
