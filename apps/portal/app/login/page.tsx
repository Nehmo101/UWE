import Link from "next/link";
import { LoginForm } from "@uwe/shared-ui";

export default function LoginPage() {
  return (
    <LoginForm
      variant="portal"
      title="UWE Portal — Anmeldung"
      lead="Melde dich an, um freigegebene Inhalte deiner Kampagne zu sehen."
      defaultRedirect="/auth/worlds"
      forcePasswordRedirect="/auth/account/password"
      devDefaultEmail="aman@uwe.local"
      devDefaultPassword="uwe-dev"
      footer={<Link href="/">← Zurück zur Startseite</Link>}
      devCredentials={
        <div className="auth-seed-users">
          <h2>Entwicklungs-Benutzer</h2>
          <ul>
            <li>
              Spieler: aman@uwe.local, lazul@uwe.local, veldrin@uwe.local, finnion@uwe.local /
              uwe-dev
            </li>
          </ul>
        </div>
      }
    />
  );
}
