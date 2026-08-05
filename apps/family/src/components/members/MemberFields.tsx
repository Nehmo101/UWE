import { FAMILY_MEMBER_KINDS, FAMILY_MEMBER_KIND_LABEL } from "@uwe/family-core";

/**
 * Die Formularfelder eines Mitglieds — einmal für das eigene Profil, einmal
 * für Mitglieder ohne Konto. Bewusst ein Server-Component ohne Zustand: das
 * Formular wird von einer Server Action entgegengenommen.
 */

export interface MemberFieldValues {
  displayName?: string;
  colour?: string;
  note?: string;
  kind?: string;
  birthdayOn?: Date | null;
  anniversaryOn?: Date | null;
  anniversaryLabel?: string | null;
}

/** `<input type="date">` erwartet „JJJJ-MM-TT" — in UTC, wie gespeichert. */
function dateValue(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function MemberFields({
  values,
  showKind = true,
}: {
  values: MemberFieldValues;
  /** Beim eigenen Profil steht die Art nicht zur Wahl — das ist ein Mensch. */
  showKind?: boolean;
}) {
  return (
    <>
      <div className="family-form-row">
        <label>
          Anzeigename
          <input name="displayName" defaultValue={values.displayName ?? ""} required />
        </label>
        {showKind ? (
          <label>
            Art
            <select name="kind" defaultValue={values.kind ?? "adult"}>
              {FAMILY_MEMBER_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {FAMILY_MEMBER_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Farbe
          <input
            type="color"
            name="colour"
            defaultValue={values.colour && values.colour !== "" ? values.colour : "#64748b"}
          />
        </label>
      </div>

      <div className="family-form-row">
        <label>
          Geburtstag
          <input type="date" name="birthdayOn" defaultValue={dateValue(values.birthdayOn)} />
        </label>
        <label>
          Jahrestag
          <input type="date" name="anniversaryOn" defaultValue={dateValue(values.anniversaryOn)} />
        </label>
        <label>
          Bezeichnung des Jahrestags
          <input
            name="anniversaryLabel"
            defaultValue={values.anniversaryLabel ?? ""}
            placeholder="z. B. Hochzeitstag"
          />
        </label>
      </div>

      <label>
        Notiz
        <textarea name="note" rows={2} defaultValue={values.note ?? ""} />
      </label>
    </>
  );
}

/** Liegt in einer eigenen Datei — Bestandsimporte bleiben trotzdem gültig. */
export { MemberDot } from "./MemberDot";
