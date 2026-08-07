import { compareChapterOrder } from "./chapter-helpers";

export interface HierarchicalChapter {
  id: string;
  parentChapterId: string | null;
  sortIndex: number | null;
  title: string;
}

export interface ChapterTreeNode<T extends HierarchicalChapter> {
  chapter: T;
  children: Array<ChapterTreeNode<T>>;
}

export interface ChapterQuestCounts {
  open: number;
  completed: number;
  failed: number;
  total: number;
}

/** A campaign act is a story-arc page without a story-arc parent. */
export function rootChapters<T extends HierarchicalChapter>(chapters: T[]): T[] {
  const ids = new Set(chapters.map((chapter) => chapter.id));
  return chapters
    .filter((chapter) => !chapter.parentChapterId || !ids.has(chapter.parentChapterId))
    .sort(compareChapterOrder);
}

export function buildChapterTree<T extends HierarchicalChapter>(
  chapters: T[],
): Array<ChapterTreeNode<T>> {
  const nodes = new Map<string, ChapterTreeNode<T>>(
    chapters.map((chapter) => [chapter.id, { chapter, children: [] }]),
  );
  const roots: Array<ChapterTreeNode<T>> = [];

  for (const node of nodes.values()) {
    const parent = node.chapter.parentChapterId
      ? nodes.get(node.chapter.parentChapterId)
      : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (items: Array<ChapterTreeNode<T>>) => {
    items.sort((a, b) => compareChapterOrder(a.chapter, b.chapter));
    for (const item of items) sort(item.children);
  };
  sort(roots);
  return roots;
}

export function descendantChapterIds<T extends HierarchicalChapter>(
  chapters: T[],
  rootId: string,
): string[] {
  const children = new Map<string, string[]>();
  for (const chapter of chapters) {
    if (!chapter.parentChapterId) continue;
    children.set(chapter.parentChapterId, [
      ...(children.get(chapter.parentChapterId) ?? []),
      chapter.id,
    ]);
  }

  const found: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    found.push(id);
    for (const childId of children.get(id) ?? []) visit(childId);
  };
  visit(rootId);
  return found;
}

/** Roll direct quest counts up from chapters and quest pools into their act. */
export function rollupChapterQuestCounts<T extends HierarchicalChapter>(
  chapters: T[],
  direct: Map<string, ChapterQuestCounts>,
): Map<string, ChapterQuestCounts> {
  const result = new Map<string, ChapterQuestCounts>();
  const tree = buildChapterTree(chapters);
  const add = (a: ChapterQuestCounts, b: ChapterQuestCounts): ChapterQuestCounts => ({
    open: a.open + b.open,
    completed: a.completed + b.completed,
    failed: a.failed + b.failed,
    total: a.total + b.total,
  });
  const visit = (node: ChapterTreeNode<T>): ChapterQuestCounts => {
    let counts = direct.get(node.chapter.id) ?? { open: 0, completed: 0, failed: 0, total: 0 };
    for (const child of node.children) counts = add(counts, visit(child));
    result.set(node.chapter.id, counts);
    return counts;
  };
  for (const root of tree) visit(root);
  return result;
}
