import { PortalWorldsHubList } from "@/src/components/PortalWorldsHubList";
import { getCurrentUser, listAuthWorlds } from "@/src/lib/auth";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
import { Card, CardContent } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/states";
import { canAccessStudio, resolveCrossAppUrls } from "@uwe/auth";
import Link from "next/link";

/**
 * Welten entstehen im Studio, nicht im Portal: Das Portal hat keinen
 * Erstellungs-Endpunkt mehr (der alte POST /api/worlds war ein Studio-Feature
 * hinter einer Portal-Tür). Owner/Admins bekommen hier nur den Wegweiser.
 */
function CreateWorldInStudioHint() {
  const { studio } = resolveCrossAppUrls();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border p-4">
      <div>
        <h2 className="text-lg font-semibold">Neue Welt erstellen</h2>
        <p className="text-sm text-muted-foreground">
          Welten werden im Studio angelegt und dort für Spieler freigegeben.
        </p>
      </div>
      <a href={`${studio}/worlds`} className={cn(buttonVariants())}>
        Im Studio erstellen
      </a>
    </div>
  );
}

export default async function AuthWorldsPage() {
  const user = await getCurrentUser();
  const worlds = await listAuthWorlds();
  const canCreateWorld = user ? canAccessStudio(user) : false;

  if (worlds.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          {canCreateWorld ? (
            <CreateWorldInStudioHint />
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
        {canCreateWorld ? <CreateWorldInStudioHint /> : null}

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
