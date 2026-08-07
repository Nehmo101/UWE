/**
 * SQLite/libSQL limits the number of bound parameters in one statement.
 * Backups can easily exceed that limit once a world contains several thousand
 * pages, so ID-based reads must be split into predictable chunks.
 */
export const BACKUP_QUERY_BATCH_SIZE = 400;

export async function loadInBatches<T>(
  values: readonly string[],
  load: (batch: string[]) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = [];

  for (let offset = 0; offset < values.length; offset += BACKUP_QUERY_BATCH_SIZE) {
    result.push(...(await load(values.slice(offset, offset + BACKUP_QUERY_BATCH_SIZE))));
  }

  return result;
}
