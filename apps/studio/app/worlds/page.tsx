import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import { listWorldTemplateOptions } from "@uwe/database/server";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import { StudioShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CreateWorldForm } from "@/components/CreateWorldForm";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { getStudioWorldList } from "@/src/lib/world-list-cache";
export default async function WorldsPage() {
  const [worlds, user, templates] = await Promise.all([
    getStudioWorldList(),
    getCurrentAuthUser(),
    Promise.resolve(listWorldTemplateOptions()),
  ]);
  const canCreateWorld = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Heute", href: "/today" }, { label: "Welten" }]} />}>
      <PageHeader title="Welten" summary="Wähle eine Welt für Kampagne und Wiki-Bearbeitung — oder lege eine neue an." />
      {canCreateWorld ? (
        <section className="mb-6 rounded-lg border border-border p-4">
          <CreateWorldForm templates={templates} />
        </section>
      ) : null}
      {worlds.length === 0 ? (
        <EmptyState title="Noch keine Welten" description="Erstelle oben deine erste Welt." />
      ) : (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Deine Welten</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {worlds.map((world) => (
              <article key={world.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <h2 className="text-lg font-semibold">
                  {world.name}
                  {world.isSandbox ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(Sandbox)</span>
                  ) : null}
                </h2>
            {world.description ? <p className="text-sm text-muted-foreground">{world.description}</p> : null}
            <div className="mt-auto flex flex-wrap gap-2">
              <Link className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground" href={`/worlds/${world.slug}/dashboard`}>Welt verwalten</Link>
            </div>
          </article>
        ))}</div></section>
      )}
    </StudioShell>
  );
}
