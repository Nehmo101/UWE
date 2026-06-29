"use client";

import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { cn } from "../ui/cn";
import { LogoutButton } from "../LogoutButton";

export interface PortalAuthChromeProps {
  user?: {
    displayName: string;
    email: string | null;
  } | null;
  studioUrl?: string | null;
  canAccessStudio?: boolean;
}

/** Top-bar actions for authenticated Portal shells (Studio link + logout). */
export function PortalAuthChrome({
  user,
  studioUrl,
  canAccessStudio = false,
}: PortalAuthChromeProps) {
  return (
    <>
      {canAccessStudio && studioUrl ? (
        <a
          href={studioUrl}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Studio öffnen
        </a>
      ) : null}
      {user ? (
        <LogoutButton displayName={user.displayName} />
      ) : (
        <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Anmelden
        </Link>
      )}
    </>
  );
}
