import Link from "next/link";
import { prisma } from "@uwe/database/server";
import {
  createKnowledgeAssistantService,
  synthesizeKnowledgeAnswer,
  type ConfidenceLevel,
  type KnowledgeSynthesisResult,
} from "@uwe/database/knowledge-assistant";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
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
  const { q, synth } = await searchParams;
  const query = (q ?? "").trim();
  const answer = query ? await createKnowledgeAssistantService(prisma).ask(query) : null;
  const synthesis: KnowledgeSynthesisResult | null =
    answer && synth === "1" ? await synthesizeKnowledgeAnswer(prisma, answer) : null;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Wissensassistent" }]} />}>
      <PageHeader
        title="Wissensassistent"
        summary="Life Brain, DnD-Brain und lokaler Q&A-Assistent — drei Einstiege, ein Knowledge-Bereich."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link href="/life-brain" className="block no-underline">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardHeader>
              <CardTitle>Life Brain</CardTitle>
              <CardDescription>Persönliche Dokumente &amp; Fakten (RTX-only)</CardDescription>
            </CardHeader>
          </Card>
        </Link>
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
              {answer.citations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine passenden Quellen im Life-Brain. Vielleicht als{" "}
                  <Link href="/capture">Capture</Link> festhalten?
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {answer.citations.map((cite) => {
                    const href =
                      cite.kind === "document"
                        ? `/life-brain/documents/${cite.id}`
                        : `/life-brain/facts/${cite.id}`;
                    return (
                      <li
                        key={`${cite.kind}-${cite.id}`}
                        className="border-b border-border/60 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={href} className="font-medium">
                            {cite.title}
                          </Link>
                          <Badge>{cite.sourceType}</Badge>
                          {cite.ageNote ? (
                            <span className="text-sm text-muted-foreground">{cite.ageNote}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{cite.snippet}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Stell eine Frage — die Antwort kommt ausschließlich aus deinem lokalen Life-Brain.
        </p>
      )}
    </StudioShell>
  );
}
