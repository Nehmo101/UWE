export type ContentBlockDeleteDecision = "delete" | "already_deleted" | "not_found";

/**
 * A repeated delete is a successful no-op. Server Action retries, double
 * clicks, and stale RSC payloads can submit the same block id more than once.
 * A block from another world must still look like a missing block.
 */
export function decideContentBlockDelete(
  blockWorldId: string | null,
  requestedWorldId: string,
): ContentBlockDeleteDecision {
  if (blockWorldId === null) return "already_deleted";
  return blockWorldId === requestedWorldId ? "delete" : "not_found";
}
