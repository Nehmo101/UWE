export const HANDOUT_NEW_WINDOW_DAYS = 14;

export interface HandoutUnlockInfo {
  pageId: string;
  unlockedAt: Date;
  sessionLabel: string | null;
}

export interface HandoutInboxItem<TPage extends { id: string }> {
  page: TPage;
  unlockedAt: Date | null;
  sessionLabel: string | null;
  isNew: boolean;
}

/** True when the unlock happened within the "new" window. */
export function isNewUnlock(
  unlockedAt: Date,
  now: Date = new Date(),
  windowDays: number = HANDOUT_NEW_WINDOW_DAYS,
): boolean {
  return now.getTime() - unlockedAt.getTime() <= windowDays * 86_400_000;
}

/**
 * Combines player-visible handout pages with the viewer's session unlocks:
 * newly unlocked handouts first (newest unlock on top), the rest by page order.
 */
export function buildHandoutInbox<TPage extends { id: string }>(
  pages: TPage[],
  unlocks: HandoutUnlockInfo[],
  now: Date = new Date(),
): HandoutInboxItem<TPage>[] {
  const unlockByPage = new Map(unlocks.map((unlock) => [unlock.pageId, unlock]));

  return pages
    .map((page) => {
      const unlock = unlockByPage.get(page.id) ?? null;
      return {
        page,
        unlockedAt: unlock?.unlockedAt ?? null,
        sessionLabel: unlock?.sessionLabel ?? null,
        isNew: unlock ? isNewUnlock(unlock.unlockedAt, now) : false,
      };
    })
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      const aTime = a.unlockedAt?.getTime() ?? 0;
      const bTime = b.unlockedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
}
