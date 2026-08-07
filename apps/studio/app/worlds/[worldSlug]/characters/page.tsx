import Link from "next/link";
import { notFound } from "next/navigation";

import {
  buildPageUrl,
  createCharacterService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { SidebarSection } from "@uwe/shared-ui";

import {
  createAssignedCharacterAction,
  updateCharacterAssignmentAction,
} from "../character-management-actions";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
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
} from "@/src/components/ui";
import { requireStudioWorldRead } from "@/src/lib/authz";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ angelegt?: string; zugewiesen?: string }>;
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default async function WorldCharactersPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { angelegt, zugewiesen } = await searchParams;
  try {
    await requireStudioWorldRead(worldSlug);
  } catch {
    notFound();
  }

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const db = createPrismaClient();
  let characters;
  let memberships;
  try {
    [characters, memberships] = await Promise.all([
      createCharacterService(db).listForWorld(world.id),
      db.worldMembership.findMany({
        where: { worldId: world.id, user: { status: "active" } },
        include: {
          user: {
            select: { id: true, displayName: true, email: true, portalAccess: true },
          },
        },
        orderBy: [{ user: { displayName: "asc" } }],
      }),
    ]);
  } finally {
    await db.$disconnect();
  }

  const base = `/worlds/${worldSlug}`;
  const firstOwner = memberships[0]?.user.id;

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(world.name, worldSlug, "Charaktere", `${base}/characters`)}
      />
      <ShellContextPanel>
        <SidebarSection title="Besitz und Sichtbarkeit">
          <p className="text-sm text-muted-foreground">
            Ein Charakter gehört genau einem Weltmitglied. Dieses Konto sieht und pflegt den Bogen
            im Portal. Die Kampagne steuert, in welchem Kampagnen-Cockpit der Charakter erscheint.
          </p>
        </SidebarSection>
        <SidebarSection title="Spieler fehlen?">
          <p className="text-sm text-muted-foreground">
            Konten werden zuerst der Welt zugeordnet. Tischrunden verwaltest du unter{" "}
            <Link className="underline" href={`${base}/gruppen`}>
              Spielergruppen
            </Link>
            .
          </p>
        </SidebarSection>
      </ShellContextPanel>

      <PageHeader
        title="Charaktere"
        summary="Spielercharaktere anlegen, Konten zuweisen und in Kampagnen einsortieren."
        actions={
          <Link href={`${base}/characters/print`} className="text-sm underline">
            Charakterbögen drucken
          </Link>
        }
      />

      {angelegt ? <Alert tone="success" className="mb-4">Charakter angelegt und zugewiesen.</Alert> : null}
      {zugewiesen ? <Alert tone="success" className="mb-4">Zuordnung gespeichert.</Alert> : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Charakter für einen Spieler anlegen</CardTitle>
        </CardHeader>
        <CardContent>
          {!firstOwner ? (
            <EmptyState
              title="Keine Weltmitglieder"
              description="Ordne zuerst mindestens ein Konto dieser Welt zu."
            />
          ) : (
            <form action={createAssignedCharacterAction} className="grid gap-4 md:grid-cols-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <div className="space-y-2">
                <Label htmlFor="character-name">Charaktername</Label>
                <Input id="character-name" name="displayName" maxLength={120} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="character-owner">Spieler</Label>
                <select
                  id="character-owner"
                  name="ownerUserId"
                  defaultValue={firstOwner}
                  className={SELECT_CLASS}
                  required
                >
                  {memberships.map(({ user }) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName}{user.email ? ` · ${user.email}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="character-campaign">Kampagne</Label>
                <select id="character-campaign" name="campaignId" className={SELECT_CLASS}>
                  <option value="">Noch keine Kampagne</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit">Charakter anlegen</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vorhandene Charaktere ({characters.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {characters.length === 0 ? (
            <EmptyState title="Noch keine Charaktere" description="Lege oben den ersten Bogen an." />
          ) : (
            <ul className="divide-y divide-border">
              {characters.map((character) => (
                <li key={character.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <strong>{character.displayName}</strong>
                    <Badge variant="secondary">Stufe {character.level}</Badge>
                    {character.page ? (
                      <Link
                        className="text-sm underline"
                        href={buildPageUrl(worldSlug, character.page.type, character.page.slug)}
                      >
                        Bogen öffnen
                      </Link>
                    ) : (
                      <Badge variant="warning">Wiki-Seite fehlt</Badge>
                    )}
                  </div>
                  <form action={updateCharacterAssignmentAction} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="characterId" value={character.id} />
                    <div className="space-y-1">
                      <Label htmlFor={`owner-${character.id}`}>Spieler</Label>
                      <select
                        id={`owner-${character.id}`}
                        name="ownerUserId"
                        defaultValue={character.ownerUserId}
                        className={SELECT_CLASS}
                        required
                      >
                        {memberships.map(({ user }) => (
                          <option key={user.id} value={user.id}>{user.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`campaign-${character.id}`}>Kampagne</Label>
                      <select
                        id={`campaign-${character.id}`}
                        name="campaignId"
                        defaultValue={character.campaignId ?? ""}
                        className={SELECT_CLASS}
                      >
                        <option value="">Keine Kampagne</option>
                        {campaigns.map((campaign) => (
                          <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" variant="secondary">Zuordnung speichern</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
