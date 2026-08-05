import { CreateWorldForm } from "@/src/components/CreateWorldForm";
import { PortalWorldsHubList } from "@/src/components/PortalWorldsHubList";
import { getCurrentUser, listAuthWorlds } from "@/src/lib/auth";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
import { Card, CardContent } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/states";
import { canAccessStudio } from "@uwe/auth";
import { listWorldTemplateOptions } from "@uwe/database/server";
import Link from "next/link";
import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ alle?: string }>;
}

export default async function AuthWorldsPage({ searchParams }: Props) {
  const { alle } = await searchParams;
  const user = await getCurrentUser();
  const [worlds, templates] = await Promise.all([
    listAuthWorlds(),
    Promise.resolve(listWorldTemplateOptions()),
  ]);
  const canCreateWorld = user ? canAccessStudio(user) : false;

  /*
    Wer genau einer Welt zugeordnet ist, hat hier nichts zu wählen. Die
    Zwischenseite kostete dann bei jedem Einstieg einen Klick und ließ die
    Seitenleiste ohne Welt-Navigation dastehen — die Taskleiste sah anders aus
    als überall sonst. Bei mehreren Welten bleibt die Auswahl, weil es dann
    wirklich etwas zu entscheiden gibt.

    `?alle=1` hebt die Weiterleitung auf. Das ist kein Feinschliff, sondern
    nötig: sonst käme niemand mit einer Welt je wieder an das Formular zum
    Anlegen einer zweiten.
  */
  if (worlds.length === 1 && alle !== "1") {
    redirect(`/auth/worlds/${worlds[0]!.slug}`);
  }

  if (worlds.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          {canCreateWorld ? (
            <CreateWorldForm templates={templates} />
          ) : (
            <EmptyState
              title="Keine Welten gefunden"
              description={
                user
                  ? "Du hast noch keinen Zugriff auf Welten. Bitte einen Owner/Admin um Freigabe."
                  : "Melde dich an, um freigegebene Welten zu sehen."
              }
              action={
                user ? undefined : (
                  <Link href="/login" className={cn(buttonVariants())}>
                    Zur Anmeldung
                  </Link>
                )
              }
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {canCreateWorld ? <CreateWorldForm templates={templates} /> : null}

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
