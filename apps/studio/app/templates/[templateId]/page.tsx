import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BLOCK_TYPE_LABELS,
  PAGE_TYPE_LABELS,
} from "@uwe/shared-ui";
import { createPageTemplateService, prisma } from "@uwe/database/server";
import { updateTemplateAction } from "../../template-actions";
import { TemplateEditorClient } from "../TemplateEditorClient";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { Alert, buttonVariants, Card, CardContent } from "@/src/components/ui";

interface Props {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
}

export default async function EditTemplatePage({ params, searchParams }: Props) {
  const { templateId } = await params;
  const { saved, error, edit } = await searchParams;

  const template = await createPageTemplateService(prisma).getTemplate(templateId);
  if (!template) notFound();

  const isEditMode = edit === "1";

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Seiten-Templates", href: "/templates" },
            { label: template.name },
          ]}
        />
      }
    >
      <PageHeader
        title={template.name}
        summary={
          template.isSystem
            ? "System-Template — Änderungen wirken auf Quick Create in allen Welten."
            : "Eigenes Template bearbeiten."
        }
        actions={
          isEditMode ? (
            <Link href={`/templates/${template.id}`} className={buttonVariants({ variant: "secondary" })}>
              Lesemodus
            </Link>
          ) : (
            <Link href={`/templates/${template.id}?edit=1`} className={buttonVariants({ variant: "default" })}>
              Bearbeiten
            </Link>
          )
        }
      />

      <div className="flex flex-col gap-6">
        {saved && <Alert tone="success">Gespeichert.</Alert>}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {isEditMode ? (
          <TemplateEditorClient
            template={template}
            action={updateTemplateAction}
            submitLabel="Template speichern"
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <p className="text-sm text-muted-foreground">
                {template.description || "Keine Beschreibung"}
                {" · "}
                {PAGE_TYPE_LABELS[template.pageType]}
                {" · "}
              </p>
              {template.titlePlaceholder ? (
                <p className="text-sm text-muted-foreground">
                  Titel-Platzhalter: {template.titlePlaceholder}
                </p>
              ) : null}
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  Blöcke ({template.blocks.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {template.blocks.map((block, index) => (
                    <section key={index} className="rounded-[var(--radius)] border border-border p-4">
                      <p className="text-sm text-muted-foreground">
                        {BLOCK_TYPE_LABELS[block.type]}
                      </p>
                      <div className="whitespace-pre-wrap">{block.content}</div>
                    </section>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        )}
      </div>
    </StudioShell>
  );
}
