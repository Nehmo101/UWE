/* UWE Portal UI kit — player-facing wiki screens.
 * Login gate → world hub → article. Only player-visible content is shown; GM
 * secrets appear blurred behind a reveal. Exported to window for index.html.
 */
const { Button, Card, Badge, Tag, EmptyState, PageHeader, Breadcrumb,
        VisibilityBadge, PageTypeBadge, SecretReveal, Brand } = window.UWEDesignSystem_f43eab;

const PIcon = ({ n, s = 16 }) => React.createElement("i", { "data-lucide": n, style: { width: s, height: s, display: "inline-flex", flex: "none" } });

/* ------------------------------------------------------------ Login ------- */
function LoginScreen({ onLogin }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 0.95fr" }}>
      <aside style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem",
        background: "var(--uwe-sidebar-bg)", color: "var(--uwe-sidebar-fg)", borderRight: "2px solid var(--uwe-fg)" }}>
        <div style={{ width: "min(100%, 26rem)" }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--uwe-accent)", fontFamily: "var(--uwe-font-mono)" }}>Universeller Welten-Editor</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ width: 56, height: 56, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, var(--uwe-accent), color-mix(in srgb, var(--uwe-accent) 70%, var(--uwe-bg-elevated)))", color: "#fff", fontFamily: "var(--uwe-font-mono)", fontWeight: 800, fontSize: 30 }}>U</span>
            <span style={{ fontFamily: "var(--uwe-font-serif)", fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>Portal</span>
          </div>
          <p style={{ margin: "0 0 20px", lineHeight: 1.65, color: "var(--uwe-sidebar-fg-muted)" }}>Spieleransicht für Welten, Handouts und Sessions. Nur freigegebene Inhalte — lokal gehostet.</p>
          <p style={{ display: "flex", gap: 8, alignItems: "center", margin: 0, fontSize: 13, color: "var(--uwe-sidebar-fg-muted)" }}>
            <span style={{ padding: "2px 9px", borderRadius: 999, border: "1px solid color-mix(in srgb, var(--uwe-accent) 50%, transparent)", color: "var(--uwe-accent)", fontFamily: "var(--uwe-font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Portal</span>
            Lokal gehostet
          </p>
        </div>
      </aside>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 2rem" }}>
        <div style={{ width: "min(100%, 28rem)" }}>
          <h1 style={{ margin: "0 0 6px", fontFamily: "var(--uwe-font-serif)", fontSize: 28 }}>Anmelden</h1>
          <p style={{ margin: "0 0 20px", color: "var(--uwe-fg-muted)" }}>Öffne deine freigegebenen Welten.</p>
          <form onSubmit={(e) => { e.preventDefault(); onLogin(); }} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 14, fontWeight: 500 }}>E-Mail
              <input defaultValue="carina@uwe.local" style={fieldCss} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 14, fontWeight: 500 }}>Passwort
              <input type="password" defaultValue="········" style={fieldCss} /></label>
            <Button variant="accent" as="button" fullWidth style={{ marginTop: 4 }}>Anmelden</Button>
          </form>
          <p style={{ marginTop: 16, fontSize: 14 }}><a href="#" style={{ color: "var(--uwe-link)" }}>Passwort vergessen?</a></p>
        </div>
      </div>
    </div>
  );
}
const fieldCss = { width: "100%", padding: "0.65rem 0.8rem", borderRadius: "0.55rem", border: "1px solid var(--uwe-border)", background: "var(--uwe-input-bg)", color: "var(--uwe-fg)", font: "inherit", fontSize: 15 };

/* ------------------------------------------------------------ Article ----- */
function ArticleScreen({ onNav }) {
  return (
    <div style={{ maxWidth: "52rem" }}>
      <Breadcrumb items={[{ label: "Terra", href: "#" }, { label: "Orte", href: "#" }, { label: "Validori" }]} />
      <h1 style={{ fontFamily: "var(--uwe-font-serif)", fontSize: "clamp(2rem,4vw,2.5rem)", margin: "0 0 6px" }}>Hafenstadt Validori</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}><PageTypeBadge type="location" /><VisibilityBadge visibility="player_visible" /></div>
      <div style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "var(--uwe-fg)" }}>
        <p>Validori liegt an der Mündung des Arbor-Flusses, wo Süßwasser auf das Salz des Südmeers trifft. Die Stadt lebt vom Handel — Gewürze, Bernstein und Gerüchte wechseln hier gleichermaßen den Besitzer.</p>
        <h2 style={{ fontFamily: "var(--uwe-font-serif)", fontSize: "1.5rem", marginTop: 22 }}>Die Docks</h2>
        <p>Wer die Docks kontrolliert, kontrolliert Validori. Aktuell teilen sich die <a href="#" style={{ color: "var(--uwe-wiki-link)" }}>Nepurga-Fraktion</a> und die Händlergilde die Kaimauern.</p>
      </div>
      <div style={{ height: 18 }} />
      <SecretReveal label="Spoiler — nach Session 12">
        Ihr habt erfahren, dass Kapitän Serel Vance Zollmanifeste an die Nepurga weiterleitet.
      </SecretReveal>
      <div style={{ height: 18 }} />
      <Button variant="secondary" icon={<PIcon n="arrow-left" />} onClick={onNav}>Zurück zur Welt</Button>
    </div>
  );
}

/* ------------------------------------------------------------ World hub --- */
function WorldHubScreen({ onOpen }) {
  return (
    <div>
      <div style={{ position: "relative", padding: "2rem 0 1.5rem" }}>
        <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--uwe-accent)", fontFamily: "var(--uwe-font-mono)" }}>Kampagne</p>
        <h1 style={{ margin: "0 0 10px", fontFamily: "var(--uwe-font-serif)", fontSize: "clamp(2rem,5vw,3rem)" }}>Terra</h1>
        <p style={{ margin: 0, maxWidth: "38rem", lineHeight: 1.7, color: "var(--uwe-fg-muted)" }}>Willkommen, Carina. Hier findest du alle für dich freigegebenen Orte, NPCs, Handouts und Session-Zusammenfassungen.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { t: "Hafenstadt Validori", type: "location", d: "Handelsknoten am Südmeer.", open: true },
          { t: "Arbor-Wälder", type: "location", d: "Uralter Grenzwald im Norden." },
          { t: "Meister Aldric", type: "npc", d: "Euer Auftraggeber in Validori." },
          { t: "Handout: Seekarte", type: "handout", d: "Die Küste des Südmeers." },
          { t: "Session 12 — Zusammenfassung", type: "session", d: "Der Dock-Zwischenfall." },
          { t: "Regeln: Hausregeln", type: "rule", d: "Abweichungen vom SRD." },
        ].map((p, k) => (
          <a key={k} href="#" onClick={(e) => { e.preventDefault(); if (p.open) onOpen(); }}
            style={{ display: "block", padding: 16, border: "1px solid var(--uwe-border)", borderRadius: 14, background: "var(--uwe-card-bg)", textDecoration: "none", color: "inherit" }}>
            <div style={{ marginBottom: 8 }}><PageTypeBadge type={p.type} /></div>
            <div style={{ fontFamily: "var(--uwe-font-serif)", fontSize: "var(--uwe-text-lg)", fontWeight: 600, color: "var(--uwe-fg)" }}>{p.t}</div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--uwe-text-sm)", color: "var(--uwe-fg-muted)" }}>{p.d}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

window.UWEPortalScreens = { LoginScreen, ArticleScreen, WorldHubScreen, PIcon };
