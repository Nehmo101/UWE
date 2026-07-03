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

interface Props {
  searchParams: Promise<{ category?: string }>;
}

export const dynamic = "force-dynamic";

function isCategory(value: string | undefined): value is PromptTemplateCategory {
  return !!value && (PROMPT_CATEGORIES as string[]).includes(value);
}

export default async function PromptsPage({ searchParams }: Props) {
  await requireStudioAccess();
  const { category } = await searchParams;
  const filter = isCategory(category) ? category : undefined;

  const prompts = await createPromptLibraryService(prisma).list(filter);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Prompt-Bibliothek" }]} />}>
      <PageHeader
        title="Prompt-Bibliothek"
        summary="Prompts als eigene Objekte mit Kategorie und Variablen — ausfüllen, als Cursor/Claude-Prompt kopieren oder als Agent Job starten."
      />

      <section className="uwe-v2-section">
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/prompts" className="uwe-v2-btn uwe-v2-btn-small">
            Alle
          </Link>
          {PROMPT_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/prompts?category=${cat}`}
              className="uwe-v2-btn uwe-v2-btn-small"
              aria-current={filter === cat ? "true" : undefined}
            >
              {PROMPT_CATEGORY_LABELS[cat]}
            </Link>
          ))}
        </div>
      </section>

      <section className="uwe-v2-section">
        {prompts.length === 0 ? (
          <p className="uwe-dashboard-muted">Noch keine Prompts in dieser Kategorie.</p>
        ) : (
          <ul className="uwe-today-card-list">
            {prompts.map((prompt) => (
              <li key={prompt.id} className="uwe-today-card">
                <h3>
                  <Link href={`/prompts/${prompt.id}`}>{prompt.title}</Link>
                </h3>
                <p className="uwe-dashboard-muted">
                  <span className="uwe-badge">{PROMPT_CATEGORY_LABELS[prompt.category]}</span>{" "}
                  {prompt.variables.length > 0 ? `${prompt.variables.length} Variablen` : "keine Variablen"}
                  {prompt.description ? ` · ${prompt.description}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neuer Prompt</h2>
        <form action={createPromptAction} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label>
            Titel
            <input type="text" name="title" required />
          </label>
          <label>
            Kategorie
            <select name="category" defaultValue="other">
              {PROMPT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {PROMPT_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Beschreibung
            <input type="text" name="description" />
          </label>
          <label>
            Body (Variablen als {"{{name}}"})
            <textarea name="body" rows={6} required />
          </label>
          <label>
            Tags (Komma-getrennt)
            <input type="text" name="tags" />
          </label>
          <div className="uwe-form-actions">
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Anlegen
            </button>
          </div>
        </form>
      </section>
    </StudioShell>
  );
}
