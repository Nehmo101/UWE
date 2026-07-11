import type { DocumentTemplateCategory } from "@uwe/database/server";
import {
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  DocumentTemplateCategoryEnum,
} from "@uwe/database/server";
import { Button, Input, Label, Textarea } from "@/src/components/ui";

interface DocumentTemplateEditorProps {
  templateId?: string;
  name?: string;
  category?: DocumentTemplateCategory;
  body?: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
}

/** TODO(design-kit): natives select bleibt — Server-Action-Formular (FormData)
    braucht name/defaultValue ohne Client-State, siehe SessionDetailClient.tsx. */
const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DocumentTemplateEditor({
  templateId,
  name = "",
  category = DocumentTemplateCategoryEnum.other,
  body = "",
  action,
  submitLabel,
  deleteAction,
}: DocumentTemplateEditorProps) {
  const fieldIdSuffix = templateId ?? "new";
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        {templateId ? <input type="hidden" name="id" value={templateId} /> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`document-template-name-${fieldIdSuffix}`}>Name</Label>
          <Input
            id={`document-template-name-${fieldIdSuffix}`}
            name="name"
            defaultValue={name}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`document-template-category-${fieldIdSuffix}`}>Kategorie</Label>
          <select
            id={`document-template-category-${fieldIdSuffix}`}
            name="category"
            defaultValue={category}
            className={SELECT_CLASS}
          >
            {Object.values(DocumentTemplateCategoryEnum).map((entry) => (
              <option key={entry} value={entry}>
                {DOCUMENT_TEMPLATE_CATEGORY_LABELS[entry]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`document-template-body-${fieldIdSuffix}`}>Vorlagentext</Label>
          <Textarea
            id={`document-template-body-${fieldIdSuffix}`}
            name="body"
            rows={8}
            defaultValue={body}
            placeholder="z. B. Vertrag zwischen {{partei_a}} und {{partei_b}} …"
            spellCheck={false}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Platzhalter als <code>{`{{variable}}`}</code> — beim Speichern werden Variablen automatisch
          erkannt.
        </p>
        <Button type="submit" size="sm" className="self-start">
          {submitLabel}
        </Button>
      </form>
      {templateId && deleteAction ? (
        <form action={deleteAction}>
          <input type="hidden" name="id" value={templateId} />
          <Button type="submit" variant="secondary" size="sm">
            Löschen
          </Button>
        </form>
      ) : null}
    </div>
  );
}
