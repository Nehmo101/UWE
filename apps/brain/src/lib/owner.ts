/** Global system owner — the only role allowed into the Brain product. */
export function isBrainOwner(role: string | null | undefined): boolean {
  return role === "owner";
}
