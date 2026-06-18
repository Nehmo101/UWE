import {
  generateIcalCalendar,
  type IcalExportEvent,
} from "./index";

export interface CalDavAuth {
  username?: string;
  password?: string;
}

export interface CalDavWriteOptions extends CalDavAuth {
  caldavUrl: string;
  timeoutMs?: number;
}

function buildAuthHeader(auth: CalDavAuth): Record<string, string> {
  if (!auth.username || !auth.password) return {};
  const token = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

export function buildCalDavEventHref(caldavUrl: string, uid: string): string {
  const base = caldavUrl.replace(/\/$/, "");
  return `${base}/${encodeURIComponent(`${uid}.ics`)}`;
}

export function eventToIcalBody(event: IcalExportEvent): string {
  return generateIcalCalendar([event], "UWE Event");
}

export async function putCalDavEvent(
  options: CalDavWriteOptions,
  event: IcalExportEvent,
  remoteHref?: string,
): Promise<{ href: string; etag: string | null }> {
  const href = remoteHref ?? buildCalDavEventHref(options.caldavUrl, event.uid);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);

  try {
    const response = await fetch(href, {
      method: "PUT",
      signal: controller.signal,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        ...buildAuthHeader(options),
      },
      body: eventToIcalBody(event),
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`CalDAV PUT fehlgeschlagen (${response.status}).`);
    }

    return {
      href,
      etag: response.headers.get("etag"),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function deleteCalDavEvent(
  options: CalDavWriteOptions,
  remoteHref: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);

  try {
    const response = await fetch(remoteHref, {
      method: "DELETE",
      signal: controller.signal,
      headers: buildAuthHeader(options),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`CalDAV DELETE fehlgeschlagen (${response.status}).`);
    }
  } finally {
    clearTimeout(timer);
  }
}
