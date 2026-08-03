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
  /** Apex-Origin der öffentlichen Startseite (`resolveLandingPublicBaseUrl`). */
  startUrl?: string | null;
}

/**
 * Top-bar actions for authenticated Portal shells (UWE Start + logout).
 *
 * Statt „Studio öffnen": die Startseite ist der Ort, von dem aus man zwischen
 * allen Bereichen wechselt — und sie ist öffentlich, braucht also kein
 * Studio-Häkchen als Bedingung.
 */
export function PortalAuthChrome({ user, startUrl }: PortalAuthChromeProps) {
  return (
    <>
      {startUrl ? (
        <a
          href={startUrl}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          UWE Start
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
