import { notFound } from "next/navigation";
import { getAppRepository, prisma } from "@uwe/database/server";
import {
  buildOneShotOutline,
  ONE_SHOT_TONE_LABELS,
  ONE_SHOT_TONES,
  serializeOneShotOutline,
  type OneShotTone,
} from "@uwe/ai-brain";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { saveOneShotDraftAction } from "@/app/worlds/[worldSlug]/one-shot-actions";
import { getInferenceStatus } from "@uwe/ai-brain";
import { OneShotQuickAssistant } from "@/components/OneShotQuickAssistant";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ location?: string; tone?: string; npc?: string | string[] }>;
}

function isTone(value: string | undefined): value is OneShotTone {
  return !!value && (ONE_SHOT_TONES as string[]).includes(value);
}

export default async function OneShotPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { location, tone, npc } = await searchParams;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const pages = await prisma.page.findMany({
    where: { worldId: world.id, type: { in: ["location", "region", "npc"] } },
    select: { title: true, type: true },
    orderBy: { title: "asc" },
  });
  const locations = pages.filter((p) => p.type === "location" || p.type === "region");
  const npcs = pages.filter((p) => p.type === "npc");
  const selectedNpcs = (Array.isArray(npc) ? npc : npc ? [npc] : []).filter(Boolean);

  const generate = !!location && isTone(tone);
  const outline = generate
    ? buildOneShotOutline({
        worldName: world.name,
        worldSlug,
        locationName: location!,
        tone: tone as OneShotTone,
        npcs: selectedNpcs.map((name) => ({ name })),
      })
    : null;
  const inference = await getInferenceStatus();

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "One-Shot-Generator", `/worlds/${worldSlug}/one-shot`)}
        />
      }
    >
      <PageHeader
        title="One-Shot-Generator aus Kanon"
        summary="Ort, Ton und bekannte NPCs wählen — UWE baut ein kanon-safes One-Shot-Gerüst mit getrenntem Spieler-Brief und DM-Geheimnissen. Als Quest-Entwurf speicherbar; nichts wird automatisch Kanon."
      />

      <OneShotQuickAssistant
        worldSlug={worldSlug}
        locations={locations}
        rtxReady={inference.online}
        rtxEnabled={inference.enabled}
      />

      <section className="uwe-v2-section">
        <form method="get" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
            <label>
              Ort
              <select name="location" defaultValue={location ?? ""}>
                <option value="">— wählen —</option>
                {locations.map((loc) => (
                  <option key={loc.title} value={loc.title}>
                    {loc.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ton
              <select name="tone" defaultValue={tone ?? "mystery"}>
                {ONE_SHOT_TONES.map((t) => (
                  <option key={t} value={t}>
                    {ONE_SHOT_TONE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Generieren
            </button>
          </div>
          {npcs.length > 0 ? (
            <fieldset style={{ border: "none", padding: 0 }}>
              <legend>NPCs einbeziehen</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {npcs.slice(0, 16).map((n) => (
                  <label key={n.title} style={{ display: "inline-flex", gap: "0.25rem" }}>
                    <input type="checkbox" name="npc" value={n.title} defaultChecked={selectedNpcs.includes(n.title)} />
                    {n.title}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </form>
      </section>

      {outline ? (
        <>
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">{outline.title}</h2>
            <p className="uwe-dashboard-muted">
              {ONE_SHOT_TONE_LABELS[outline.tone]} — {outline.atmosphere}
            </p>
            <h3>Spieler-Brief</h3>
            <p>{outline.playerBrief}</p>
            <h3>Szenen</h3>
            <ol>
              {outline.scenes.map((scene, index) => (
                <li key={index}>{scene}</li>
              ))}
            </ol>
            <h3>DM-Geheimnisse</h3>
            <ul>
              {outline.dmSecrets.map((secret, index) => (
                <li key={index}>{secret}</li>
              ))}
            </ul>
            <h3>Kanon-Warnungen</h3>
            <ul>
              {outline.canonWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </section>

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Markdown</h2>
            <pre style={{ whiteSpace: "pre-wrap", padding: "0.75rem", borderRadius: "6px", background: "var(--uwe-code-bg, rgba(0,0,0,0.05))", overflowX: "auto" }}>
              {serializeOneShotOutline(outline)}
            </pre>
          </section>

          <section className="uwe-v2-section">
            <form action={saveOneShotDraftAction}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="worldId" value={world.id} />
              <input type="hidden" name="worldName" value={world.name} />
              <input type="hidden" name="location" value={location} />
              <input type="hidden" name="tone" value={tone} />
              {selectedNpcs.map((name) => (
                <input key={name} type="hidden" name="npc" value={name} />
              ))}
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Als Quest-Entwurf speichern (Draft)
              </button>
            </form>
          </section>
        </>
      ) : null}
    </WorldShell>
  );
}
