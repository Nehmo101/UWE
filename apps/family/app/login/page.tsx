import { resolveStudioPublicBaseUrl } from "@uwe/auth";

export const dynamic = "force-dynamic";

/**
 * Family teilt sich das UWE-Sitzungs-Cookie, die Anmeldung passiert also auf
 * der Hauptorigin. Family hat bewusst kein eigenes Anmeldeformular — es gibt
 * keine Selbstregistrierung, Zugänge legt der Owner in der Kommandozentrale an.
 */
export default function FamilyLogin() {
  const studioBase = resolveStudioPublicBaseUrl();
  return (
    <main className="page">
      <div className="card">
        <span className="eyebrow">Family-Häkchen</span>
        <h1>Anmeldung — UWE Family</h1>
        <p>
          Der Family-Bereich braucht das Häkchen <strong>Family</strong> für deine E-Mail-Adresse.
          Melde dich über UWE an; deine Sitzung gilt anschließend auch hier.
        </p>
        <div className="footer">
          <a href={studioBase}>Zur UWE-Anmeldung →</a>
        </div>
      </div>
    </main>
  );
}
