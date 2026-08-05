/**
 * Mitglieder-Zuordnungen — überall dieselbe Mechanik.
 *
 * Termin, Akten-Eintrag und Kalender-Abo hängen alle an einer eigenen
 * Verknüpfungstabelle statt an einer `member_id`-Spalte: wo man ein Mitglied
 * hinterlegen kann, dürfen es mehrere sein. Das Setzen ist dabei jedes Mal
 * dasselbe Stück Arbeit — hier steht es einmal.
 *
 * `skipDuplicates` gibt es auf SQLite nicht, und ein erneutes Speichern
 * derselben Auswahl darf nicht am zusammengesetzten Primärschlüssel scheitern.
 * Deshalb erst das Überzählige löschen, dann nur die fehlenden anlegen.
 */

/** Doppelte und leere Kennungen fallen weg; die Reihenfolge bleibt erhalten. */
export function normaliseMemberIds(memberIds: readonly string[]): string[] {
  return [...new Set(memberIds.map((id) => id.trim()).filter((id) => id !== ""))];
}

/** Der Ausschnitt einer Verknüpfungstabelle, den {@link setMemberLinks} braucht. */
export interface MemberLinkStore {
  /** Bereits zugeordnete Mitglieder des Eigentümers. */
  listMemberIds(ownerId: string): Promise<string[]>;
  /** Alles wegräumen, was nicht in `keep` steht; leeres `keep` heisst: alles. */
  removeExcept(ownerId: string, keep: readonly string[]): Promise<void>;
  add(ownerId: string, memberIds: readonly string[]): Promise<void>;
}

/**
 * Setzt die Mitglieder eines Eigentümers auf genau die übergebene Menge und
 * gibt die tatsächlich gesetzten Kennungen zurück. Leeres Array entfernt alle
 * Zuordnungen — was das bedeutet, entscheidet der Aufrufer: beim Termin „gilt
 * für den ganzen Haushalt", beim Akten-Eintrag ist es nicht erlaubt.
 */
export async function setMemberLinks(
  store: MemberLinkStore,
  ownerId: string,
  memberIds: readonly string[],
): Promise<string[]> {
  const unique = normaliseMemberIds(memberIds);

  await store.removeExcept(ownerId, unique);
  if (unique.length === 0) return unique;

  const known = new Set(await store.listMemberIds(ownerId));
  const missing = unique.filter((memberId) => !known.has(memberId));
  if (missing.length > 0) await store.add(ownerId, missing);

  return unique;
}

/** Anzeigefertiges Mitglied an einem Termin, Eintrag oder Abo. */
export interface FamilyMemberBadge {
  id: string;
  displayName: string;
  /** Aufgelöste Anzeigefarbe — nie leer. */
  colour: string;
}

/** Mitglieder nach Anzeigename ordnen, damit die Reihenfolge nicht springt. */
export function sortMemberBadges<T extends { displayName: string }>(badges: readonly T[]): T[] {
  return [...badges].sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));
}
