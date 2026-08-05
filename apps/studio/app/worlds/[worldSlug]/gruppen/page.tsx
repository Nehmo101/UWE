import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createPlayerGroupService } from "@uwe/player-hub";
import {
  createPlayerGroupAction,
  deletePlayerGroupAction,
  updatePlayerGroupAction,
} from "@/app/worlds/[worldSlug]/gruppen-actions";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    angelegt?: string;
    gespeichert?: string;
    geloescht?: string;
  }>;
}

/**
 * Spielergruppen einer Welt.
 *
 * Die Seite ist bewusst nüchtern: eine Gruppe ist ein Name, eine Handvoll
 * Konten und höchstens eine Kampagne. Alles, was daran hängt — Gruppenschatz
 * und Questlog — entsteht im Portal, sobald die Runde existiert.
 */
export default async function WorldPlayerGroupsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { angelegt, gespeichert, geloescht } = await searchParams;

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);

  const db = createPrismaClient();
  let groups;
  let members;
  try {
    groups = await createPlayerGroupService(db).listForWorld(world.id);
    // Alle der Welt zugeordneten Konten — auch die mit Studio-Häkchen, denn
    // ein Spielleiter, der mitspielt, gehört genauso an einen Tisch.
    members = await db.worldMembership.findMany({
      where: { worldId: world.id },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: [{ user: { displayName: "asc" } }],
    });
  } finally {
    await db.$disconnect();
  }

  const assignedUserIds = new Set(groups.flatMap((group) => group.members.map((m) => m.userId)));
  const unassigned = members.filter((membership) => !assignedUserIds.has(membership.userId));
  const base = `/worlds/${worldSlug}`;

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(world.name, worldSlug, "Spielergruppen", `${base}/gruppen`)}
      />
      <ShellContextPanel>
        <SidebarSection title="Wozu Gruppen?">
          <p className="text-sm text-muted-foreground">
            Die Gruppe ist kein Recht und kein Häkchen. Wer der Welt zugeordnet ist, liest sie
            weiterhin ganz. Die Gruppe entscheidet nur zwei Dinge: wem ein Gruppenschatz gehört
            und welche Quests im Questlog der Spieler auftauchen.
          </p>
        </SidebarSection>
        <SidebarSection title="Ohne Gruppe">
          <p className="text-sm text-muted-foreground">
            Spieler ohne Gruppe sehen im Portal ein leeres Questlog und keinen Gruppenschatz.
            Quests ordnest du im{" "}
            <Link className="underline" href={`${base}/radar`}>
              Kampagnen-Radar
            </Link>{" "}
            zu.
          </p>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Spielergruppen"
        summary="Tischrunden dieser Welt — wer sitzt zusammen, wer teilt sich Schatz und Questlog."
      />

      {angelegt ? (
        <Alert tone="success" className="mb-4">
          Gruppe angelegt.
        </Alert>
      ) : null}
      {gespeichert ? (
        <Alert tone="success" className="mb-4">
          Gruppe gespeichert.
        </Alert>
      ) : null}
      {geloescht ? (
        <Alert tone="success" className="mb-4">
          Gruppe gelöscht. Ihre Quests sind wieder ohne Zuordnung.
        </Alert>
      ) : null}

      {members.length === 0 ? (
        <EmptyState
          title="Dieser Welt ist noch niemand zugeordnet"
          description="Ordne im Command Center zuerst Konten dieser Welt zu — danach lassen sich Gruppen bilden."
        />
      ) : null}

      <div className="grid gap-4">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {group.name}
                <Badge variant="secondary">
                  {group.members.length} {group.members.length === 1 ? "Mitglied" : "Mitglieder"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updatePlayerGroupAction} className="grid gap-4">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="groupId" value={group.id} />

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label htmlFor={`name-${group.id}`}>Name</Label>
                    <Input id={`name-${group.id}`} name="name" defaultValue={group.name} required />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`campaign-${group.id}`}>Kampagne (optional)</Label>
                    <select
                      id={`campaign-${group.id}`}
                      name="campaignId"
                      defaultValue={group.campaignId ?? ""}
                      className="flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="">— keine —</option>
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-1">
                  <Label htmlFor={`description-${group.id}`}>Notiz</Label>
                  <Textarea
                    id={`description-${group.id}`}
                    name="description"
                    rows={2}
                    defaultValue={group.description ?? ""}
                  />
                </div>

                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Mitglieder</legend>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {members.map((membership) => (
                      <label
                        key={membership.userId}
                        className="flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="memberUserId"
                          value={membership.userId}
                          defaultChecked={group.members.some((m) => m.userId === membership.userId)}
                        />
                        <span>
                          {membership.user.displayName}
                          {membership.characterName ? (
                            <span className="text-muted-foreground"> · {membership.characterName}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Speichern</Button>
                </div>
              </form>

              <form action={deletePlayerGroupAction} className="mt-3">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="groupId" value={group.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Gruppe löschen
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      {groups.length === 0 && members.length > 0 ? (
        <EmptyState
          title="Noch keine Gruppe"
          description="Lege unten die erste Tischrunde an. Ohne Gruppe bleibt das Questlog im Portal leer."
        />
      ) : null}

      {unassigned.length > 0 ? (
        <Alert tone="warning" className="mt-4">
          Ohne Gruppe: {unassigned.map((membership) => membership.user.displayName).join(", ")}.
          Diese Konten sehen im Portal kein Questlog und keinen Gruppenschatz.
        </Alert>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Neue Gruppe</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createPlayerGroupAction} className="grid gap-4">
            <input type="hidden" name="worldSlug" value={worldSlug} />

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor="new-group-name">Name</Label>
                <Input id="new-group-name" name="name" placeholder="Die Sonntagsrunde" required />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="new-group-campaign">Kampagne (optional)</Label>
                <select
                  id="new-group-campaign"
                  name="campaignId"
                  defaultValue=""
                  className="flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">— keine —</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="new-group-description">Notiz</Label>
              <Textarea id="new-group-description" name="description" rows={2} />
            </div>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Mitglieder</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {members.map((membership) => (
                  <label
                    key={membership.userId}
                    className="flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm"
                  >
                    <input type="checkbox" name="memberUserId" value={membership.userId} />
                    <span>
                      {membership.user.displayName}
                      {membership.characterName ? (
                        <span className="text-muted-foreground"> · {membership.characterName}</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <Button type="submit" disabled={members.length === 0}>
                Gruppe anlegen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
