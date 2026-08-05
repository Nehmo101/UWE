import { MemberChecklist, type ChecklistMember } from "../members/MemberChecklist";

/**
 * Auswahl der beteiligten Personen eines Termins.
 *
 * Mehrfachauswahl, weil ein Termin oft mehreren gehört („Familienessen").
 * Keine Auswahl heißt: der Termin betrifft den Haushalt allgemein — das ist
 * der bisherige Zustand aller Bestandstermine und bleibt gültig.
 */

export type PickerMember = ChecklistMember;

export function EventMemberPicker({
  members,
  selected = [],
}: {
  members: readonly PickerMember[];
  selected?: readonly string[];
}) {
  return (
    <MemberChecklist
      members={members}
      name="memberIds"
      legend="Wen betrifft der Termin?"
      selected={selected}
    />
  );
}
