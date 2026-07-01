import type { DocumentTemplateCategory } from "@uwe/database/server";
import {
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  DocumentTemplateCategoryEnum,
} from "@uwe/database/server";

interface DocumentTemplateEditorProps {
  templateId?: string;
  name?: string;
  category?: DocumentTemplateCategory;
  body?: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
}

export function DocumentTemplateEditor({
  templateId,
  name = "",
  category = DocumentTemplateCategoryEnum.other,
  body = "",
  action,
  submitLabel,
  deleteAction,
}: DocumentTemplateEditorProps) {
  return (
    <div className="uwe-brain-create-form">
      <form action={action} className="uwe-brain-create-form">
        {templateId ? <input type="hidden" name="id" value={templateId} /> : null}
        <label>
          Name
          <input name="name" defaultValue={name} required />
        </label>
        <label>
          Kategorie
          <select name="category" defaultValue={category}>
            {Object.values(DocumentTemplateCategoryEnum).map((entry) => (
              <option key={entry} value={entry}>
                {DOCUMENT_TEMPLATE_CATEGORY_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vorlagentext
          <textarea
            name="body"
            rows={8}
            defaultValue={body}
            placeholder="z. B. Vertrag zwischen {{partei_a}} und {{partei_b}} …"
            spellCheck={false}
          />
        </label>
        <p className="uwe-dashboard-muted">
          Platzhalter als <code>{`{{variable}}`}</code> — beim Speichern werden Variablen automatisch
          erkannt.
        </p>
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
          {submitLabel}
        </button>
      </form>
      {templateId && deleteAction ? (
        <form action={deleteAction}>
          <input type="hidden" name="id" value={templateId} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
            Löschen
          </button>
        </form>
      ) : null}
    </div>
  );
}
