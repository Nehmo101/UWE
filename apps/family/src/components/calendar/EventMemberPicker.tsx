import { MemberDot } from "../members/MemberFields";

/**
 * Auswahl der beteiligten Personen eines Termins.
 *
 * Mehrfachauswahl, weil ein Termin oft mehreren gehört („Familienessen").
 * Keine Auswahl heißt: der Termin betrifft den Haushalt allgemein — das ist
 * der bisherige Zustand aller Bestandstermine und bleibt gültig.
 */

export interface PickerMember {
  id: string;
  displayName: string;
  colour: string;
}

export function EventMemberPicker({
  members,
  selected = [],
}: {
  members: readonly PickerMember[];
  selected?: readonly string[];
}) {
  if (members.length === 0) return null;

  const chosen = new Set(selected);

  return (
    <fieldset className="family-form-inline">
      <legend>Wen betrifft der Termin?</legend>
      {members.map((member) => (
        <label key={member.id} className="family-check">
          <input
            type="checkbox"
            name="memberIds"
            value={member.id}
            defaultChecked={chosen.has(member.id)}
          />
          <MemberDot colour={member.colour} />
          {member.displayName}
        </label>
      ))}
    </fieldset>
  );
}
