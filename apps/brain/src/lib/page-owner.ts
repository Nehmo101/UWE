import { getCurrentUser } from "./auth";
import { canEnterBrain } from "./owner";

/** Returns the current user only when they are the system owner, else null.
 *  Every Brain page uses this to gate content server-side. */
export async function getBrainOwner() {
  const user = await getCurrentUser();
  return user && canEnterBrain(user) ? user : null;
}
