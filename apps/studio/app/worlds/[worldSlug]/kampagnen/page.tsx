import Link from "next/link";
import { notFound } from "next/navigation";
import { createCampaignService } from "@uwe/database/campaign";
import { getAppRepository, prisma } from "@uwe/database/server";
import { createCampaignCockpitService } from "@uwe/campaign-cockpit";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { worldWikiPath } from "@/src/lib/world-last-route";
import { requireStudioWorldRead } from "@/src/lib/authz";
import {
  createCampaignAction,
  deleteCampaignAction,
  renameCampaignAction,
} from "../../../campaign-actions";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Textarea,
  buttonVariants,
} from "@/src/components/ui";

/**
 * Kampagnen-Wurzel: Liste, Verwaltung und Einstieg ins Kampagnen-Cockpit.
 * Zieht die frühere /campaigns-Verwaltung hierher (dort bleibt ein Redirect) —
 * eine Wahrheit darüber, was eine Kampagne ist, exakt wie /dungeons für Dungeons.
 */

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ created?: string; saved?: string; deleted?: string; error?: string }>;
}

const FIELD_CLASS = "flex flex-col gap-1.5";

export default async function WorldKampagnenPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { created, saved, deleted, error } = await searchParams;

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();
  await requireStudioWorldRead(worldSlug);

  const [campaigns, summaries] = await Promise.all([
    createCampaignService(prisma).listOverview(worldSlug),
    createCampaignCockpitService(prisma).listCampaignSummaries(worldSlug),
  ]);
  const basePath = `/worlds/${worldSlug}/kampagnen`;

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(world.name, worldSlug, "Kampagnen", basePath)}
      />
      <ShellContextPanel>
        {/*
          Ohne `active`-Marken: von hier führt jeder Eintrag ins Wiki, keiner
          beschreibt den Zustand *dieser* Seite.
        */}
        <CampaignSidebar
          title="Im Wiki filtern"
          items={campaigns.map((campaign) => ({
            label: campaign.name,
            href: `${worldWikiPath(worldSlug)}?campaign=${campaign.slug}`,
          }))}
        />
      </ShellContextPanel>
      <PageHeader
        title="Kampagnen"
        summary={`Kampagnen von „${world.name}" — jedes Cockpit bündelt Story-Bögen, Quests, Fraktionen, Sessions und Chronik. Anlegen, umbenennen und löschen weiterhin hier.`}
      />

      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}
      {created === "1" ? (
        <Alert tone="success" className="mb-4">
          Kampagne angelegt.
        </Alert>
      ) : null}
      {saved === "1" ? (
        <Alert tone="success" className="mb-4">
          Kampagne gespeichert.
        </Alert>
      ) : null}
      {deleted === "1" ? (
        <Alert tone="success" className="mb-4">
          Kampagne gelöscht. Seiten, Sessions und Medien sind erhalten geblieben — sie gehören
          jetzt zur Welt statt zu einer Kampagne.
        </Alert>
      ) : null}

      {campaigns.length === 0 ? (
        <EmptyState
          title="Noch keine Kampagne"
          description="Ohne Kampagne gehört alles direkt zur Welt. Das ist in Ordnung — eine Kampagne lohnt sich, sobald du zwei Erzählstränge getrennt halten willst."
        />
      ) : (
        <div className="mb-6 flex flex-col gap-4">
          {campaigns.map((campaign) => {
            const summary = summaries.get(campaign.id);
            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>
                      <Link href={`${basePath}/${campaign.slug}`}>{campaign.name}</Link>
                    </CardTitle>
                    <Link
                      href={`${basePath}/${campaign.slug}`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Cockpit öffnen →
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {summary?.progress.label ? `${summary.progress.label} · ` : ""}
                    {summary?.openQuests ?? 0} offene Quests
                    {summary?.lastSession
                      ? ` · zuletzt Session ${summary.lastSession.sessionNumber}: ${summary.lastSession.title}`
                      : " · noch keine gespielte Session"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <code>{campaign.slug}</code> · {campaign.counts.pages} Seiten ·{" "}
                    {campaign.counts.gameSessions} Sessions · {campaign.counts.assets} Medien ·{" "}
                    {campaign.counts.characters} Charaktere · {campaign.counts.playerNotes}{" "}
                    Spielernotizen
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <details className="rounded-md border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Umbenennen &amp; Beschreibung
                    </summary>
                    <form action={renameCampaignAction} className="mt-3 flex flex-col gap-3">
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <div className={FIELD_CLASS}>
                        <Label htmlFor={`campaign-name-${campaign.id}`}>Name</Label>
                        <Input
                          id={`campaign-name-${campaign.id}`}
                          name="name"
                          required
                          maxLength={120}
                          defaultValue={campaign.name}
                        />
                      </div>
                      <div className={FIELD_CLASS}>
                        <Label htmlFor={`campaign-description-${campaign.id}`}>Beschreibung</Label>
                        <Textarea
                          id={`campaign-description-${campaign.id}`}
                          name="description"
                          rows={2}
                          defaultValue={campaign.description ?? ""}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit">Speichern</Button>
                        <Link
                          href={`${worldWikiPath(worldSlug)}?campaign=${campaign.slug}`}
                          className="text-sm"
                        >
                          Seiten dieser Kampagne
                        </Link>
                      </div>
                    </form>
                  </details>

                  <details className="rounded-md border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Kampagne löschen
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      {campaign.counts.playerNotes > 0 ? (
                        <Alert tone="warning">
                          {campaign.counts.playerNotes} Spielernotiz(en) hängen fest an dieser
                          Kampagne und werden <strong>mitgelöscht</strong>. Lege vorher ein Backup
                          an, wenn du sie behalten willst.
                        </Alert>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Zugeordnete Inhalte (Seiten, Sessions, Medien, Charaktere) bleiben
                          erhalten und gehören danach direkt zur Welt.
                        </p>
                      )}
                      <form action={deleteCampaignAction} className="flex flex-col gap-3">
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="campaignId" value={campaign.id} />
                        <div className={FIELD_CLASS}>
                          <Label htmlFor={`campaign-confirm-${campaign.id}`}>
                            Zum Bestätigen den Namen eintragen
                          </Label>
                          <Input
                            id={`campaign-confirm-${campaign.id}`}
                            name="expectedName"
                            required
                            autoComplete="off"
                            placeholder={campaign.name}
                          />
                        </div>
                        <Button type="submit" variant="destructive" className="self-start">
                          Endgültig löschen
                        </Button>
                      </form>
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Neue Kampagne</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCampaignAction} className="flex flex-col gap-4">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <div className={FIELD_CLASS}>
              <Label htmlFor="new-campaign-name">Name</Label>
              <Input
                id="new-campaign-name"
                name="name"
                required
                maxLength={120}
                placeholder="z. B. Schatten über Validori"
              />
            </div>
            <div className={FIELD_CLASS}>
              <Label htmlFor="new-campaign-description">Beschreibung (optional)</Label>
              <Textarea id="new-campaign-description" name="description" rows={2} />
            </div>
            <Button type="submit" className="self-start">
              Kampagne anlegen
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
