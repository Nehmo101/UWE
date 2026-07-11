import Link from "next/link";
import {
  createLifeAdminService,
  parseStringArray,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  prisma,
} from "@uwe/database/server";
import { LifeBrainIndexPanel } from "@/components/life-brain/LifeBrainIndexPanel";
import { LifeBrainSearchPanel } from "@/components/life-brain/LifeBrainSearchPanel";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  createLifeBrainDocumentAction,
  createLifeBrainFactAction,
} from "../life-admin-actions";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

function truncateContent(text: string, maxLength = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export default async function LifeBrainPage() {
  const service = createLifeAdminService(prisma);
  const [documents, facts] = await Promise.all([
    service.listPersonalBrainDocuments({ limit: 100 }),
    service.listPersonalBrainFacts({ limit: 100 }),
  ]);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Persönliches Brain" }]} />}>
      <PageHeader
        title="Persönliches Brain"
        summary="Life-Wissen lokal in UWE — niemals an Cloud-KI. Getrennt vom DnD Brain."
        meta={<Badge variant="secondary">RTX-only · Kein Cloud-Fallback</Badge>}
        actions={
          <Link href="/life-brain/chat" className={buttonVariants({ variant: "secondary" })}>
            Life-Brain Chat →
          </Link>
        }
      />
      <Alert tone="warning" className="mb-6">
        Privates Brain wird nur lokal gespeichert und darf nicht an Cloud-KI gesendet werden.
      </Alert>

      <div className="flex flex-col gap-6">
        <LifeBrainIndexPanel />
        <LifeBrainSearchPanel />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Neues Dokument</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createLifeBrainDocumentAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="doc-title">Titel</Label>
                  <Input id="doc-title" name="title" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="doc-category">Kategorie</Label>
                  <Select name="category" defaultValue="personal_notes">
                    <SelectTrigger id="doc-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONAL_BRAIN_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {PERSONAL_BRAIN_CATEGORY_LABELS[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="doc-content">Inhalt</Label>
                  <Textarea id="doc-content" name="content" rows={5} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="doc-tags">Tags (kommagetrennt)</Label>
                  <Input id="doc-tags" name="tags" placeholder="homelab, netzwerk" />
                </div>
                <div>
                  <Button type="submit">Dokument speichern</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Neuer Fakt</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createLifeBrainFactAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fact-title">Titel</Label>
                  <Input id="fact-title" name="title" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fact-type">Typ</Label>
                  <Input id="fact-type" name="factType" defaultValue="custom" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fact-content">Inhalt</Label>
                  <Textarea id="fact-content" name="content" rows={3} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fact-tags">Tags (kommagetrennt)</Label>
                  <Input id="fact-tags" name="tags" placeholder="material, 3d-print" />
                </div>
                <div>
                  <Button type="submit" variant="secondary">
                    Fakt speichern
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {documents.length === 0 && facts.length === 0 ? (
          <EmptyState
            title="Noch keine Life-Brain-Einträge"
            description="Speichere persönliches Wissen lokal — getrennt vom DnD Brain. Starte mit einem Dokument oben, erfasse per Capture oder nutze den Life-Brain Chat."
            action={
              <span className="text-sm">
                <Link href="/capture" className="underline">
                  Capture öffnen
                </Link>
                {" · "}
                <Link href="/life-brain/chat" className="underline">
                  Life-Brain Chat
                </Link>
              </span>
            }
          />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Dokumente ({documents.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="rounded-[var(--radius)] border border-border p-3">
                    <h3 className="font-semibold">
                      <Link href={`/life-brain/documents/${doc.id}`}>{doc.title}</Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {doc.category ? (PERSONAL_BRAIN_CATEGORY_LABELS[doc.category] ?? doc.category) : "Allgemein"}
                      {parseStringArray(doc.tags).length > 0 &&
                        ` · ${parseStringArray(doc.tags).join(", ")}`}
                    </p>
                    {doc.content && <p className="mt-1 text-sm">{truncateContent(doc.content)}</p>}
                    <p className="mt-1">
                      <Link href={`/life-brain/documents/${doc.id}`} className="text-sm underline">
                        Details →
                      </Link>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fakten ({facts.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {facts.map((fact) => (
                  <div key={fact.id} className="rounded-[var(--radius)] border border-border p-3">
                    <h3 className="font-semibold">
                      <Link href={`/life-brain/facts/${fact.id}`}>{fact.title}</Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {fact.factType}
                      {parseStringArray(fact.tags).length > 0 &&
                        ` · ${parseStringArray(fact.tags).join(", ")}`}
                    </p>
                    {fact.content && <p className="mt-1 text-sm">{truncateContent(fact.content)}</p>}
                    <p className="mt-1">
                      <Link href={`/life-brain/facts/${fact.id}`} className="text-sm underline">
                        Details →
                      </Link>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </StudioShell>
  );
}
