/*
 * UWE Portal — Service Worker für den Tischmodus.
 *
 * Handgeschrieben und bewusst klein: kein Workbox, keine Build-Stufe, keine
 * zusätzliche Abhängigkeit. Er tut genau drei Dinge:
 *
 *   1. Er hält die Hülle des Tischmodus (`/auth/tisch`) vor, damit sie ohne
 *      Netz noch lädt. Die Inhalte kommen nicht von hier, sondern aus dem
 *      lokalen Speicher der Seite — dieser Worker cached keine API-Antworten.
 *   2. Er cached die statischen Bausteine von Next (`/_next/static/…`), ohne
 *      die die Hülle nicht rendert.
 *   3. Er fängt fehlgeschlagene Navigationen ab und zeigt statt der
 *      Browser-Fehlerseite den Tischmodus.
 *
 * **Was er absichtlich NICHT tut:** andere angemeldete Seiten zwischenspeichern.
 * Ein Portal-Gerät wird herumgereicht; im Cache landet nur eine Hülle ohne
 * Nutzerdaten. Beim Abmelden räumt die Seite per `uwe-offline-clear` alles weg.
 */

const CACHE_NAME = "uwe-portal-tisch-v1";

const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const TABLE_MODE_PATH = `${SCOPE_PATH}/auth/tisch`;
const STATIC_PREFIX = `${SCOPE_PATH}/_next/static/`;

function isTableModePath(pathname) {
  return pathname === TABLE_MODE_PATH || pathname === `${TABLE_MODE_PATH}/`;
}

function isCacheableAsset(pathname) {
  return (
    pathname.startsWith(STATIC_PREFIX) ||
    pathname === `${SCOPE_PATH}/icon.svg` ||
    pathname === `${SCOPE_PATH}/manifest.webmanifest`
  );
}

function isStorable(response) {
  return Boolean(response) && response.ok && response.type === "basic";
}

/*
 * Die Hülle wird immer unter demselben Schlüssel abgelegt — ohne Query.
 * Der Einstieg aus einer Welt trägt `?welt=…`; ohne diese Vereinheitlichung
 * läge für jede Welt eine eigene Kopie im Cache und der Aufruf ohne Query
 * fände keine.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (isStorable(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(TABLE_MODE_PATH, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(TABLE_MODE_PATH);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isStorable(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

/**
 * Fehlgeschlagene Navigation: lieber der Tischmodus als die Dinosaurier-Seite.
 * Ist er noch nie geöffnet worden, liegt nichts im Cache — dann bleibt es beim
 * Fehler, statt etwas Falsches vorzugaukeln.
 */
async function navigationFallback(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(TABLE_MODE_PATH);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(isTableModePath(url.pathname) ? networkFirst(request) : navigationFallback(request));
    return;
  }

  if (isCacheableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "uwe-offline-clear") {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      })(),
    );
  }
});
