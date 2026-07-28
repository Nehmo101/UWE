import { resolveStudioPublicBaseUrl } from "@uwe/auth";

export const dynamic = "force-dynamic";

/**
 * Brain shares the UWE session cookie (domain-wide when SESSION_COOKIE_DOMAIN is
 * set), so sign-in happens on the main UWE origin and the session carries over
 * here. Brain is local and checkbox-gated — it hosts no credential form of its own.
 */
export default function BrainLogin() {
  const studioBase = resolveStudioPublicBaseUrl();
  return (
    <main className="page">
      <div className="card">
        <span className="eyebrow">Brain-Häkchen · lokal</span>
        <h1>Anmeldung — UWE Brain</h1>
        <p>
          Der private Brain-Bereich ist nur für den Owner und läuft lokal. Melde dich über UWE an;
          deine Sitzung gilt anschließend auch hier.
        </p>
        <div className="footer">
          <a href={studioBase}>Zur UWE-Anmeldung →</a>
        </div>
      </div>
    </main>
  );
}
