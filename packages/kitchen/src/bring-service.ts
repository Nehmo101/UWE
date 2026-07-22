/**
 * Bring!-Anbindung als Domänen-Service (`@uwe/kitchen`). Persistiert die
 * Haushalts-Verbindung (verschlüsselte Zugangsdaten + gewählte Liste) und
 * orchestriert den One-Way-Push einer UWE-Einkaufsliste nach Bring!.
 *
 * Sicherheit: E-Mail/Passwort werden mit `SESSION_SECRET` verschlüsselt
 * abgelegt (token-crypto, wie die Spotify-Tokens) und nie im Klartext
 * gespeichert oder an den Client zurückgegeben — die Status-API liefert nur
 * eine maskierte E-Mail. Login erfolgt on-demand pro Operation; es werden keine
 * kurzlebigen Access-Tokens persistiert.
 */
import { toPrismaJsonValue } from "@uwe/database/server";
import type { BrainPrismaClient as PrismaClient } from "@uwe/database/brain-client";
import {
  decryptSecret,
  encryptSecret,
  resolveTokenEncryptionSecret,
} from "@uwe/database/token-crypto";
import {
  bringGetListItems,
  bringLoadLists,
  bringLogin,
  bringPushItems,
  maskBringEmail,
  type BringAuth,
  type BringClientDeps,
  type BringList,
} from "./bring-client";
import { formatAmount, normalizeIngredientName } from "./units";
import type { IngredientUnit } from "./kitchen-types";

const SINGLETON_ID = "singleton";

export interface BringConnectionStatus {
  connected: boolean;
  /** Maskierte Konto-E-Mail (z. B. `a***@example.com`), nie im Klartext. */
  maskedEmail?: string;
  defaultListUuid?: string | null;
  defaultListName?: string | null;
  availableLists: BringList[];
  lastSyncedAt?: string | null;
}

export interface BringPushSummary {
  pushed: number;
  failed: number;
  skipped: number;
  listName: string;
}

export interface BringSyncSummary {
  /** Positionen, die von Bring! neu in die UWE-Liste übernommen wurden. */
  addedToUwe: number;
  /** Positionen, die von UWE neu zu Bring! geschickt wurden. */
  pushedToBring: number;
  /** Push-Versuche, die fehlgeschlagen sind. */
  pushFailed: number;
  listName: string;
}

export class BringService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
    private readonly deps?: BringClientDeps,
  ) {}

  async getStatus(): Promise<BringConnectionStatus> {
    const connection = await this.db.bringConnection.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (!connection) {
      return { connected: false, availableLists: [] };
    }

    return {
      connected: true,
      maskedEmail: maskBringEmail(
        decryptSecret(connection.emailEncrypted, this.encryptionSecret),
      ),
      defaultListUuid: connection.defaultListUuid,
      defaultListName: connection.defaultListName,
      availableLists: this.readLists(connection.availableLists),
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    };
  }

  /**
   * Verbindet (oder aktualisiert) das Bring!-Konto. Validiert die Zugangsdaten
   * per Login, lädt die Listen und wählt bei genau einer Liste diese als
   * Standard. Wirft bei falschen Daten (`BringApiError`).
   */
  async connect(email: string, password: string): Promise<BringConnectionStatus> {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      throw new Error("E-Mail und Passwort sind erforderlich.");
    }

    const auth = await bringLogin(trimmedEmail, password, this.deps);
    const lists = await bringLoadLists(auth, this.deps);
    const soleList = lists.length === 1 ? lists[0] : null;

    const emailEncrypted = encryptSecret(trimmedEmail, this.encryptionSecret);
    const passwordEncrypted = encryptSecret(password, this.encryptionSecret);
    const listsJson = toPrismaJsonValue(lists);

    await this.db.bringConnection.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        emailEncrypted,
        passwordEncrypted,
        bringUserUuid: auth.userUuid,
        bringPublicUuid: auth.publicUuid,
        availableLists: listsJson,
        defaultListUuid: soleList?.listUuid ?? null,
        defaultListName: soleList?.name ?? null,
      },
      update: {
        emailEncrypted,
        passwordEncrypted,
        bringUserUuid: auth.userUuid,
        bringPublicUuid: auth.publicUuid,
        availableLists: listsJson,
      },
    });

    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    await this.db.bringConnection.deleteMany({ where: { id: SINGLETON_ID } });
  }

  /** Meldet sich mit den gespeicherten Daten an und aktualisiert den Listen-Cache. */
  async refreshLists(): Promise<BringList[]> {
    const auth = await this.authenticate();
    const lists = await bringLoadLists(auth, this.deps);
    await this.db.bringConnection.update({
      where: { id: SINGLETON_ID },
      data: { availableLists: toPrismaJsonValue(lists) },
    });
    return lists;
  }

  async setDefaultList(listUuid: string): Promise<void> {
    const connection = await this.requireConnection();
    const lists = this.readLists(connection.availableLists);
    const match = lists.find((list) => list.listUuid === listUuid);
    if (!match) {
      throw new Error("Unbekannte Bring!-Liste — bitte Listen aktualisieren.");
    }
    await this.db.bringConnection.update({
      where: { id: SINGLETON_ID },
      data: { defaultListUuid: match.listUuid, defaultListName: match.name },
    });
  }

  /**
   * Pusht die offenen (nicht abgehakten) Positionen einer UWE-Einkaufsliste auf
   * die gewählte Bring!-Liste. Abgehakte Positionen gelten als erledigt und
   * werden übersprungen. Aktualisiert `lastSyncedAt`.
   */
  async pushShoppingList(shoppingListId: string): Promise<BringPushSummary> {
    const connection = await this.requireConnection();
    if (!connection.defaultListUuid) {
      throw new Error("Keine Bring!-Zielliste gewählt.");
    }

    const items = await this.db.shoppingListItem.findMany({
      where: { listId: shoppingListId },
      orderBy: [{ category: "asc" }, { sortIndex: "asc" }],
    });

    const open = items.filter((item) => !item.checked);
    const skipped = items.length - open.length;

    const auth = await this.authenticate(connection);
    const result = await bringPushItems(
      auth,
      connection.defaultListUuid,
      open.map((item) => ({
        name: item.name,
        spec:
          item.amount != null
            ? formatAmount(item.amount, item.unit as IngredientUnit, item.unitLabel)
            : "",
      })),
      this.deps,
    );

    await this.db.bringConnection.update({
      where: { id: SINGLETON_ID },
      data: { lastSyncedAt: new Date() },
    });

    return {
      ...result,
      skipped,
      listName: connection.defaultListName ?? "Bring!",
    };
  }

  /**
   * Zwei-Wege-Abgleich zwischen einer UWE-Einkaufsliste und der Bring!-Zielliste.
   *
   * Bewusst **additiv/nicht-destruktiv** (Union-Merge): Positionen, die auf einer
   * Seite fehlen, werden auf der anderen ergänzt — es wird nichts gelöscht oder
   * automatisch abgehakt. So kann keine Seite ungewollt Einträge der anderen
   * vernichten. Abgleich (Namensvergleich) erfolgt über den normalisierten Namen.
   *
   * - **Pull:** offene Bring!-Positionen, die (noch) nicht in der UWE-Liste sind,
   *   werden als neue UWE-Positionen angelegt (Spezifikation → `unitLabel`).
   * - **Push:** offene UWE-Positionen, die nicht auf Bring! stehen, werden gepusht.
   */
  async syncShoppingList(shoppingListId: string): Promise<BringSyncSummary> {
    const connection = await this.requireConnection();
    if (!connection.defaultListUuid) {
      throw new Error("Keine Bring!-Zielliste gewählt.");
    }

    const auth = await this.authenticate(connection);
    const [items, remote] = await Promise.all([
      this.db.shoppingListItem.findMany({
        where: { listId: shoppingListId },
        orderBy: [{ category: "asc" }, { sortIndex: "asc" }],
      }),
      bringGetListItems(auth, connection.defaultListUuid, this.deps),
    ]);

    const uweAllKeys = new Set(items.map((item) => normalizeIngredientName(item.name)));
    const remoteOpenKeys = new Set(
      remote.purchase.map((entry) => normalizeIngredientName(entry.name)),
    );

    // Pull: Bring!-Positionen, die es in UWE noch nicht gibt.
    const toPull = remote.purchase.filter(
      (entry) => !uweAllKeys.has(normalizeIngredientName(entry.name)),
    );
    if (toPull.length > 0) {
      await this.db.shoppingListItem.createMany({
        data: toPull.map((entry, index) => ({
          listId: shoppingListId,
          name: entry.name,
          normalizedName: normalizeIngredientName(entry.name),
          unit: "freeform" as const,
          unitLabel: entry.spec || null,
          category: "other" as const,
          recurring: false,
          sortIndex: items.length + index,
        })),
      });
    }

    // Push: offene UWE-Positionen, die (noch) nicht auf Bring! stehen.
    const toPush = items.filter(
      (item) => !item.checked && !remoteOpenKeys.has(normalizeIngredientName(item.name)),
    );
    const pushResult = await bringPushItems(
      auth,
      connection.defaultListUuid,
      toPush.map((item) => ({
        name: item.name,
        spec:
          item.amount != null
            ? formatAmount(item.amount, item.unit as IngredientUnit, item.unitLabel)
            : item.unitLabel ?? "",
      })),
      this.deps,
    );

    await this.db.bringConnection.update({
      where: { id: SINGLETON_ID },
      data: { lastSyncedAt: new Date() },
    });

    return {
      addedToUwe: toPull.length,
      pushedToBring: pushResult.pushed,
      pushFailed: pushResult.failed,
      listName: connection.defaultListName ?? "Bring!",
    };
  }

  private async authenticate(
    connection?: Awaited<ReturnType<BringService["requireConnection"]>>,
  ): Promise<BringAuth> {
    const record = connection ?? (await this.requireConnection());
    const email = decryptSecret(record.emailEncrypted, this.encryptionSecret);
    const password = decryptSecret(record.passwordEncrypted, this.encryptionSecret);
    return bringLogin(email, password, this.deps);
  }

  private async requireConnection() {
    const connection = await this.db.bringConnection.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (!connection) {
      throw new Error("Kein Bring!-Konto verbunden.");
    }
    return connection;
  }

  private readLists(value: unknown): BringList[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry): BringList | null => {
        const record = entry as Record<string, unknown>;
        const listUuid = String(record?.listUuid ?? "");
        if (!listUuid) return null;
        return {
          listUuid,
          name: String(record?.name ?? "Bring!-Liste"),
          theme: typeof record?.theme === "string" ? record.theme : undefined,
        };
      })
      .filter((list): list is BringList => list !== null);
  }
}

export function createBringService(
  db: PrismaClient,
  deps?: BringClientDeps,
): BringService {
  return new BringService(db, resolveTokenEncryptionSecret(), deps);
}
