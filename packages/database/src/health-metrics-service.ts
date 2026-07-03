import fs from "node:fs";
import type { PrismaClient } from "./client";
import { createConnectorService } from "./connector-service";
import { getMigrationStatus } from "./migration-status";

/**
 * Performance-/Health-Ampel für echte Nutzung: DB-Größe, größte Tabellen,
 * Upload-Volumen, Connector-Erreichbarkeit, Migrations-/Backup-Signale. Read-only
 * und bewusst getrennt vom Kern-`getSystemStatus` (das ins Health-Endpoint fließt)
 * — hier geht es um Betriebs-Insight, nicht um den Liveness-Check.
 */

export type HealthLight = "green" | "yellow" | "red";

export interface TableCount {
  label: string;
  count: number;
}

export interface HealthMetrics {
  light: HealthLight;
  dbSizeBytes: number | null;
  dbSizeLabel: string;
  largestTables: TableCount[];
  uploads: { count: number; totalBytes: number; totalLabel: string };
  connector: { online: boolean; count: number };
  migrationsOk: boolean;
  pendingMigrations: number;
}

/** Menschenlesbare Byte-Größe (SI-nah, deutsche Dezimalkomma-Anzeige). */
export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[unitIndex]}`;
}

export interface HealthSignals {
  migrationsOk: boolean;
  connectorOnline: boolean;
  /** DB-Größe in Bytes; große DBs auf dem alten Host sind ein gelbes Signal. */
  dbSizeBytes: number | null;
  dbWarnBytes?: number;
  dbCritBytes?: number;
}

/** Ampel-Logik als pure Funktion — testbar ohne DB. */
export function computeHealthLight(signals: HealthSignals): HealthLight {
  const warn = signals.dbWarnBytes ?? 500 * 1024 * 1024; // 500 MB
  const crit = signals.dbCritBytes ?? 2 * 1024 * 1024 * 1024; // 2 GB

  if (!signals.migrationsOk) return "red";
  if (signals.dbSizeBytes != null && signals.dbSizeBytes >= crit) return "red";

  if (!signals.connectorOnline) return "yellow";
  if (signals.dbSizeBytes != null && signals.dbSizeBytes >= warn) return "yellow";

  return "green";
}

function resolveSqliteDbFile(): string | null {
  const url = process.env.DATABASE_URL ?? "";
  const match = /^file:(.+)$/.exec(url.trim());
  if (!match) return null;
  return match[1].split("?")[0];
}

export class HealthMetricsService {
  constructor(private readonly db: PrismaClient) {}

  async getMetrics(): Promise<HealthMetrics> {
    const [tables, uploads, connectorSummary, migration] = await Promise.all([
      this.countLargestTables(),
      this.uploadStats(),
      createConnectorService(this.db).summarize(),
      getMigrationStatus(this.db),
    ]);

    const dbFile = resolveSqliteDbFile();
    let dbSizeBytes: number | null = null;
    if (dbFile) {
      try {
        dbSizeBytes = fs.statSync(dbFile).size;
      } catch {
        dbSizeBytes = null;
      }
    }

    const light = computeHealthLight({
      migrationsOk: migration.ok,
      connectorOnline: connectorSummary.onlineCount > 0,
      dbSizeBytes,
    });

    return {
      light,
      dbSizeBytes,
      dbSizeLabel: formatBytes(dbSizeBytes),
      largestTables: tables,
      uploads: {
        count: uploads.count,
        totalBytes: uploads.totalBytes,
        totalLabel: formatBytes(uploads.totalBytes),
      },
      connector: { online: connectorSummary.onlineCount > 0, count: connectorSummary.onlineCount },
      migrationsOk: migration.ok,
      pendingMigrations: migration.pendingMigrations.length,
    };
  }

  private async countLargestTables(): Promise<TableCount[]> {
    const [pages, blocks, assets, aiRuns, worldEvents, pageLinks, sessions] = await Promise.all([
      this.db.page.count(),
      this.db.contentBlock.count(),
      this.db.asset.count(),
      this.db.aiRun.count(),
      this.db.worldEvent.count(),
      this.db.pageLink.count(),
      this.db.gameSession.count(),
    ]);

    return [
      { label: "Seiten", count: pages },
      { label: "Content-Blöcke", count: blocks },
      { label: "Assets", count: assets },
      { label: "KI-Läufe", count: aiRuns },
      { label: "Welt-Ereignisse", count: worldEvents },
      { label: "Seiten-Links", count: pageLinks },
      { label: "Sessions", count: sessions },
    ]
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  private async uploadStats(): Promise<{ count: number; totalBytes: number }> {
    const aggregate = await this.db.asset.aggregate({
      _sum: { size: true },
      _count: true,
    });
    return {
      count: aggregate._count,
      totalBytes: aggregate._sum.size ?? 0,
    };
  }
}

export function createHealthMetricsService(db: PrismaClient): HealthMetricsService {
  return new HealthMetricsService(db);
}
