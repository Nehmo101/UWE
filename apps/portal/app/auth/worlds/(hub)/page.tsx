import { PortalWorldsHubList } from "@/src/components/PortalWorldsHubList";
import { getCurrentUser, listAuthWorlds } from "@/src/lib/auth";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
import { Card, CardContent } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/states";
import { canAccessStudio, resolveStudioPublicBaseUrl } from "@uwe/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Welten entstehen ausschließlich im Studio. Das Portal ist die Spielersicht und
 * zeigt nur, was freigegeben ist — wer das Studio-Häkchen trägt, bekommt hier
 * den Weg dorthin statt eines zweiten Erstellungsformulars.
 */
function emptyStateDescription(hasUser: boolean, hasStudio: boolean): string {
  if (!hasUser) {
    return "Melde dich an, um freigegebene Welten zu sehen.";
  }
  if (hasStudio) {
    return "Dir ist noch keine Welt zugeordnet. Welten werden im Studio angelegt und dort freigegeben.";
  }
  return "Du hast noch keinen Zugriff auf Welten. Bitte einen Owner/Admin um Freigabe.";
}

interface Props {
  searchParams: Promise<{ alle?: string }>;
}

export default async function AuthWorldsPage({ searchParams }: Props) {
  const { alle } = await searchParams;
  const user = await getCurrentUser();
  const worlds = await listAuthWorlds();

  /*
    Wer genau einer Welt zugeordnet ist, hat hier nichts zu wählen. Die
    Zwischenseite kostete dann bei jedem Einstieg einen Klick und ließ die
    Seitenleiste ohne Welt-Navigation dastehen — die Taskleiste sah anders aus
    als überall sonst. Bei mehreren Welten bleibt die Auswahl, weil es dann
    wirklich etwas zu entscheiden gibt.

    `?alle=1` hebt die Weiterleitung auf — für den, der die Übersicht bewusst
    sehen will (etwa nachdem der Owner eine zweite Welt zugeordnet hat und der
    Link aus einer alten Sitzung noch auf die erste zeigt).
  */
  if (worlds.length === 1 && alle !== "1") {
    redirect(`/auth/worlds/${worlds[0]!.slug}`);
  }

  if (worlds.length === 0) {
    const hasStudio = user ? canAccessStudio(user) : false;
    let action: ReactNode;
    if (!user) {
      action = (
        <Link href="/login" className={cn(buttonVariants())}>
          Zur Anmeldung
        </Link>
      );
    } else if (hasStudio) {
      action = (
        <a href={`${resolveStudioPublicBaseUrl()}/worlds`} className={cn(buttonVariants())}>
          Welten im Studio
        </a>
      );
    }

    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            title="Keine Welten gefunden"
            description={emptyStateDescription(Boolean(user), hasStudio)}
            action={action}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <PortalWorldsHubList
          worlds={worlds.map((world) => ({
            id: world.id,
            slug: world.slug,
            name: world.name,
            description: world.description,
            updatedAt: world.updatedAt.toISOString(),
          }))}
        />
      </CardContent>
    </Card>
  );
}
