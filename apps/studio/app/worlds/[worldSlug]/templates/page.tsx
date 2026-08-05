import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import { createPageTemplateService, getAppRepository, prisma } from "@uwe/database/server";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { buttonVariants } from "@/src/components/ui";
import { TemplatesWorkspace } from "../../../templates/TemplatesWorkspace";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ error?: string; type?: string; q?: string }>;
}

/**
 * Seiten-Templates im Welt-Cockpit.
 *
 * Benutzt werden Templates beim Anlegen einer Seite, und das passiert immer in
 * einer Welt — deshalb liegt der Einstieg hier statt in der globalen
 * Seitenleiste. Die Vorlagen selbst bleiben weltübergreifend: ein NPC-Gerüst
 * ist in jeder Welt dasselbe. Der Hinweis in der Kontextspalte sagt das, damit
 * niemand eine Änderung für welt-lokal hält.
 */
export default async function WorldTemplatesPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { error, type: typeFilter, q: query } = await searchParams;

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const templates = await createPageTemplateService(prisma).listTemplates({
    includeInactive: true,
  });

  const listPath = `/worlds/${worldSlug}/templates`;

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(world.name, worldSlug, "Seiten-Templates", listPath)}
      />
      <ShellContextPanel>
        <SidebarSection title="Hinweise">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
            <li>
              Templates gelten für <strong>alle</strong> Welten — eine Änderung hier wirkt
              überall.
            </li>
            <li>System-Templates lassen sich anpassen und deaktivieren, nicht löschen.</li>
            <li>
              Aus einem Template entsteht eine Seite über{" "}
              <Link href={`/worlds/${worldSlug}/pages/new`}>Neue Seite</Link>.
            </li>
          </ul>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Seiten-Templates"
        summary="Vorlagen für Quick Create — System-Templates lassen sich anpassen und deaktivieren, eigene Templates frei verwalten."
        actions={
          <Link href="/templates/new" className={buttonVariants({ variant: "default" })}>
            Neues Template
          </Link>
        }
      />

      <TemplatesWorkspace
        templates={templates}
        listPath={listPath}
        typeFilter={typeFilter}
        query={query}
        error={error}
      />
    </>
  );
}
