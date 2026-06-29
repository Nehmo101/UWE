import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { WebhookWorkspace } from "@/components/WebhookWorkspace";

export default function WebhooksPage() {
  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Webhooks" }]}
        />
      }
    >
      <PageHeader
        title="Webhooks"
        summary="Outbound-Event-Webhooks mit HMAC-Signatur, SSRF-Schutz und Delivery-Log."
      />
      <WebhookWorkspace />
    </SystemShell>
  );
}
