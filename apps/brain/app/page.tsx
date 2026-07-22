import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";
import { isBrainOwner } from "@/src/lib/owner";
import { resolveBrainExposure } from "@/src/lib/exposure";
import { BrainNav } from "@/src/components/BrainNav";

export const dynamic = "force-dynamic";

const EXPOSURE_LABEL: Record<ReturnType<typeof resolveBrainExposure>, string> = {
  loopback: "nur lokal (Loopback)",
  lan: "LAN (nach Owner-Freigabe)",
  off: "deaktiviert",
};

export default async function BrainHome() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const exposure = resolveBrainExposure();

  return (
    <main className="page">
      <div className="card">
        {isBrainOwner(user.role) ? <BrainNav active="/" /> : null}
        <span className="eyebrow">Owner-only · lokal · nie in der Cloud</span>
        <h1>UWE Brain</h1>
        {isBrainOwner(user.role) ? (
          <>
            <p>
              Dein privater Alltags- und Wissensbereich — Daily Admin OS und Personal Brain,
              lokal auf deiner Hardware. Dieser Bereich wird nie öffentlich getunnelt.
            </p>
            <ul>
              <li>Mail, Kalender, Finanzen, Haushalt, Werkstatt</li>
              <li>Persönliches Wissen &amp; Capture-Inbox</li>
              <li>Lokale KI — private Inhalte verlassen den Host nicht</li>
            </ul>
            <p className="footer">
              Erreichbarkeit: {EXPOSURE_LABEL[exposure]}. Weitere Brain-Flächen folgen aus Studio.
            </p>
            <div className="footer">
              <a href="/life-brain">Persönliches Brain öffnen →</a>
            </div>
          </>
        ) : (
          <p>
            Dieser Bereich ist ausschließlich für den System-Owner. Angemeldet als Rolle
            „{user.role}“ — kein Zugriff auf den privaten Brain-Bereich.
          </p>
        )}
      </div>
    </main>
  );
}
