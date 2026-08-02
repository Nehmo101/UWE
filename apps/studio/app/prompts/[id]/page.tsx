import { notFound } from "next/navigation";
import { prisma } from "@uwe/database/server";
import {
  createPromptLibraryService,
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
} from "@uwe/database/prompt-library";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { deletePromptAction, updatePromptAction } from "@/app/prompt-actions";
import { PromptFillClient } from "@/app/prompts/PromptFillClient";
import { PromptBodyField } from "@/app/prompts/PromptBodyField";
import {
  Alert,
  Button,
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
} from "@/src/components/ui";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export const dynamic = "force-dynamic";

export default async function PromptDetailPage({ params, searchParams }: Props) {
  await requireStudioAccess();
  const { id } = await params;
  const { saved } = await searchParams;

  const prompt = await createPromptLibraryService(prisma).get(id);
  if (!prompt) notFound();

  return (
    <>
      <ShellBreadcrumb items={[{ label: "Prompt-Bibliothek", href: "/prompts" }, { label: prompt.title }]} />
      <PageHeader
        title={prompt.title}
        summary={PROMPT_CATEGORY_LABELS[prompt.category]}
      />

      {saved ? <Alert tone="success" icon="check" title="Gespeichert." className="mb-4" /> : null}

      <PromptFillClient body={prompt.body} variables={prompt.variables} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updatePromptAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={prompt.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-edit-title">Titel</Label>
              <Input id="prompt-edit-title" type="text" name="title" defaultValue={prompt.title} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-edit-category">Kategorie</Label>
              <Select name="category" defaultValue={prompt.category}>
                <SelectTrigger id="prompt-edit-category">
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
              <Label htmlFor="prompt-edit-description">Beschreibung</Label>
              <Input
                id="prompt-edit-description"
                type="text"
                name="description"
                defaultValue={prompt.description}
              />
            </div>
            <PromptBodyField initialBody={prompt.body} initialVariables={prompt.variables} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-edit-tags">Tags (Komma-getrennt)</Label>
              <Input id="prompt-edit-tags" type="text" name="tags" defaultValue={prompt.tags.join(", ")} />
            </div>
            <div>
              <Button type="submit">Speichern</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <form action={deletePromptAction} className="mt-4">
        <input type="hidden" name="id" value={prompt.id} />
        <Button type="submit" variant="secondary" size="sm">
          Prompt löschen
        </Button>
      </form>
    </>
  );
}
