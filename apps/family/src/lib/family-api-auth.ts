import { NextResponse } from "next/server";
import { createApiTokenService, createPrismaClient } from "@uwe/database/server";
import { isApiTokenFormat, parseBearerToken, type ApiTokenScope } from "@uwe/auth";
import { requireFamilyApiAuthContext, type ApiAuthContext } from "@uwe/security";
import { getCurrentUser } from "./auth";
import { canEnterFamily } from "./family-access";

/**
 * Häkchen-Guard für Family-API-Routen.
 *
 * Dieselbe Regel wie für Seiten und Server-Actions: eine Sitzung reicht nicht,
 * die Adresse muss das Häkchen `Family` tragen. Gibt `null` zurück, wenn alles
 * passt — sonst die fertige Fehlerantwort, die die Route direkt zurückgibt.
 *
 * 401 und 403 werden bewusst unterschieden: „melde dich an" ist eine andere
 * Auskunft als „du bist angemeldet, aber nicht für Family freigeschaltet", und
 * beides verrät nichts über Inhalte.
 *
 * **Zwei Aufrufer, ein Guard.** Ohne Argumente prüft die Funktion wie bisher
 * nur die Sitzung — die Bestandsrouten ändern ihr Verhalten nicht. Bekommt sie
 * den `request`, akzeptiert sie zusätzlich einen API-Token mit den geforderten
 * Scopes. Der Name bleibt bewusst derselbe: `family-route-inventory.ts` prüft
 * per Regex, dass jede Family-Route genau diesen Guard nennt, und ein zweiter
 * Name würde diese Absicherung aushebeln.
 */
export async function requireFamilyApiAuth(
  request?: Request,
  options: { scopes?: readonly ApiTokenScope[] } = {},
): Promise<NextResponse | null> {
  if (request) {
    const context = await resolveFamilyApiAuthContext(request);
    const denied = requireFamilyApiAuthContext(request, context, {
      requiredScopes: options.scopes,
    });
    if (denied) {
      // Der Guard liefert eine Response; als NextResponse weiterreichen, damit
      // die Routen einen einheitlichen Rückgabetyp haben.
      return new NextResponse(denied.body, {
        status: denied.status,
        headers: denied.headers,
      });
    }
    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }
  if (!canEnterFamily(user)) {
    return NextResponse.json({ error: "Kein Zugang zum Bereich Family." }, { status: 403 });
  }
  return null;
}

/**
 * Löst auf, wer da anfragt: ein angemeldetes Haushalts-Mitglied oder ein
 * externer Client mit API-Token.
 *
 * Spiegel von `resolveStudioApiAuthContext`, mit einem Unterschied, der
 * dieselbe Absicht hat: das Häkchen im synthetischen Benutzer ist `family`,
 * nicht `studio`. Das KI-Flag kommt wie dort vom **Besitzer** des Tokens, nicht
 * aus dem Token — sonst wäre ein Token der Schleichweg um das Flag.
 */
export async function resolveFamilyApiAuthContext(request: Request): Promise<ApiAuthContext> {
  const bearer = parseBearerToken(request.headers.get("authorization"));

  if (bearer && isApiTokenFormat(bearer)) {
    const db = createPrismaClient();
    try {
      const resolved = await createApiTokenService(db).resolveFromBearer(
        bearer,
        request.headers,
      );
      if (resolved) {
        return {
          user: {
            id: resolved.userId,
            displayName: resolved.name,
            email: null,
            isOwner: resolved.isOwner,
            access: { portal: false, studio: false, brain: false, family: true },
            aiAccess: resolved.aiAccess,
          },
          apiTokenId: resolved.id,
          apiTokenScopes: resolved.scopes,
          authMethod: "api_token",
        };
      }
    } finally {
      await db.$disconnect();
    }
  }

  const user = await getCurrentUser();
  if (user) {
    return {
      user,
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
  }

  return { user: null, apiTokenId: null, apiTokenScopes: null, authMethod: "none" };
}
