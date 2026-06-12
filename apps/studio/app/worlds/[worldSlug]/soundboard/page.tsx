import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
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
import { SoundboardButtonForm } from "./SoundboardButtonForm";
import { SoundboardWorkspace, type SoundboardButtonView } from "./SoundboardWorkspace";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    campaign?: string;
    created?: string;
    saved?: string;
    deleted?: string;
    linked?: string;
    error?: string;
    spotifyConnected?: string;
    spotifyError?: string;
  }>;
}

export default async function StudioSoundboardPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, created, saved, deleted, linked, error, spotifyConnected, spotifyError } =
    await searchParams;
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

  const soundboardReturnPath = `/worlds/${worldSlug}/soundboard${
    campaignSlug ? `?campaign=${encodeURIComponent(campaignSlug)}` : ""
  }`;

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
    linkedPages: button.linkedPages.map((page) => ({ title: page.title })),
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
            summary="Ambient, Musik und Effekte pro Welt/Kampagne — lokale Dateien, YouTube und Spotify (Web API)."
          />

          {(created || saved || deleted || linked) && (
            <p className="uwe-flash uwe-flash-success">Änderungen gespeichert.</p>
          )}

          {spotifyConnected && (
            <p className="uwe-flash uwe-flash-success">Spotify erfolgreich verbunden.</p>
          )}

          {(error || spotifyError) && (
            <p className="uwe-flash uwe-flash-error" role="alert">
              {error ?? spotifyError}
            </p>
          )}

          <SoundboardWorkspace
            buttons={buttonViews}
            spotifyReturnPath={soundboardReturnPath}
          />

          <section className="uwe-panel">
            <h2>Neuer Soundboard-Button</h2>
            <SoundboardButtonForm
              action={createSoundboardButtonAction}
              worldSlug={worldSlug}
              campaignSlug={campaignSlug}
              audioAssets={audioAssets}
              linkablePages={linkablePages}
              submitLabel="Button erstellen"
            />
            <p className="uwe-table-sub">
              Audio-Assets zuerst unter{" "}
              <Link href={`/worlds/${worldSlug}/assets`}>Assets</Link> hochladen.
              Spotify-Wiedergabe erfordert Premium, OAuth und ein aktives Spotify Connect-Gerät.
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
                          <SoundboardButtonForm
                            action={updateSoundboardButtonAction}
                            worldSlug={worldSlug}
                            buttonId={button.id}
                            initialValues={{
                              title: button.title,
                              sourceType: button.sourceType,
                              sourceUrl: button.sourceUrl ?? "",
                              assetId: button.assetId ?? "",
                              thumbnail: button.thumbnail ?? "",
                              volume: button.volume,
                              loop: button.loop,
                              tags: button.tags.join(", "),
                              visibility: button.visibility,
                              linkedPageIds: button.linkedPages.map((page) => page.id),
                            }}
                            audioAssets={audioAssets}
                            linkablePages={linkablePages}
                            extraLinkedPages={button.linkedPages.map((page) => ({
                              id: page.id,
                              title: page.title,
                              type: page.type,
                            }))}
                            submitLabel="Speichern"
                          />
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
