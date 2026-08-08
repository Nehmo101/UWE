export function nextWorldSelection(
  currentWorldIds: readonly string[],
  worldId: string,
  enabled: boolean,
): string[] {
  const selected = new Set(currentWorldIds);
  if (enabled) selected.add(worldId);
  else selected.delete(worldId);
  return [...selected];
}
