import Link from "next/link";
import { prisma } from "@uwe/database/server";
import {
  createPromptLibraryService,
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
  type PromptTemplateCategory,
} from "@uwe/database/prompt-library";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { createPromptAction } from "@/app/prompt-actions";
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

interface Props {
  searchParams: Promise<{ category?: string; q?: string; tag?: string }>;
}

export const dynamic = "force-dynamic";

function isCategory(value: string | undefined): value is PromptTemplateCategory {
  return !!value && (PROMPT_CATEGORIES as string[]).includes(value);
}

export default async function PromptsPage({ searchParams }: Props) {
  await requireStudioAccess();
  const { category, q, tag } = await searchParams;
  const filter = isCategory(category) ? category : undefined;
  const search = q?.trim() || undefined;
  const tagFilter = tag?.trim() || undefined;

  const prompts = await createPromptLibraryService(prisma).list({
    category: filter,
    search,
    tag: tagFilter,
  });

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Prompt-Bibliothek" }]} />}>
      <PageHeader
        title="Prompt-Bibliothek"
        summary="Prompts als eigene Objekte mit Kategorie, Tags und Variablen — durchsuchbar, ausfüllbar und kopierbar."
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompts-search">Suche</Label>
          <Input
            id="prompts-search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Titel, Beschreibung, Body…"
            className="min-w-[14rem]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompts-tag">Tag</Label>
          <Input id="prompts-tag" name="tag" defaultValue={tagFilter ?? ""} placeholder="z. B. refactor" />
        </div>
        {filter ? <input type="hidden" name="category" value={filter} /> : null}
        <div className="flex gap-2">
          <Button type="submit">Filtern</Button>
          {(search || tagFilter || filter) && (
            <Link href="/prompts" className={buttonVariants({ variant: "outline" })}>
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Kategorie">
        <Link
          href="/prompts"
          aria-current={!filter ? "page" : undefined}
          className={buttonVariants({ variant: !filter ? "default" : "secondary", size: "sm" })}
        >
          Alle
        </Link>
        {PROMPT_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/prompts?category=${cat}${search ? `&q=${encodeURIComponent(search)}` : ""}${tagFilter ? `&tag=${encodeURIComponent(tagFilter)}` : ""}`}
            aria-current={filter === cat ? "page" : undefined}
            className={buttonVariants({ variant: filter === cat ? "default" : "secondary", size: "sm" })}
          >
            {PROMPT_CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </nav>

      {prompts.length === 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">Keine Prompts für diesen Filter.</p>
      ) : (
        <ul className="mb-6 flex flex-col gap-2">
          {prompts.map((prompt) => (
            <li key={prompt.id}>
              <Card>
                <CardContent className="flex flex-col gap-1 pt-6">
                  <h3 className="text-base font-semibold">
                    <Link href={`/prompts/${prompt.id}`}>{prompt.title}</Link>
                  </h3>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge>{PROMPT_CATEGORY_LABELS[prompt.category]}</Badge>
                    <span>
                      {prompt.variables.length > 0
                        ? `${prompt.variables.length} Variablen`
                        : "keine Variablen"}
                      {prompt.tags.length > 0 ? ` · Tags: ${prompt.tags.join(", ")}` : ""}
                      {prompt.description ? ` · ${prompt.description}` : ""}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Neuer Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createPromptAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-new-title">Titel</Label>
              <Input id="prompt-new-title" type="text" name="title" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-new-category">Kategorie</Label>
              <Select name="category" defaultValue="other">
                <SelectTrigger id="prompt-new-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {PROMPT_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-new-description">Beschreibung</Label>
              <Input id="prompt-new-description" type="text" name="description" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-new-body">Body (Variablen als {"{{name}}"})</Label>
              <Textarea id="prompt-new-body" name="body" rows={6} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-new-tags">Tags (Komma-getrennt)</Label>
              <Input id="prompt-new-tags" type="text" name="tags" />
            </div>
            <div>
              <Button type="submit">Anlegen</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </StudioShell>
  );
}
