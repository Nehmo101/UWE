import type { PageWithBlocks } from "@uwe/database/server";
import { updatePlayerCharacterBlockAction } from "../../app/character-actions";

interface PlayerCharacterEditPanelProps {
  worldSlug: string;
  page: PageWithBlocks;
  returnPath: string;
}

export function PlayerCharacterEditPanel({
  worldSlug,
  page,
  returnPath,
}: PlayerCharacterEditPanelProps) {
  const editableBlocks = page.contentBlocks.filter(
    (block) =>
      block.visibility === "player_visible" &&
      (block.type === "player_text" || block.type === "rich_text"),
  );

  if (editableBlocks.length === 0) {
    return null;
  }

  return (
    <section className="auth-block auth-character-edit">
      <h2>Charakter pflegen</h2>
      <p className="auth-muted">
        Du kannst die freigegebenen Felder deines Charakters bearbeiten. Kanon und Sichtbarkeit
        bleibt beim Spielleiter.
      </p>
      <ul className="auth-character-blocks">
        {editableBlocks.map((block) => (
          <li key={block.id}>
            <form action={updatePlayerCharacterBlockAction} className="auth-note-form">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="pageSlug" value={page.slug} />
              <input type="hidden" name="blockId" value={block.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label htmlFor={`block-${block.id}`}>
                {block.type === "player_text" ? "Spielertext" : "Text"}
              </label>
              <textarea
                id={`block-${block.id}`}
                name="content"
                rows={4}
                defaultValue={block.content}
                required
              />
              <button type="submit" className="auth-btn auth-btn-small">
                Speichern
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
