import {
  BreadcrumbTrail,
  PortalAuthChrome,
  PortalShell,
} from "@/src/components/shell";
import { getCurrentUser } from "@/src/lib/auth";
import { resolveLandingPublicBaseUrl } from "@uwe/auth";
import { AppAccentScope, SceneHero, dayIndex } from "@uwe/shared-ui";
import type { ReactNode } from "react";

export default async function AuthWorldsHubLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <PortalShell
      headerActions={
        <PortalAuthChrome user={user} startUrl={resolveLandingPublicBaseUrl()} />
      }
      breadcrumb={<BreadcrumbTrail items={[{ label: "Meine Welten" }]} />}
    >
      {/*
        Der Welten-Hub ist die erste Seite nach der Anmeldung — und war bis
        hierher die einzige Portal-Fläche ohne Bühne, obwohl die Weltseite
        direkt dahinter eine trägt. Dieselben Werte wie dort, damit der
        Übergang Hub → Welt kein Stilbruch ist.
      */}
      <AppAccentScope app="portal">
        <SceneHero
          area="portal"
          sceneIndex={dayIndex()}
          size="portal"
          veil="portal"
          groundStart="34%"
          groundEnd="84%"
          eyebrow="Spieler-Portal"
          title="Meine Welten"
          lede={
            user
              ? `Angemeldet als ${user.displayName}`
              : "Melde dich an, um freigegebene Welten zu sehen."
          }
        />
      </AppAccentScope>
      {children}
    </PortalShell>
  );
}
