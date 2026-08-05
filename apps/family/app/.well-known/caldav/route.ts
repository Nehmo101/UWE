/**
 * CalDAV-Discovery (RFC 6764): Clients fragen `/.well-known/caldav` an und
 * folgen dem Redirect zum DAV-Einstieg. iOS schickt hier auch PROPFIND — das
 * kommt vom DAV-Proxy als POST übersetzt an. Kein Auth nötig: die Antwort ist
 * nur ein Verweis.
 */

export const dynamic = "force-dynamic";

function redirect(): Response {
  return new Response(null, { status: 301, headers: { Location: "/api/dav" } });
}

export async function GET() {
  return redirect();
}

export async function POST() {
  return redirect();
}
