import Link from "next/link";
import { PAGE_TYPE_LABELS, ResponsiveTable } from "@uwe/shared-ui";
import { createPageTemplateService, prisma } from "@uwe/database/server";
import {
  duplicateTemplateAction,
  setTemplateActiveAction,
} from "../template-actions";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  Badge,
  Button,
  buttonVariants,
  EmptyState,
  Input,
  Label,
} from "@/src/components/ui";

interface Props {
  searchParams: Promise<{ error?: string; type?: string; q?: string }>;
}

export default async function TemplatesPage({ searchParams }: Props) {
  const { error, type: typeFilter, q: query } = await searchParams;
  const templates = await createPageTemplateService(prisma).listTemplates({
    includeInactive: true,
  });

  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const filtered = templates.filter((template) => {
    if (typeFilter && template.pageType !== typeFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      template.name.toLowerCase().includes(normalizedQuery) ||
      template.slug.toLowerCase().includes(normalizedQuery)
    );
  });

  const pageTypes = [...new Set(templates.map((template) => template.pageType))].sort();

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Seiten-Templates" }]} />}>
      <PageHeader
        title="Seiten-Templates"
        summary="Vorlagen für Quick Create — System-Templates lassen sich anpassen und deaktivieren, eigene Templates frei verwalten."
        actions={
          <Link href="/templates/new" className={buttonVariants({ variant: "default" })}>
            Neues Template
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 text-sm">
            <Label htmlFor="templates-filter-type">Kategorie (Seitentyp)</Label>
            {/* TODO(design-kit): Kit-Select erlaubt keinen leeren "Alle"-Wert (Radix-Limitierung) — natives Select bleibt hier. */}
            <select
              id="templates-filter-type"
              name="type"
              defaultValue={typeFilter ?? ""}
              className="h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Alle Typen</option>
              {pageTypes.map((pageType) => (
                <option key={pageType} value={pageType}>
                  {PAGE_TYPE_LABELS[pageType as keyof typeof PAGE_TYPE_LABELS] ?? pageType}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm">
            <Label htmlFor="templates-filter-q">Suche</Label>
            <Input id="templates-filter-q" name="q" defaultValue={query ?? ""} placeholder="Name oder Slug…" />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">Filtern</Button>
            {(typeFilter || normalizedQuery) && (
              <Link href="/templates" className={buttonVariants({ variant: "outline" })}>
                Zurücksetzen
              </Link>
            )}
          </div>
        </form>

        {/*
          Der Kopf hatte sechs Spalten, der Körper fünf: „Standard-Sichtbarkeit"
          stand als Überschrift da, ohne dass darunter je eine Zelle kam — ab
          dort war jede Spalte um eins verschoben beschriftet. Die
          Spaltendefinition unten kann das nicht mehr auseinanderlaufen lassen,
          weil Kopf und Zelle aus derselben Zeile stammen.
        */}
        <ResponsiveTable
          caption="Templates"
          rowKey={(template) => template.id}
          rows={filtered}
          columns={[
            {
              key: "name",
              label: "Name",
              primary: true,
              render: (template) => (
                <>
                  <Link href={`/templates/${template.id}`}>{template.name}</Link>
                  {template.isSystem && (
                    <Badge variant="secondary" className="ml-2">
                      System
                    </Badge>
                  )}
                </>
              ),
            },
            {
              key: "pageType",
              label: "Seitentyp",
              render: (template) => PAGE_TYPE_LABELS[template.pageType],
            },
            {
              key: "blocks",
              label: "Blöcke",
              numeric: true,
              render: (template) => template.blocks.length,
            },
            {
              key: "status",
              label: "Status",
              render: (template) => (template.isActive ? "Aktiv" : "Deaktiviert"),
            },
            {
              key: "actions",
              label: "Aktionen",
              render: (template) => (
                <div className="flex flex-wrap gap-1.5">
                  <form action={duplicateTemplateAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      Duplizieren
                    </Button>
                  </form>
                  <form action={setTemplateActiveAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={template.isActive ? "false" : "true"}
                    />
                    <Button type="submit" variant="secondary" size="sm">
                      {template.isActive ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                  </form>
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              title="Keine Templates für diesen Filter"
              description="Passe Kategorie oder Suche an, oder lege ein neues Template an."
            />
          }
        />
      </div>
    </StudioShell>
  );
}
