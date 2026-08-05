import { prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createCalendarService } from "@uwe/database/calendar-service";
import {
  createFamilyCalDavAccountService,
  createFamilyCalDavServer,
} from "@uwe/family-core";

/**
 * CalDAV-Endpunkt für den iPhone-Kalender (lesen UND schreiben).
 *
 * Bewusst ohne Sitzungs-Guard und darum in `FAMILY_PUBLIC_API_ALLOWLIST`
 * (`packages/security-tests`) und `FAMILY_PUBLIC_ROUTES` (`packages/auth`)
 * eingetragen: ein CalDAV-Client authentifiziert per HTTP Basic mit einem
 * eigenen Token-Typ (`uwedav_…`, nur als Hash gespeichert, einzeln
 * widerrufbar) — geprüft hier im Handler. Cookies werden nie ausgewertet,
 * CSRF greift deshalb nicht.
 *
 * PROPFIND/REPORT kommen als `POST` mit `x-uwe-dav-method` an — übersetzt vom
 * DAV-Proxy (`deploy/scripts/uwe-dav-proxy.mjs`), der den Header auf jedem
 * eingehenden Request strippt, bevor er ihn selbst setzt. Die Protokoll-Logik
 * liegt in `@uwe/family-core` (`caldav-server.ts`), diese Route ist Transport.
 */

export const dynamic = "force-dynamic";

const DAV_RESPONSE_HEADER = "1, calendar-access";

function unauthorized(): Response {
  return new Response("Anmeldung erforderlich.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="UWE Family"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

async function handleDav(request: Request, davMethod: string | null): Promise<Response> {
  const accounts = createFamilyCalDavAccountService(familyPrisma);
  const account = await accounts.resolveBasicAuth(request.headers.get("authorization"));
  if (!account) return unauthorized();
  await accounts.markUsed(account.id);

  const server = createFamilyCalDavServer(
    familyPrisma,
    createCalendarService(familyPrisma, prisma),
  );
  const result = await server.handle({
    method: request.method,
    davMethod,
    pathname: new URL(request.url).pathname,
    depth: request.headers.get("depth"),
    ifMatch: request.headers.get("if-match"),
    ifNoneMatch: request.headers.get("if-none-match"),
    body: await request.text(),
  });

  return new Response(result.body ?? null, { status: result.status, headers: result.headers });
}

export async function OPTIONS() {
  // iOS probt OPTIONS teils vor der Authentifizierung — die Antwort verrät
  // nur die Protokoll-Fähigkeiten, keine Daten.
  return new Response(null, {
    status: 200,
    headers: {
      DAV: DAV_RESPONSE_HEADER,
      Allow: "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT",
    },
  });
}

export async function GET(request: Request) {
  return handleDav(request, null);
}

export async function HEAD(request: Request) {
  return handleDav(request, null);
}

export async function PUT(request: Request) {
  return handleDav(request, null);
}

export async function DELETE(request: Request) {
  return handleDav(request, null);
}

export async function POST(request: Request) {
  const davMethod = request.headers.get("x-uwe-dav-method");
  if (!davMethod) {
    // Direktes POST ohne Proxy-Übersetzung ist kein CalDAV.
    return new Response("Methode nicht erlaubt.", { status: 405 });
  }
  return handleDav(request, davMethod);
}
