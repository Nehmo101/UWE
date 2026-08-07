import Link from "next/link";
import { notFound } from "next/navigation";
import { isDm } from "@uwe/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { createOwnCharacterAction } from "@/app/character-actions";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { PageHeader } from "@/src/components/shell";
import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/components/ui/cn";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export default async function PortalCharactersPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let characters;
  try {
    characters = await auth.listCharactersForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  const staffView = isDm(ctx);
  // Dieselbe Regel wie beim Kartenbau: die Welt-Zuordnung entscheidet,
  // Vorschau-Sitzungen sind draußen.
  const canCreate = Boolean(ctx.user) && !ctx.previewAsUserId && ctx.worldMembership !== null;

  return (
    <>
      <PageHeader
        title={staffView ? "Charaktere" : "Meine Charaktere"}
        summary="Strukturierte Charakterbögen in dieser Welt — mit automatisch berechneten Modifikatoren und Initiative."
      />

      {canCreate ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Neuer Charakter</CardTitle>
            <CardDescription>
              Beides legt Wiki-Seite und Charakterbogen an — beides gehört dir. In welcher
              Kampagne er mitspielt, entscheidet der Spielleiter.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/*
                Kein `asChild` an `Button` — die Portal-Kopie kennt es nicht.
                Der etablierte Weg für Links ist `buttonVariants` auf dem `<a>`;
                die Klasse `uwe-button-surface` darin nimmt den Link aus der
                globalen Link-Farbe heraus.
              */}
              <Link
                href={`/auth/worlds/${worldSlug}/characters/neu`}
                className={cn(buttonVariants())}
              >
                Charakter erstellen
              </Link>
              <span className="text-sm text-muted-foreground">
                Volk, Klasse, Hintergrund und Werte in neun Schritten — mit
                Regelhilfe und laufender Vorschau.
              </span>
            </div>

            {/*
              Der alte Ein-Feld-Weg bleibt: Wer seine Werte schon auf Papier hat
              oder den Bogen von Hand füllen will, soll nicht durch neun Schritte
              müssen. Er heißt jetzt nur nicht mehr „Charakter erstellen".
            */}
            <details className="border-t border-border pt-3">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Nur den Namen anlegen und selbst ausfüllen
              </summary>
              <form
                action={createOwnCharacterAction}
                className="mt-3 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <div className="grid min-w-56 flex-1 gap-1.5">
                  <Label htmlFor="new-character-name">Name</Label>
                  <Input
                    id="new-character-name"
                    name="displayName"
                    placeholder="z. B. Thrag, Sohn des Berges"
                    required
                  />
                </div>
                <Button type="submit" variant="outline">
                  Leeren Bogen anlegen
                </Button>
              </form>
            </details>
          </CardContent>
        </Card>
      ) : null}

      <ul className="grid gap-2">
        {[...characters]
          .sort(
            (left, right) =>
              Number(right.ownerUserId === ctx.user?.id) -
              Number(left.ownerUserId === ctx.user?.id),
          )
          .map((character) => {
            const isOwnCharacter = character.ownerUserId === ctx.user?.id;
          const stats = (
            <span className="mt-1 block text-sm text-muted-foreground">
              Stufe {character.sheet.level} · RK {character.sheet.armorClass ?? "—"} · Init{" "}
              {formatModifier(character.sheet.initiative)} · Passive Wahrnehmung{" "}
              {character.sheet.derived.passivePerception}
            </span>
          );

          const content = (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{character.displayName}</strong>
                {isOwnCharacter ? <Badge variant="accent">Dein Charakter</Badge> : null}
                {!character.pageSlug ? <Badge variant="warning">Seite fehlt</Badge> : null}
              </div>
              {stats}
            </>
          );

          return (
            <li key={character.id}>
              {character.pageSlug ? (
                <Link
                  href={`/auth/worlds/${worldSlug}/${character.pageSlug}`}
                  className={cn(
                    "block rounded-[var(--radius)] border border-border p-4 transition-colors hover:bg-muted/50",
                    isOwnCharacter && "border-primary/40 bg-primary/5",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div
                  className={cn(
                    "rounded-[var(--radius)] border border-border p-4",
                    isOwnCharacter && "border-primary/40 bg-primary/5",
                  )}
                >
                  {content}
                  <p className="mt-2 text-sm text-muted-foreground">
                    Der Bogen ist nicht mit einer Charakterseite verknüpft.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {characters.length === 0 ? (
        <PortalEmptyState
          title={staffView ? "Noch keine Charakterbögen angelegt" : "Noch kein Charakter"}
          description={
            staffView
              ? "Als Owner/DM siehst du hier alle Charakterbögen der Welt. Die Spieler legen sie selbst im Portal an; du weist sie im Kampagnen-Cockpit einer Kampagne zu."
              : canCreate
                ? "Leg oben deinen ersten Charakter an — der Bogen gehört dir."
                : undefined
          }
          icon="user"
        />
      ) : null}
    </>
  );
}
