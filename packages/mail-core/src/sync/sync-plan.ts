/**
 * Pure planning for incremental IMAP sync. Given the server's UIDVALIDITY, the
 * account's stored UIDVALIDITY, the highest UID we have already seen, and the
 * current server UID list, decide which UIDs to fetch, which local rows are
 * stale (deleted/moved on the server), and the new watermark to persist.
 *
 * Kept side-effect free so it can be unit-tested without an IMAP server.
 */

export interface SyncPlanInput {
  /** UIDVALIDITY reported by the server for this mailbox (stringified). */
  serverUidValidity: string | null;
  /** UIDVALIDITY we stored on the last sync, or null on first sync. */
  storedUidValidity: string | null;
  /** Highest UID we have already persisted for this mailbox (0 = none). */
  lastSeenUid: number;
  /** All UIDs currently present on the server (any order). */
  serverUids: number[];
  /** UIDs we currently hold locally for this mailbox (for reconciliation). */
  localUids?: number[];
  /**
   * On a full/initial sync, cap how many of the most recent messages to fetch.
   * Ignored for incremental syncs (those only fetch genuinely new UIDs).
   */
  limit?: number;
}

export interface SyncPlan {
  mode: "full" | "incremental";
  /** UIDs to fetch from the server, ascending. */
  uidsToFetch: number[];
  /** Locally-held UIDs no longer on the server — their rows should be removed. */
  uidsToDelete: number[];
  /** New highest-seen UID to persist as the watermark. */
  newLastSeenUid: number;
}

function uniqueSortedAscending(values: number[]): number[] {
  return Array.from(new Set(values.filter((v) => Number.isFinite(v)))).sort((a, b) => a - b);
}

/**
 * A changed (or absent stored) UIDVALIDITY means the server renumbered the
 * mailbox — every local UID is meaningless and we must resync from scratch.
 */
export function planImapSync(input: SyncPlanInput): SyncPlan {
  const serverUids = uniqueSortedAscending(input.serverUids);
  const highestServerUid = serverUids.length > 0 ? serverUids[serverUids.length - 1] : 0;

  const validityChanged =
    !input.storedUidValidity ||
    !input.serverUidValidity ||
    input.storedUidValidity !== input.serverUidValidity;

  if (validityChanged || input.lastSeenUid <= 0) {
    const limited =
      input.limit && input.limit > 0 && serverUids.length > input.limit
        ? serverUids.slice(-input.limit)
        : serverUids;
    return {
      mode: "full",
      uidsToFetch: limited,
      // On a full resync we do not delete: the caller rebuilds from what it fetches.
      uidsToDelete: [],
      newLastSeenUid: Math.max(highestServerUid, input.lastSeenUid),
    };
  }

  const uidsToFetch = serverUids.filter((uid) => uid > input.lastSeenUid);

  const serverSet = new Set(serverUids);
  const uidsToDelete = uniqueSortedAscending(input.localUids ?? []).filter(
    (uid) => !serverSet.has(uid),
  );

  return {
    mode: "incremental",
    uidsToFetch,
    uidsToDelete,
    newLastSeenUid: Math.max(highestServerUid, input.lastSeenUid),
  };
}

/**
 * Groups a UID list into compact IMAP fetch-range strings ("3:8,11,20:24"),
 * each covering at most `chunkSize` UIDs so a single FETCH stays bounded.
 */
export function buildUidFetchChunks(uids: number[], chunkSize = 50): string[] {
  const sorted = uniqueSortedAscending(uids);
  const chunks: string[] = [];
  for (let i = 0; i < sorted.length; i += chunkSize) {
    const slice = sorted.slice(i, i + chunkSize);
    chunks.push(compressToRanges(slice));
  }
  return chunks;
}

function compressToRanges(sorted: number[]): string {
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const uid = sorted[i];
    if (uid === prev + 1) {
      prev = uid;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}:${prev}`);
    start = uid;
    prev = uid;
  }
  parts.push(start === prev ? `${start}` : `${start}:${prev}`);
  return parts.join(",");
}
