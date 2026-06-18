import { AdminModuleShell } from "@/components/AdminModuleShell";
import { WebhookWorkspace } from "@/components/WebhookWorkspace";

export default function WebhooksPage() {
  return (
    <AdminModuleShell
      activePath="/admin/webhooks"
      title="Webhooks"
      summary="Outbound-Event-Webhooks mit HMAC-Signatur, SSRF-Schutz und Delivery-Log."
    >
      <WebhookWorkspace />
    </AdminModuleShell>
  );
}
