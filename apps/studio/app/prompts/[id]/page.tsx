import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@uwe/database/server";
import {
  createPromptLibraryService,
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
} from "@uwe/database/prompt-library";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { deletePromptAction, updatePromptAction } from "@/app/prompt-actions";
import { PromptFillClient } from "@/app/prompts/PromptFillClient";

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
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Prompt-Bibliothek", href: "/prompts" }, { label: prompt.title }]}
        />
      }
    >
      <PageHeader
        title={prompt.title}
        summary={PROMPT_CATEGORY_LABELS[prompt.category]}
        actions={
          <Link href="/agent-jobs" className="uwe-v2-btn">
            Als Agent Job starten →
          </Link>
        }
      />

      {saved ? (
        <p className="uwe-inspector-ok" role="status">
          ✓ Gespeichert.
        </p>
      ) : null}

      <PromptFillClient body={prompt.body} variables={prompt.variables} />

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Bearbeiten</h2>
        <form action={updatePromptAction} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <input type="hidden" name="id" value={prompt.id} />
          <label>
            Titel
            <input type="text" name="title" defaultValue={prompt.title} required />
          </label>
          <label>
            Kategorie
            <select name="category" defaultValue={prompt.category}>
              {PROMPT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {PROMPT_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Beschreibung
            <input type="text" name="description" defaultValue={prompt.description} />
          </label>
          <label>
            Body
            <textarea name="body" rows={8} defaultValue={prompt.body} required />
          </label>
          <label>
            Tags (Komma-getrennt)
            <input type="text" name="tags" defaultValue={prompt.tags.join(", ")} />
          </label>
          <div className="uwe-form-actions">
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Speichern
            </button>
          </div>
        </form>
      </section>

      <section className="uwe-v2-section">
        <form action={deletePromptAction}>
          <input type="hidden" name="id" value={prompt.id} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
            Prompt löschen
          </button>
        </form>
      </section>
    </StudioShell>
  );
}
