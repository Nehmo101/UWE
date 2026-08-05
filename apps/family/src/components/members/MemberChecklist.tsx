import { MemberDot } from "./MemberDot";

/**
 * Mehrfachauswahl von Haushalts-Mitgliedern.
 *
 * Überall, wo man ein Mitglied hinterlegen kann, dürfen es mehrere sein: der
 * Termin betrifft oft die halbe Familie, die Wurmkur beide Katzen, das Abo
 * zwei Kinder. Deshalb Kästchen statt Auswahlliste — eine `<select multiple>`
 * ist auf dem Telefon kaum zu bedienen, und der Haushalt ist klein genug, dass
 * alle nebeneinander passen.
 *
 * Server-Component ohne Zustand: die Auswahl kommt als wiederholtes Feld im
 * Formular an (`formData.getAll(name)`).
 */

export interface ChecklistMember {
  id: string;
  displayName: string;
  colour: string;
}

export function MemberChecklist({
  members,
  name,
  legend,
  selected = [],
}: {
  members: readonly ChecklistMember[];
  /** Feldname; kommt mehrfach im Formular an. */
  name: string;
  legend: string;
  selected?: readonly string[];
}) {
  if (members.length === 0) return null;

  const chosen = new Set(selected);

  return (
    <fieldset className="family-form-inline">
      <legend>{legend}</legend>
      {members.map((member) => (
        <label key={member.id} className="family-check">
          <input
            type="checkbox"
            name={name}
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
