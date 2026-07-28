import { getCurrentUser } from "./auth";
import { canEnterFamily } from "./family-access";

/** Gibt den angemeldeten Benutzer nur zurück, wenn er das Häkchen `Family` hat.
 *  Jede Family-Seite gated damit server-seitig. */
export async function getFamilyUser() {
  const user = await getCurrentUser();
  return user && canEnterFamily(user) ? user : null;
}
