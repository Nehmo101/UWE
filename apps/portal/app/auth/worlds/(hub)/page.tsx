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

export default async function AuthWorldsPage() {
  const user = await getCurrentUser();
  const [worlds, templates] = await Promise.all([
    listAuthWorlds(),
    Promise.resolve(listWorldTemplateOptions()),
  ]);
  const canCreateWorld = user ? canAccessStudio(user) : false;

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
