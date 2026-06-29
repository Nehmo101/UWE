import { createTemplateAction } from "../../template-actions";
import { TemplateForm } from "../TemplateForm";
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
        summary="Eigene Quick-Create-Vorlage mit Standard-Blöcken anlegen."
      />
      {error && <p className="uwe-form-error" role="alert">{error}</p>}

      <TemplateForm template={null} action={createTemplateAction} submitLabel="Template erstellen" />
    </StudioShell>
  );
}
