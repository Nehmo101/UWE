import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
  VisibilityBadge,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import {
  createSoundboardButtonAction,
  deleteSoundboardButtonAction,
  linkPageToSoundboardButtonAction,
  updateSoundboardButtonAction,
} from "@/app/soundboard-actions";
import { SoundboardWorkspace, type SoundboardButtonView } from "./SoundboardWorkspace";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; created?: string; saved?: string; deleted?: string; linked?: string }>;
}

export default async function StudioSoundboardPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, created, saved, deleted, linked } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((campaign) => campaign.slug === campaignSlug)
    : null;

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const buttons = await auth.listSoundboardForDm(
    worldSlug,
    selectedCampaign?.id ?? undefined,
  );
  await db.$disconnect();

  const audioAssets = await repo.listAssetsByWorld(worldSlug, { type: "audio" });
  const linkablePages = await repo.listPagesByWorld(worldSlug, {
    campaignId: selectedCampaign?.id,
  });

  const buttonViews: SoundboardButtonView[] = buttons.map((button) => ({
    id: button.id,
    title: button.title,
    sourceType: button.sourceType,
    sourceUrl: button.sourceUrl,
    assetId: button.assetId,
    assetFileUrl: button.assetId ? `/api/assets/${button.assetId}/file` : null,
    thumbnail: button.thumbnail,
    volume: button.volume,
    loop: button.loop,
    tags: button.tags,
    visibility: button.visibility,
    linkedPageTitles: button.linkedPages.map((page) => page.title),
  }));

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/" },
                { label: "Seiten", href: `/worlds/${worldSlug}` },
                { label: "Sessions", href: `/worlds/${worldSlug}/sessions` },
                { label: "Soundboard", href: `/worlds/${worldSlug}/soundboard`, active: true },
                { label: "Assets", href: `/worlds/${worldSlug}/assets` },
              ]}
            />
          </SidebarSection>
          <SidebarSection title="Kampagnen">
            <SidebarNav
              items={[
                { label: "Alle", href: `/worlds/${worldSlug}/soundboard`, active: !campaignSlug },
                ...campaigns.map((campaign) => ({
                  label: campaign.name,
                  href: `/worlds/${worldSlug}/soundboard?campaign=${campaign.slug}`,
                  active: campaignSlug === campaign.slug,
                })),
              ]}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Soundboard" },
            ]}
          />
          <PageHeader
            title="Soundboard"
            summary="Ambient, Musik und Effekte pro Welt/Kampagne — lokale Dateien, YouTube und Spotify (vorbereitet)."
          />

          {(created || saved || deleted || linked) && (
            <p className="uwe-flash uwe-flash-success">Änderungen gespeichert.</p>
          )}

          <SoundboardWorkspace buttons={buttonViews} />

          <section className="uwe-panel">
            <h2>Neuer Soundboard-Button</h2>
            <form action={createSoundboardButtonAction} className="uwe-form-grid">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              {campaignSlug && <input type="hidden" name="campaignSlug" value={campaignSlug} />}
              <label>
                Titel
                <input type="text" name="title" required />
              </label>
              <label>
                Quelle
                <select name="sourceType" defaultValue="local">
                  <option value="local">Lokale Audiodatei</option>
                  <option value="youtube">YouTube-Link</option>
                  <option value="spotify">Spotify-Link</option>
                </select>
              </label>
              <label>
                Asset (lokal)
                <select name="assetId" defaultValue="">
                  <option value="">— Keins —</option>
                  {audioAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                URL (YouTube / Spotify)
                <input type="url" name="sourceUrl" placeholder="https://…" />
              </label>
              <label>
                Thumbnail-URL (optional)
                <input type="url" name="thumbnail" placeholder="https://…" />
              </label>
              <label>
                Lautstärke
                <input type="number" name="volume" min={0} max={1} step={0.05} defaultValue={1} />
              </label>
              <label>
                <input type="checkbox" name="loop" /> Loop
              </label>
              <label>
                Tags (kommagetrennt)
                <input type="text" name="tags" placeholder="ambient, kampf" />
              </label>
              <label>
                Sichtbarkeit
                <select name="visibility" defaultValue="dm_only">
                  {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Seiten verknüpfen (Mehrfachauswahl mit Strg/Cmd)
                <select name="linkedPageIds" multiple size={Math.min(linkablePages.length, 5) || 1}>
                  {linkablePages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title} ({page.type})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="uwe-btn uwe-btn-primary">
                Button erstellen
              </button>
            </form>
            <p className="uwe-table-sub">
              Audio-Assets zuerst unter{" "}
              <Link href={`/worlds/${worldSlug}/assets`}>Assets</Link> hochladen.
              Spotify-Wiedergabe erfordert später Premium und OAuth — siehe README.
            </p>
          </section>

          {buttons.length > 0 && (
            <section className="uwe-panel">
              <h2>Buttons verwalten</h2>
              <table className="uwe-page-table">
                <thead>
                  <tr>
                    <th>Titel</th>
                    <th>Quelle</th>
                    <th>Sichtbarkeit</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {buttons.map((button) => (
                    <tr key={button.id}>
                      <td>{button.title}</td>
                      <td>{button.sourceType}</td>
                      <td>
                        <VisibilityBadge visibility={button.visibility} />
                      </td>
                      <td>
                        <details>
                          <summary>Bearbeiten</summary>
                          <form action={updateSoundboardButtonAction} className="uwe-form-grid">
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="buttonId" value={button.id} />
                            <label>
                              Titel
                              <input type="text" name="title" defaultValue={button.title} required />
                            </label>
                            <label>
                              Quelle
                              <select name="sourceType" defaultValue={button.sourceType}>
                                <option value="local">Lokal</option>
                                <option value="youtube">YouTube</option>
                                <option value="spotify">Spotify</option>
                              </select>
                            </label>
                            <label>
                              Asset
                              <select name="assetId" defaultValue={button.assetId ?? ""}>
                                <option value="">— Keins —</option>
                                {audioAssets.map((asset) => (
                                  <option key={asset.id} value={asset.id}>
                                    {asset.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              URL
                              <input type="url" name="sourceUrl" defaultValue={button.sourceUrl ?? ""} />
                            </label>
                            <label>
                              Thumbnail
                              <input type="url" name="thumbnail" defaultValue={button.thumbnail ?? ""} />
                            </label>
                            <label>
                              Lautstärke
                              <input
                                type="number"
                                name="volume"
                                min={0}
                                max={1}
                                step={0.05}
                                defaultValue={button.volume}
                              />
                            </label>
                            <label>
                              <input type="checkbox" name="loop" defaultChecked={button.loop} /> Loop
                            </label>
                            <label>
                              Tags
                              <input type="text" name="tags" defaultValue={button.tags.join(", ")} />
                            </label>
                            <label>
                              Sichtbarkeit
                              <select name="visibility" defaultValue={button.visibility}>
                                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Verknüpfte Seiten (Mehrfachauswahl mit Strg/Cmd)
                              <select
                                name="linkedPageIds"
                                multiple
                                size={Math.min(linkablePages.length, 5) || 1}
                                defaultValue={button.linkedPages.map((page) => page.id)}
                              >
                                {/* Linked pages outside the current campaign filter stay selectable. */}
                                {button.linkedPages
                                  .filter((page) => !linkablePages.some((p) => p.id === page.id))
                                  .map((page) => (
                                    <option key={page.id} value={page.id}>
                                      {page.title}
                                    </option>
                                  ))}
                                {linkablePages.map((page) => (
                                  <option key={page.id} value={page.id}>
                                    {page.title} ({page.type})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button type="submit" className="uwe-btn">
                              Speichern
                            </button>
                          </form>
                          <form action={deleteSoundboardButtonAction}>
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="buttonId" value={button.id} />
                            <button type="submit" className="uwe-btn" style={{ marginTop: "0.5rem" }}>
                              Löschen
                            </button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {buttons.length > 0 && linkablePages.length > 0 && (
            <section className="uwe-panel">
              <h2>Seite verknüpfen</h2>
              <form action={linkPageToSoundboardButtonAction} className="uwe-form-grid">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <label>
                  Button
                  <select name="buttonId" required>
                    {buttons.map((button) => (
                      <option key={button.id} value={button.id}>
                        {button.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Seite (Ort, Dungeon, Raum, …)
                  <select name="pageId" required>
                    {linkablePages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title} ({page.type})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="uwe-btn">
                  Verknüpfen
                </button>
              </form>
            </section>
          )}
        </>
      }
      context={
        <SidebarSection title="Kontext">
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
            {buttons.length} Buttons
            {selectedCampaign ? ` in „${selectedCampaign.name}"` : ""}
          </p>
        </SidebarSection>
      }
    />
  );
}
