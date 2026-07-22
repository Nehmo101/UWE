import Link from "next/link";
import { notFound } from "next/navigation";
import {
import { brainPrisma } from "@uwe/database/brain-client";
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  prisma,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  deleteLifeBrainFactAction,
  updateLifeBrainFactTagsAction,
} from "../../../life-admin-actions";
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/src/components/ui";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LifeBrainFactDetailPage({ params }: Props) {
  const { id } = await params;
  const service = createLifeAdminService(brainPrisma, prisma);
  const detail = await service.getPersonalBrainFactDetail(id);

  if (!detail) {
    notFound();
  }

  const { fact, tags, linkedCaptures } = detail;

  const similarQuery = [fact.title, fact.content].filter(Boolean).join(" ").slice(0, 200);
  const similarFacts =
    similarQuery.length > 0
      ? (await service.searchPersonalBrain({ query: similarQuery, limit: 6 })).facts
          .map((hit) => hit.item)
          .filter((item) => item.id !== fact.id)
          .slice(0, 5)
      : [];

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Persönliches Brain", href: "/life-brain" },
            { label: fact.title },
          ]}
        />
      }
    >
      <PageHeader
        title={fact.title}
        summary="Life-Brain-Fakt bearbeiten"
        actions={
          <Link href="/life-brain" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Zurück zur Suche
          </Link>
        }
      />
      <Alert tone="warning" className="mb-6">
        Privates Brain wird nur lokal gespeichert und darf nicht an Cloud-KI gesendet werden.
      </Alert>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Typ: {fact.factType}
              {" · "}
              Tags: {tags.length > 0 ? tags.join(", ") : "—"}
              {" · "}
              Aktualisiert: {DATE_FORMAT.format(fact.updatedAt)}
              {" · "}
              Erstellt: {DATE_FORMAT.format(fact.createdAt)}
            </p>
            {fact.content && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">Inhalt</h3>
                <p className="whitespace-pre-wrap text-sm">{fact.content}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {linkedCaptures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Quellen &amp; Captures</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {linkedCaptures.map((capture) => (
                <div key={capture.id} className="rounded-[var(--radius)] border border-border p-3">
                  <p className="font-semibold text-foreground">{capture.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {CAPTURE_TYPE_LABELS[capture.captureType]} · {DATE_FORMAT.format(capture.capturedAt)}
                  </p>
                  {capture.content && <p className="text-sm">{capture.content}</p>}
                  {capture.url && (
                    <p className="text-sm">
                      <a href={capture.url} target="_blank" rel="noreferrer" className="underline">
                        {capture.url}
                      </a>
                    </p>
                  )}
                  <Link href="/capture" className="text-sm underline">
                    Capture-Inbox
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {similarFacts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ähnliche Fakten</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {similarFacts.map((similar) => (
                  <li key={similar.id}>
                    <Link href={`/life-brain/facts/${similar.id}`} className="font-medium">
                      {similar.title}
                    </Link>
                    {similar.content ? (
                      <p className="mt-1 text-muted-foreground">
                        {similar.content.slice(0, 160)}
                        {similar.content.length > 160 ? "…" : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Tags bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateLifeBrainFactTagsAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={fact.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fact-tags">Tags (kommagetrennt)</Label>
                <Input id="fact-tags" name="tags" defaultValue={tags.join(", ")} placeholder="regel, hausregel" />
              </div>
              <div>
                <Button type="submit" size="sm">
                  Tags speichern
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fakt löschen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={deleteLifeBrainFactAction}>
              <input type="hidden" name="id" value={fact.id} />
              <Button type="submit" variant="secondary" size="sm">
                Fakt löschen
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </StudioShell>
  );
}
