import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { canEnterFamily } from "./family-access";

/**
 * Häkchen-Guard für Family-API-Routen.
 *
 * Dieselbe Regel wie für Seiten und Server-Actions: eine Sitzung reicht nicht,
 * die Adresse muss das Häkchen `Family` tragen. Gibt `null` zurück, wenn alles
 * passt — sonst die fertige Fehlerantwort, die die Route direkt zurückgibt.
 *
 * 401 und 403 werden bewusst unterschieden: „melde dich an" ist eine andere
 * Auskunft als „du bist angemeldet, aber nicht für Family freigeschaltet", und
 * beides verrät nichts über Inhalte.
 */
export async function requireFamilyApiAuth(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }
  if (!canEnterFamily(user)) {
    return NextResponse.json({ error: "Kein Zugang zum Bereich Family." }, { status: 403 });
  }
  return null;
}
