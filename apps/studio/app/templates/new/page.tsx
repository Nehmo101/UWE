import { createTemplateAction } from "../../template-actions";
import { TemplateForm } from "../TemplateForm";
import { AdminModuleShell } from "@/components/AdminModuleShell";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewTemplatePage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <AdminModuleShell
      activePath="/templates"
      title="Neues Template"
      summary="Eigene Quick-Create-Vorlage mit Standard-Blöcken anlegen."
      breadcrumbs={[
        { label: "Dashboard", href: "/studio" },
        { label: "Templates", href: "/templates" },
        { label: "Neu" },
      ]}
    >
      {error && <p className="uwe-form-error" role="alert">{error}</p>}

      <TemplateForm template={null} action={createTemplateAction} submitLabel="Template erstellen" />
    </AdminModuleShell>
  );
}
