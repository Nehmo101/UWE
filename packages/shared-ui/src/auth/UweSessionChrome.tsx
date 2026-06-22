"use client";

import { LogoutButton } from "./LogoutButton";
import { SessionIdleGuard } from "./SessionIdleGuard";

interface UweSessionChromeProps {
  displayName: string;
  inactivityTimeoutMs?: number;
  logoutRedirect?: string;
  className?: string;
}

export function UweSessionChrome({
  displayName,
  inactivityTimeoutMs = 0,
  logoutRedirect = "/login",
  className = "uwe-session-chrome",
}: UweSessionChromeProps) {
  return (
    <div className={className} data-testid="uwe-session-chrome">
      <SessionIdleGuard timeoutMs={inactivityTimeoutMs} logoutRedirect={`${logoutRedirect}?reason=idle`} />
      <LogoutButton
        displayName={displayName}
        className="uwe-btn uwe-btn-ghost uwe-session-logout"
        redirectTo={logoutRedirect}
      />
    </div>
  );
}
