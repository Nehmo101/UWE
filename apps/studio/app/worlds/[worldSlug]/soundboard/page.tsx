import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import { CONNECTOR_OFFLINE_MESSAGE } from "@uwe/connector";
import {
  createAuthService,
  createConnectorService,
  createPrismaClient,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import {
  createSoundboardButtonAction,
  deleteSoundboardButtonAction,
  updateSoundboardButtonAction,
} from "@/app/soundboard-actions";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { SoundboardButtonForm } from "./SoundboardButtonForm";
import { SpotifyConnectionPanel } from "./SpotifyConnectionPanel";
import { SoundboardWorkspace, type SoundboardButtonView } from "./SoundboardWorkspace";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

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
  const {
    campaign: campaignSlug,
    created,
    saved,
    deleted,
    linked,
    error,
    spotifyConnected,
    spotifyError,
  } = await searchParams;
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

  const connectorSummary = await createConnectorService(prisma).summarize();
  const engineAudioOnline = connectorSummary.availableCapabilities.includes("audio_local");

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
    linkedPages: button.linkedPages.map((page) => ({ title: page.title })),
  }));

  return (
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "Soundboard", `/worlds/${worldSlug}/soundboard`)} />
      <ShellContextPanel>
        <CampaignSidebar
          items={campaignNavItems(`/worlds/${worldSlug}/soundboard`, campaigns, campaignSlug)}
          manageHref={`/worlds/${worldSlug}/kampagnen`}
        />
        <SidebarSection title="Kontext">
          <p className="text-sm text-muted-foreground">
            {buttons.length} Buttons
            {selectedCampaign ? ` in „${selectedCampaign.name}“` : ""}
          </p>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Soundboard"
        summary={
          selectedCampaign
            ? `Ambient, Musik und Effekte für „${selectedCampaign.name}“ — in der Live-Session dieser Kampagne verfügbar.`
            : "Ambient, Musik und Effekte pro Welt/Kampagne — lokale Dateien, YouTube und Spotify (Web API)."
        }
      />

      <div className="flex flex-col gap-6">
        {(created || saved || deleted || linked) && (
          <Alert tone="success">
            {created
              ? "Sound angelegt."
              : deleted
                ? "Sound gelöscht."
                : "Änderungen gespeichert."}
          </Alert>
        )}

        {spotifyConnected && <Alert tone="success">Spotify erfolgreich verbunden.</Alert>}

        {(error || spotifyError) && (
          <Alert tone="danger" role="alert">
            {error ?? spotifyError}
          </Alert>
        )}

        {buttons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Buttons verwalten</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {buttons.map((button) => (
                  <li
                    key={button.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-2 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    <strong>{button.title}</strong>
                    <span className="text-sm text-muted-foreground">{button.sourceType}</span>
                    <details>
                      <summary>Löschen</summary>
                      <form action={deleteSoundboardButtonAction}>
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="buttonId" value={button.id} />
                        <Button type="submit" variant="destructive" size="sm" className="mt-2">
                          Endgültig löschen
                        </Button>
                      </form>
                    </details>
                    <details className="basis-full">
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
                    </details>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <details open={buttons.length === 0}>
              <summary>+ Neuer Sound</summary>
              <SoundboardButtonForm
                action={createSoundboardButtonAction}
                worldSlug={worldSlug}
                campaignSlug={campaignSlug}
                audioAssets={audioAssets}
                linkablePages={linkablePages}
                submitLabel="Button erstellen"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Audio-Assets zuerst unter{" "}
                <Link href={`/worlds/${worldSlug}/assets`}>Assets</Link> hochladen.
                Spotify-Wiedergabe erfordert Premium, OAuth und ein aktives Spotify Connect-Gerät.
              </p>
            </details>
          </CardContent>
        </Card>

        <SoundboardWorkspace buttons={buttonViews} worldSlug={worldSlug} />

        <SpotifyConnectionPanel worldSlug={worldSlug} />

        <Card>
          <CardHeader>
            <CardTitle>Maschinenraum-Audioausgabe</CardTitle>
          </CardHeader>
          <CardContent>
            {engineAudioOnline ? (
              <Alert tone="success">
                Maschinenraum online — Sounds können dort lokal ausgegeben werden.
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                {CONNECTOR_OFFLINE_MESSAGE} Soundboard-UI und Browser-Wiedergabe bleiben verfügbar.{" "}
                <span>Maschinenraum in der Kommandozentrale einrichten</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
