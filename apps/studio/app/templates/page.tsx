import Link from "next/link";
import { createPageTemplateService, prisma } from "@uwe/database/server";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { buttonVariants } from "@/src/components/ui";
import { TemplatesWorkspace } from "./TemplatesWorkspace";

interface Props {
  searchParams: Promise<{ error?: string; type?: string; q?: string }>;
}

export default async function TemplatesPage({ searchParams }: Props) {
  const { error, type: typeFilter, q: query } = await searchParams;
  const templates = await createPageTemplateService(prisma).listTemplates({
    includeInactive: true,
  });

  return (
    <>
      <ShellBreadcrumb items={[{ label: "Seiten-Templates" }]} />
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
        listPath="/templates"
        typeFilter={typeFilter}
        query={query}
        error={error}
      />
    </>
  );
}
