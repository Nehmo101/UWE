import Link from "next/link";
import { CreateWorldForm } from "@/src/components/CreateWorldForm";
import { getCurrentUser, listAuthWorlds } from "@/src/lib/auth";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
import { Card, CardContent } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/states";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import { listWorldTemplateOptions } from "@uwe/database/server";

export default async function AuthWorldsPage() {
  const user = await getCurrentUser();
  const [worlds, templates] = await Promise.all([
    listAuthWorlds(),
    Promise.resolve(listWorldTemplateOptions()),
  ]);
  const canCreateWorld = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;

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

        <ul className="divide-y divide-border">
          {worlds.map((world) => (
            <li key={world.id}>
              <Link
                href={`/auth/worlds/${world.slug}`}
                className="flex flex-col gap-1 py-4 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-[var(--radius)]"
              >
                <strong className="font-semibold">{world.name}</strong>
                {world.description ? (
                  <span className="text-sm text-muted-foreground">{world.description}</span>
                ) : null}
                <em className="text-xs text-muted-foreground not-italic">
                  {world.guestModeEnabled ? "Gastmodus aktiv" : "Login erforderlich"}
                </em>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
