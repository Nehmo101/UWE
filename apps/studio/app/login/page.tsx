import { StudioLoginForm } from "@/src/components/StudioLoginForm";
import { StudioLoginFooter } from "@/components/StudioLoginFooter";
import { STUDIO_DASHBOARD_PATH } from "@/src/lib/routes";

export default function LoginPage() {
  return (
    <StudioLoginForm
      title="UWE Studio — Anmeldung"
      lead="Interne Schutzschicht für den Welten-Editor. Cloudflare Access bleibt die äußere Schutzschicht."
      defaultRedirect={STUDIO_DASHBOARD_PATH}
      forcePasswordRedirect="/account/password"
      devDefaultEmail="dm@uwe.local"
      devDefaultPassword="uwe-dev"
      footer={<StudioLoginFooter />}
      devCredentials={
        <>
          <p className="font-medium">Entwicklungs-Benutzer</p>
          <p className="text-muted-foreground">DM: dm@uwe.local / uwe-dev</p>
        </>
      }
    />
  );
}
