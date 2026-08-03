import Link from "next/link";
import { resolveCrossAppUrls } from "@uwe/auth";
import { prisma } from "@uwe/database/server";
import {
  createKnowledgeAssistantService,
  synthesizeKnowledgeAnswer,
  type ConfidenceLevel,
  type KnowledgeSynthesisResult,
} from "@uwe/database/knowledge-assistant";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/src/components/ui";

interface Props {
  searchParams: Promise<{ q?: string; synth?: string }>;
}

export const dynamic = "force-dynamic";

const CONFIDENCE_BADGE_VARIANT: Record<ConfidenceLevel, NonNullable<BadgeProps["variant"]>> = {
  high: "success",
  medium: "warning",
  low: "warning",
  none: "danger",
};

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "Gut belegt",
  medium: "Teilweise belegt",
  low: "Unsicher",
  none: "Unbekannt",
};

export default async function KnowledgePage({ searchParams }: Props) {
  await requireStudioAccess();
  // Life Brain und Capture leben in Brain (:3002) — Verweise dorthin gehen über
  // die Laufzeit-Origin, nicht über einen Studio-Pfad.
  const brainUrl = resolveCrossAppUrls().brain;
  const { q, synth } = await searchParams;
  const query = (q ?? "").trim();
  const answer = query ? await createKnowledgeAssistantService(prisma).ask(query) : null;
  const synthesis: KnowledgeSynthesisResult | null =
    answer && synth === "1" ? await synthesizeKnowledgeAnswer(prisma, answer) : null;

  return (
    <>
      <ShellBreadcrumb items={[{ label: "Wissensassistent" }]} />
      <PageHeader
        title="Wissensassistent"
        summary="DnD-Brain und lokaler Q&A-Assistent — Frage stellen, Antwort mit Quellen zurückbekommen."
      />

      {/*
        Hier stand eine dritte Karte „Life Brain" auf `/life-brain`. Diese Route
        gibt es in Studio nicht: Life Brain ist owner-privater Alltag und liegt
        in Brain (:3002). Der Link führte ins Leere — genau wie die
        Capture-Verweise weiter unten, die aus demselben Umzug übrig waren.
      */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link href="/brain" className="block no-underline">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardHeader>
              <CardTitle>DnD Brain</CardTitle>
              <CardDescription>Kampagnen-Wissen pro Welt</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Wissensassistent</CardTitle>
            <CardDescription>Frage &amp; Antwort mit Quellen (unten)</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form method="get" className="flex gap-2">
            <Input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Was möchtest du wissen?"
              className="flex-1"
            />
            <Button type="submit">Fragen</Button>
          </form>
        </CardContent>
      </Card>

      {answer ? (
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-2 pt-6">
              <Badge variant={CONFIDENCE_BADGE_VARIANT[answer.confidence]} className="w-fit">
                {CONFIDENCE_LABEL[answer.confidence]}
              </Badge>
              <p className="text-sm">{answer.note}</p>
            </CardContent>
          </Card>

          {answer.citations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>KI-Antwort (lokal, geerdet)</CardTitle>
              </CardHeader>
              <CardContent>
                {synthesis?.status === "ok" ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm">{synthesis.text}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Lokal formuliert (RTX), erdet auf den Quellen unten — die Quellen bleiben
                      maßgeblich.
                    </p>
                  </>
                ) : synthesis ? (
                  <p className="text-sm text-destructive" role="alert">
                    {synthesis.error}
                  </p>
                ) : (
                  <form method="get" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="q" value={query} />
                    <input type="hidden" name="synth" value="1" />
                    <Button type="submit" variant="secondary">
                      KI-Antwort formulieren (RTX-lokal)
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Quellen</CardTitle>
            </CardHeader>
            <CardContent>
              {/*
                Die Titel standen als Links auf `/life-brain/documents/<id>`
                bzw. `/life-brain/facts/<id>`. Beide Routen gibt es weder in
                Studio noch in Brain — Brain hat nur die Übersicht
                `/life-brain`. Der Titel steht deshalb als Text; der Weg zur
                Quelle führt über den Brain-Link unter der Liste.
              */}
              {answer.citations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine passenden Quellen im Life-Brain. Festhalten lässt sich das im Brain unter{" "}
                  <a href={`${brainUrl}/capture`}>Capture</a>.
                </p>
              ) : (
                <>
                  <ul className="flex flex-col gap-3">
                    {answer.citations.map((cite) => (
                      <li
                        key={`${cite.kind}-${cite.id}`}
                        className="border-b border-border/60 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{cite.title}</span>
                          <Badge>{cite.sourceType}</Badge>
                          {cite.ageNote ? (
                            <span className="text-sm text-muted-foreground">{cite.ageNote}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{cite.snippet}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Quellen bearbeiten: <a href={`${brainUrl}/life-brain`}>Life Brain in Brain</a>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Stell eine Frage — die Antwort kommt ausschließlich aus deinem lokalen Life-Brain.
        </p>
      )}
    </>
  );
}
