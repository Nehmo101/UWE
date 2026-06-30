export const NON_SANDBOX_WORLD_WHERE = { isSandbox: false } as const;

export function assertWorldExportAllowed(world: { isSandbox: boolean; name?: string }): void {
  if (world.isSandbox) {
    throw new Error("SANDBOX_WORLD_EXPORT_FORBIDDEN");
  }
}

export function assertWorldBackupAllowed(
  world: { isSandbox: boolean; name?: string },
  scope: "full" | "world" | "campaign",
): void {
  if (scope === "full") {
    return;
  }
  if (world.isSandbox) {
    throw new Error("SANDBOX_WORLD_BACKUP_FORBIDDEN");
  }
}
