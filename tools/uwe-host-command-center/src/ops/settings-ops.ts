import {
  createSettingsService,
  validateSettingsUpdate,
  type PrismaClient,
} from "@uwe/database/server";

/**
 * System settings from the Command Center — replaces Studio `/settings`
 * (Abschnitt D33). Reads and writes go through the same validation the Studio
 * form used, so nothing can be set here that the app would reject.
 *
 * The read is the client-safe projection: `getSettings` masks secrets in the
 * UI shape, and `sanitizeSettingsForClient` drops the AI key material entirely.
 */

export async function getSettings(db: PrismaClient): Promise<unknown> {
  return createSettingsService(db).getSettingsForClient();
}

export async function updateSettings(
  db: PrismaClient,
  body: Record<string, unknown>,
): Promise<unknown> {
  const parsed = validateSettingsUpdate(body);
  if (!parsed.ok) {
    throw new Error(`Ungültige Einstellungen: ${parsed.errors.join("; ")}`);
  }

  const service = createSettingsService(db);
  await service.updateSettings(parsed.value);
  return service.getSettingsForClient();
}
