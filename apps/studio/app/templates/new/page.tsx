import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { createTemplateAction } from "../../template-actions";
import { TemplateForm } from "../TemplateForm";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewTemplatePage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Neues Template" href="/studio" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "Dashboard", href: "/studio" },
              { label: "Templates", href: "/templates", active: true },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/studio" },
              { label: "Templates", href: "/templates" },
              { label: "Neu" },
            ]}
          />

          <PageHeader
            title="Neues Template"
            summary="Eigene Quick-Create-Vorlage mit Standard-Blöcken anlegen."
          />

          {error && <p className="uwe-form-error" role="alert">{error}</p>}

          <TemplateForm template={null} action={createTemplateAction} submitLabel="Template erstellen" />
        </>
      }
    />
  );
}
