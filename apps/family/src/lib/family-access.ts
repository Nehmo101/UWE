import { canAccessFamily, type AuthUser } from "@uwe/auth";

/**
 * Wer Family betreten darf: das Häkchen `Family`, gesetzt pro E-Mail-Adresse in
 * der Kommandozentrale. Es gibt keine Unterbereiche — wer drin ist, sieht ganz
 * Family (Notiz Lasse, G.3).
 */
export function canEnterFamily(user: Pick<AuthUser, "access"> | null | undefined): boolean {
  return user ? canAccessFamily(user) : false;
}
