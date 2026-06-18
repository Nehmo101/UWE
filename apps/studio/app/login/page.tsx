import { LoginForm } from "@uwe/shared-ui";
import { StudioLoginFooter } from "@/components/StudioLoginFooter";
import { STUDIO_DASHBOARD_PATH } from "@/src/lib/routes";

export default function LoginPage() {
  return (
    <LoginForm
      variant="studio"
      title="UWE Studio — Anmeldung"
      lead="Interne Schutzschicht für den Welten-Editor. Cloudflare Access bleibt die äußere Schutzschicht."
      defaultRedirect={STUDIO_DASHBOARD_PATH}
      forcePasswordRedirect="/account/password"
      devDefaultEmail="dm@uwe.local"
      devDefaultPassword="uwe-dev"
      footer={<StudioLoginFooter />}
      devCredentials={
        <div className="studio-auth-seed-users">
          <h2>Entwicklungs-Benutzer</h2>
          <ul>
            <li>DM: dm@uwe.local / uwe-dev</li>
          </ul>
        </div>
      }
    />
  );
}
