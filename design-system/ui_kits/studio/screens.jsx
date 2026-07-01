/* UWE Studio UI kit — screens.
 * Recreates the DM cockpit (Daily Admin OS + campaign editor) using the design
 * system components. Three switchable screens: Today, World overview, Wiki page.
 * Exported to window for index.html to mount.
 */
const { Button, Card, StatCard, Badge, Tag, EmptyState, PageHeader, Breadcrumb,
        VisibilityBadge, PageTypeBadge, RtxStatusBadge, SecretReveal } = window.UWEDesignSystem_f43eab;

const Icon = ({ n, s = 16 }) => React.createElement("i", { "data-lucide": n, style: { width: s, height: s, display: "inline-flex", flex: "none" } });

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 12px" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--uwe-font-serif)", fontSize: "var(--uwe-text-xl)", color: "var(--uwe-fg)" }}>{children}</h2>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- Today --- */
function TodayScreen() {
  return (
    <div>
      <PageHeader
        title="Heute"
        summary="Dein tägliches Admin-Cockpit — Capture, Projekte, Sessions und Systemstatus auf einen Blick."
        meta={<><Badge tone="neutral">Dienstag, 1. Juli</Badge><RtxStatusBadge state="online" /></>}
        actions={<><Button variant="secondary" icon={<Icon n="inbox" />}>Capture</Button><Button variant="accent" icon={<Icon n="plus" />}>Notiz</Button></>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard value={7} label="Capture-Inbox" hint="3 unsortiert" />
        <StatCard value={4} label="Offene Projekte" />
        <StatCard value="Fr 19:00" label="Nächste Session" hint="in 3 Tagen" />
        <StatCard value={2} label="Verträge fällig" hint="diesen Monat" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div>
          <SectionTitle action={<Button variant="ghost" size="sm">Alle</Button>}>Braucht Aufmerksamkeit</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { i: "shield-alert", t: "World Inspector: 1 GM-Notiz player-sichtbar", d: "Terra · Validori › Docks", tone: "warning" },
              { i: "database-backup", t: "Letztes Backup vor 6 Tagen", d: "Auto-Backup-Scheduler prüfen", tone: "warning" },
              { i: "link", t: "2 defekte Wikilinks", d: "Terra · Nepurga-Fraktion", tone: "neutral" },
            ].map((r, k) => (
              <div key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", border: "1px solid var(--uwe-border)", borderRadius: 12, background: "var(--uwe-card-bg)" }}>
                <span style={{ color: r.tone === "warning" ? "var(--uwe-warning)" : "var(--uwe-fg-muted)", marginTop: 2 }}><Icon n={r.i} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--uwe-text-base)", color: "var(--uwe-fg)", fontWeight: 500 }}>{r.t}</div>
                  <div style={{ fontSize: "var(--uwe-text-sm)", color: "var(--uwe-fg-muted)", marginTop: 2 }}>{r.d}</div>
                </div>
                <Button variant="subtle" size="sm">Beheben</Button>
              </div>
            ))}
          </div>

          <div style={{ height: 24 }} />
          <SectionTitle>Schnellzugriff</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Welt Terra", "KI-Generator", "Soundboard", "Label-Druck", "Kalender", "Mail Center"].map((c) => (
              <a key={c} href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: "1px solid var(--uwe-border)", background: "var(--uwe-card-bg)", fontSize: "var(--uwe-text-sm)", color: "var(--uwe-fg)", textDecoration: "none" }}>{c}</a>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Capture-Inbox</SectionTitle>
          <Card padded={false}>
            {[
              { t: "Idee: Schmugglertunnel unter den Docks", tag: "idee" },
              { t: "Spielerfrage zu Nepurga-Vertrag", tag: "session" },
              { t: "Homelab: SSD für UWE-Host bestellen", tag: "hardware" },
            ].map((n, k) => (
              <div key={k} style={{ padding: "12px 14px", borderBottom: k < 2 ? "1px solid var(--uwe-border-muted)" : "none", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: "var(--uwe-text-base)", color: "var(--uwe-fg)" }}>{n.t}</div>
                <Tag>{n.tag}</Tag>
              </div>
            ))}
          </Card>
          <div style={{ height: 16 }} />
          <Card title="KI & RTX">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "var(--uwe-text-sm)", color: "var(--uwe-fg-muted)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Lokale RTX</span><RtxStatusBadge state="online" /></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Cloud-Fallback</span><Badge tone="neutral">Nur Allg. Chat</Badge></div>
              <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>Brain & Weltwissen bleiben lokal — kein Cloud-Zugriff.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ World view --- */
function WorldScreen() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Welten", href: "#" }, { label: "Terra" }]} />
      <PageHeader
        title="Terra"
        summary="Kampagnenwelt · 12 Sessions gespielt · nächste Session Freitag 19:00 Uhr."
        meta={<><Badge tone="accent">Aktiv</Badge><Badge tone="neutral">D&D 5e</Badge></>}
        actions={<><Button variant="secondary" icon={<Icon n="search" />}>Suchen</Button><Button variant="accent" icon={<Icon n="sparkles" />}>KI-Generator</Button></>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard value={128} label="Seiten" hint="+6 diese Woche" />
        <StatCard value={14} label="NPCs" />
        <StatCard value={32} label="Orte" />
        <StatCard value={5} label="Offene Plots" />
      </div>

      <SectionTitle action={<Button variant="ghost" size="sm">Alle Seiten</Button>}>Zuletzt bearbeitet</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {[
          { t: "Hafenstadt Validori", type: "location", vis: "player_visible", d: "Handelsknoten am Südmeer." },
          { t: "Kapitän Serel Vance", type: "npc", vis: "dm_only", d: "Doppelagentin der Nepurga." },
          { t: "Nepurga-Fraktion", type: "faction", vis: "player_visible", d: "Schmugglerkartell der Docks." },
          { t: "Session 13 — Der Vertrag", type: "session", vis: "private", d: "Vorbereitung läuft." },
        ].map((p, k) => (
          <div key={k} style={{ padding: 16, border: "1px solid var(--uwe-border)", borderRadius: 14, background: "var(--uwe-card-bg)" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><PageTypeBadge type={p.type} /><VisibilityBadge visibility={p.vis} /></div>
            <div style={{ fontFamily: "var(--uwe-font-serif)", fontSize: "var(--uwe-text-lg)", fontWeight: 600, color: "var(--uwe-fg)" }}>{p.t}</div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--uwe-text-sm)", color: "var(--uwe-fg-muted)" }}>{p.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Wiki page --- */
function WikiPageScreen() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>
      <div style={{ maxWidth: "52rem" }}>
        <Breadcrumb items={[{ label: "Terra", href: "#" }, { label: "Orte", href: "#" }, { label: "Validori" }]} />
        <PageHeader
          title="Hafenstadt Validori"
          summary="Handelsknoten am Südmeer. Drei Fraktionen ringen um die Kontrolle der Docks."
          meta={<><PageTypeBadge type="location" /><VisibilityBadge visibility="player_visible" /><Badge tone="success">Kanon</Badge></>}
          actions={<><Button variant="secondary" icon={<Icon n="eye" />}>Vorschau</Button><Button variant="accent" icon={<Icon n="pencil" />}>Bearbeiten</Button></>}
        />
        <div style={{ fontSize: "var(--uwe-text-md)", lineHeight: 1.7, color: "var(--uwe-fg)" }}>
          <p>Validori liegt an der Mündung des Arbor-Flusses, wo Süßwasser auf das Salz des Südmeers trifft. Die Stadt lebt vom Handel — Gewürze, Bernstein und Gerüchte wechseln hier gleichermaßen den Besitzer.</p>
          <h2 style={{ fontFamily: "var(--uwe-font-serif)", fontSize: "var(--uwe-text-xl)", marginTop: 20 }}>Die Docks</h2>
          <p>Wer die Docks kontrolliert, kontrolliert Validori. Aktuell teilen sich die <a href="#" style={{ color: "var(--uwe-wiki-link)" }}>Nepurga-Fraktion</a> und die Händlergilde die Kaimauern — ein brüchiger Frieden.</p>
        </div>
        <div style={{ height: 16 }} />
        <SecretReveal label="GM-Geheimnis">
          Kapitän Serel Vance meldet der Nepurga jeden Zoll­manifest weiter. Wird sie enttarnt, kippt der Dock-Frieden binnen einer Session.
        </SecretReveal>
      </div>

      <aside>
        <Card title="Metadaten">
          <dl style={{ margin: 0, display: "grid", gap: 10 }}>
            {[["Typ", <PageTypeBadge type="location" />], ["Sichtbarkeit", <VisibilityBadge visibility="player_visible" />], ["Publish", <Badge tone="accent">Veröffentlicht</Badge>], ["Kanon", <Badge tone="success">Kanon</Badge>]].map(([k, v]) => (
              <div key={k}>
                <dt style={{ fontSize: "var(--uwe-text-2xs)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--uwe-fg-muted)", marginBottom: 4 }}>{k}</dt>
                <dd style={{ margin: 0 }}>{v}</dd>
              </div>
            ))}
            <div>
              <dt style={{ fontSize: "var(--uwe-text-2xs)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--uwe-fg-muted)", marginBottom: 4 }}>Tags</dt>
              <dd style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: 4 }}><Tag>hafen</Tag><Tag>handel</Tag><Tag>intrige</Tag></dd>
            </div>
          </dl>
        </Card>
      </aside>
    </div>
  );
}

window.UWEStudioScreens = { TodayScreen, WorldScreen, WikiPageScreen, Icon };
