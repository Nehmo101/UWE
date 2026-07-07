/**
 * Minimaler Client für die **inoffizielle** Bring!-Einkaufsapp-API
 * (api.getbring.com). Reverse-engineered, nicht von Bring! Labs AG autorisiert —
 * kann sich ohne Vorwarnung ändern. Bewusst framework-agnostisch: kein Prisma,
 * keine Secrets, `fetch` ist injizierbar (Tests laufen ohne Netzwerk).
 *
 * Abgedeckt wird nur, was UWE braucht: Login, Listen abrufen, Positionen einer
 * Liste lesen und Positionen pushen — Basis für den Zwei-Wege-Abgleich.
 */

const BRING_BASE_URL = "https://api.getbring.com/rest";

/** Öffentlicher API-Key des Bring!-Webclients — kein Geheimnis, in allen Clients gleich. */
const BRING_API_KEY = "cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp";

const BASE_HEADERS: Record<string, string> = {
  "X-BRING-API-KEY": BRING_API_KEY,
  "X-BRING-CLIENT": "webApp",
  "X-BRING-CLIENT-SOURCE": "webApp",
  "X-BRING-COUNTRY": "DE",
  "X-BRING-APPLICATION": "bring",
};

export interface BringAuth {
  accessToken: string;
  refreshToken: string;
  userUuid: string;
  publicUuid: string;
  /** Name des Bring!-Kontos, wie ihn die API zurückgibt (für die Anzeige). */
  name?: string;
}

export interface BringList {
  listUuid: string;
  name: string;
  theme?: string;
}

/** Eine zu pushende Position: Name + optionale Spezifikation (Menge/Notiz). */
export interface BringPushItem {
  name: string;
  spec?: string;
}

export interface BringPushResult {
  pushed: number;
  failed: number;
}

/** Eine gelesene Bring!-Position: Name (itemId) + freie Spezifikation. */
export interface BringListItem {
  name: string;
  spec: string;
}

/** Aktueller Inhalt einer Bring!-Liste: offene Positionen + zuletzt gekaufte. */
export interface BringListContents {
  purchase: BringListItem[];
  recently: BringListItem[];
}

export interface BringClientDeps {
  fetch?: typeof fetch;
}

/** Fehler der Bring!-API mit HTTP-Status, damit der Aufrufer 401 o. Ä. erkennt. */
export class BringApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BringApiError";
  }
}

function resolveFetch(deps?: BringClientDeps): typeof fetch {
  const impl = deps?.fetch ?? globalThis.fetch;
  if (!impl) {
    throw new Error("Kein fetch verfügbar — Node 18+ oder fetch injizieren.");
  }
  return impl;
}

function authHeaders(auth: BringAuth): Record<string, string> {
  return {
    ...BASE_HEADERS,
    Authorization: `Bearer ${auth.accessToken}`,
    "X-BRING-USER-UUID": auth.userUuid,
    "X-BRING-PUBLIC-USER-UUID": auth.publicUuid,
  };
}

/**
 * Meldet sich mit E-Mail + Passwort an und liefert Tokens + User-UUIDs.
 * Wirft `BringApiError(…, 401)` bei falschen Zugangsdaten.
 */
export async function bringLogin(
  email: string,
  password: string,
  deps?: BringClientDeps,
): Promise<BringAuth> {
  const doFetch = resolveFetch(deps);
  const body = new URLSearchParams({ email, password });

  const response = await doFetch(`${BRING_BASE_URL}/v2/bringauth`, {
    method: "POST",
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new BringApiError(
      response.status === 401
        ? "Anmeldung bei Bring! fehlgeschlagen — E-Mail oder Passwort falsch."
        : `Bring!-Login fehlgeschlagen (HTTP ${response.status}).`,
      response.status,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const accessToken = String(data.access_token ?? "");
  const userUuid = String(data.uuid ?? "");
  if (!accessToken || !userUuid) {
    throw new BringApiError("Bring!-Login lieferte keine gültige Sitzung.", 502);
  }

  return {
    accessToken,
    refreshToken: String(data.refresh_token ?? ""),
    userUuid,
    publicUuid: String(data.publicUuid ?? ""),
    name: typeof data.name === "string" ? data.name : undefined,
  };
}

/** Lädt alle Einkaufslisten des angemeldeten Kontos. */
export async function bringLoadLists(
  auth: BringAuth,
  deps?: BringClientDeps,
): Promise<BringList[]> {
  const doFetch = resolveFetch(deps);
  const response = await doFetch(
    `${BRING_BASE_URL}/bringusers/${auth.userUuid}/lists`,
    { method: "GET", headers: authHeaders(auth) },
  );

  if (!response.ok) {
    throw new BringApiError(
      `Bring!-Listen konnten nicht geladen werden (HTTP ${response.status}).`,
      response.status,
    );
  }

  const data = (await response.json()) as { lists?: unknown };
  const lists = Array.isArray(data.lists) ? data.lists : [];
  return lists
    .map((entry): BringList | null => {
      const record = entry as Record<string, unknown>;
      const listUuid = String(record.listUuid ?? "");
      if (!listUuid) return null;
      return {
        listUuid,
        name: String(record.name ?? "Bring!-Liste"),
        theme: typeof record.theme === "string" ? record.theme : undefined,
      };
    })
    .filter((list): list is BringList => list !== null);
}

/** Normalisiert ein Roh-Item beider API-Versionen (v1: name/specification, v2: itemId/spec). */
function parseListItems(value: unknown): BringListItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): BringListItem | null => {
      const record = entry as Record<string, unknown>;
      const name = String(record.itemId ?? record.name ?? "").trim();
      if (!name) return null;
      return { name, spec: String(record.spec ?? record.specification ?? "").trim() };
    })
    .filter((item): item is BringListItem => item !== null);
}

/**
 * Liest den aktuellen Inhalt einer Bring!-Liste (offene + zuletzt gekaufte
 * Positionen). Toleriert sowohl das flache v1-Format (`{ purchase, recently }`)
 * als auch das v2-Format (`{ items: { purchase, recently } }`).
 */
export async function bringGetListItems(
  auth: BringAuth,
  listUuid: string,
  deps?: BringClientDeps,
): Promise<BringListContents> {
  const doFetch = resolveFetch(deps);
  const response = await doFetch(`${BRING_BASE_URL}/bringlists/${listUuid}`, {
    method: "GET",
    headers: authHeaders(auth),
  });

  if (!response.ok) {
    throw new BringApiError(
      `Bring!-Liste konnte nicht gelesen werden (HTTP ${response.status}).`,
      response.status,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const container =
    data.items && typeof data.items === "object"
      ? (data.items as Record<string, unknown>)
      : data;

  return {
    purchase: parseListItems(container.purchase),
    recently: parseListItems(container.recently),
  };
}

/**
 * Legt eine einzelne Position auf einer Bring!-Liste an. Nutzt bewusst den
 * stabilen Legacy-Endpoint (`PUT bringlists/{uuid}`, form-encoded) statt der
 * neueren Batch-API — er ist über alle Community-Clients hinweg am robustesten.
 */
async function bringSaveItem(
  auth: BringAuth,
  listUuid: string,
  item: BringPushItem,
  deps?: BringClientDeps,
): Promise<void> {
  const doFetch = resolveFetch(deps);
  const body = new URLSearchParams({
    uuid: listUuid,
    purchase: item.name,
    specification: item.spec ?? "",
  });

  const response = await doFetch(`${BRING_BASE_URL}/bringlists/${listUuid}`, {
    method: "PUT",
    headers: {
      ...authHeaders(auth),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new BringApiError(
      `Position „${item.name}" konnte nicht gepusht werden (HTTP ${response.status}).`,
      response.status,
    );
  }
}

/**
 * Schiebt mehrere Positionen auf eine Bring!-Liste. Parallel mit
 * Teilfehler-Toleranz: gibt zurück, wie viele erfolgreich waren — eine kaputte
 * Position lässt den Rest nicht scheitern.
 */
export async function bringPushItems(
  auth: BringAuth,
  listUuid: string,
  items: BringPushItem[],
  deps?: BringClientDeps,
): Promise<BringPushResult> {
  const outcomes = await Promise.allSettled(
    items.map((item) => bringSaveItem(auth, listUuid, item, deps)),
  );

  let pushed = 0;
  let failed = 0;
  for (const outcome of outcomes) {
    if (outcome.status === "fulfilled") pushed += 1;
    else failed += 1;
  }
  return { pushed, failed };
}

/** Maskiert eine E-Mail für die Anzeige, z. B. `a***@example.com`. */
export function maskBringEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}
