/**
 * Pure hierarchy walk backing the atlas node subtree-delete path. Kept out of
 * atlas-service.ts so that module stays within the file-size budget and the
 * graph traversal stays unit-testable without a database.
 */

export interface AtlasNodeParentRef {
  id: string;
  parentId: string | null;
}

/**
 * Return `rootId` plus every descendant node id within the given map graph,
 * ordered parent-before-child (BFS). A visited set guards against accidental
 * cycles in the parent links. Returns an empty array when the root is absent.
 */
export function collectSubtreeNodeIds(
  rootId: string,
  nodes: AtlasNodeParentRef[],
): string[] {
  const childrenByParent = new Map<string, string[]>();
  let rootPresent = false;
  for (const node of nodes) {
    if (node.id === rootId) rootPresent = true;
    if (!node.parentId) continue;
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node.id);
    childrenByParent.set(node.parentId, siblings);
  }
  if (!rootPresent) return [];

  const ordered: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    ordered.push(current);
    for (const child of childrenByParent.get(current) ?? []) {
      if (!visited.has(child)) queue.push(child);
    }
  }
  return ordered;
}
