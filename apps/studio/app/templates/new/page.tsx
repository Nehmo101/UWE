import { createTemplateAction } from "../../template-actions";
import { TemplateEditorClient } from "../TemplateEditorClient";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewTemplatePage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Seiten-Templates", href: "/templates" },
            { label: "Neu" },
          ]}
        />
      }
    >
      <PageHeader
        title="Neues Template"
        summary="Eigene Quick-Create-Vorlage mit Standard-Blöcken anlegen — Live-Vorschau rechts."
      />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <TemplateEditorClient
        template={null}
        action={createTemplateAction}
        submitLabel="Template erstellen"
      />
    </StudioShell>
  );
}
