import {
  BLOCK_TYPE_LABELS,
  PAGE_TYPE_LABELS,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  ContentBlockTypeEnum,
  PageTypeEnum,
  VisibilityEnum,
  type PageTemplateView,
} from "@uwe/database/server";

/**
 * Shared form for creating and editing page templates. Blocks are edited as
 * repeating fieldsets; the last (empty) row adds a new block when filled.
 */
export function TemplateForm({
  template,
  action,
  submitLabel,
}: {
  template: PageTemplateView | null;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const blocks = template?.blocks ?? [];

  return (
    <form action={action} className="uwe-form" style={{ maxWidth: "48rem" }}>
      {template && <input type="hidden" name="templateId" value={template.id} />}

      <label>
        Name
        <input name="name" required defaultValue={template?.name ?? ""} />
      </label>

      <label>
        Beschreibung
        <input name="description" defaultValue={template?.description ?? ""} />
      </label>

      <label>
        Seitentyp
        <select name="pageType" defaultValue={template?.pageType ?? "lore"}>
          {Object.values(PageTypeEnum).map((type) => (
            <option key={type} value={type}>{PAGE_TYPE_LABELS[type]}</option>
          ))}
        </select>
      </label>

      <label>
        Standard-Sichtbarkeit
        <select name="defaultVisibility" defaultValue={template?.defaultVisibility ?? "dm_only"}>
          {Object.values(VisibilityEnum).map((v) => (
            <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
          ))}
        </select>
        <small className="uwe-field-hint">
          „Portal sichtbar“ ist nach dem Veröffentlichen für angemeldete Spieler im Portal sichtbar. Geheimnisse gehören in Nur-GM-Blöcke.
        </small>
      </label>

      <label>
        Titel-Platzhalter
        <input name="titlePlaceholder" defaultValue={template?.titlePlaceholder ?? ""} />
      </label>

      <h2 style={{ fontSize: "1rem", margin: "0.5rem 0 0" }}>Blöcke</h2>

      {blocks.map((block, index) => (
        <fieldset key={index} className="uwe-template-block-fieldset">
          <legend>Block {index + 1}</legend>
          <label>
            Typ
            <select name={`blockType_${index}`} defaultValue={block.type}>
              {Object.values(ContentBlockTypeEnum).map((type) => (
                <option key={type} value={type}>{BLOCK_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label>
            Sichtbarkeit
            <select name={`blockVisibility_${index}`} defaultValue={block.visibility}>
              {Object.values(VisibilityEnum).map((v) => (
                <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
              ))}
            </select>
          </label>
          <label>
            Inhalt
            <textarea name={`blockContent_${index}`} rows={6} defaultValue={block.content} />
          </label>
          <label style={{ flexDirection: "row", display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input type="checkbox" name={`blockRemove_${index}`} />
            Block entfernen
          </label>
        </fieldset>
      ))}

      <fieldset className="uwe-template-block-fieldset">
        <legend>Neuer Block (optional)</legend>
        <input type="hidden" name={`blockNew_${blocks.length}`} value="1" />
        <label>
          Typ
          <select name={`blockType_${blocks.length}`} defaultValue="rich_text">
            {Object.values(ContentBlockTypeEnum).map((type) => (
              <option key={type} value={type}>{BLOCK_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </label>
        <label>
          Sichtbarkeit
          <select name={`blockVisibility_${blocks.length}`} defaultValue="dm_only">
            {Object.values(VisibilityEnum).map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
            ))}
          </select>
        </label>
        <label>
          Inhalt (leer = Block wird nicht angelegt)
          <textarea name={`blockContent_${blocks.length}`} rows={4} defaultValue="" />
        </label>
      </fieldset>

      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">{submitLabel}</button>
    </form>
  );
}
