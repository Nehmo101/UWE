import { NextResponse } from "next/server";
import { canUseRtxAi } from "@uwe/auth";
import { requireSameOriginMutation } from "@uwe/security";
import { canEnterBrain } from "@/src/lib/owner";
import { getCurrentUser } from "@/src/lib/auth";
import { checkRateLimit, clientIpFromHeaders, RATE_LIMIT_PRESETS } from "@/src/lib/rate-limit";

/**
 * Guard für die Mail-Routen.
 *
 * In Studio hingen dieselben Routen an den API-Token-Scopes `mail_read` und
 * `mail_send`, damit ein Skript von außen ans Postfach kommt. In Brain gibt es
 * keine Token und keine Scopes: entweder die angemeldete Adresse trägt das
 * Häkchen `Brain`, oder sie kommt nicht rein. Das ist der Sinn der Verlegung —
 * das Postfach ist Alltag, und Alltag ist owner-privat.
 *
 * Die Same-Origin-Prüfung steht hier ausgeschrieben, weil Brain kein
 * `guardStudioApiMutation` hat: ohne sie wäre jede Mail-Mutation für jede Seite
 * erreichbar, die der angemeldete Owner nebenbei offen hat.
 */

export interface MailApiAuth {
  error: Response | null;
  user: { id: string } | null;
}

async function requireBrainUser(): Promise<MailApiAuth> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }), user: null };
  }
  if (!canEnterBrain(user)) {
    return {
      error: NextResponse.json({ error: "Kein Zugang zum Bereich Brain." }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user: { id: user.id } };
}

/** Lesende Mail-Route: Häkchen `Brain` genügt. */
export async function requireBrainMailApi(): Promise<MailApiAuth> {
  return requireBrainUser();
}

/**
 * Mail-Route, die den RTX-Host beschäftigt (Zusammenfassung, Antwortentwurf,
 * Postfach-Chat): zusätzlich zum Häkchen `Brain` braucht sie das KI-Flag.
 * Der Owner geht über `canUseRtxAi` durch.
 */
export async function requireBrainMailAi(request: Request): Promise<MailApiAuth> {
  const auth = await requireBrainMailMutation(request, "ai");
  if (auth.error) return auth;

  const user = await getCurrentUser();
  if (!user || !canUseRtxAi(user)) {
    return {
      error: NextResponse.json(
        {
          error:
            "Für dieses Konto ist die RTX-KI nicht freigeschaltet. Der Owner richtet das im Command Center ein.",
        },
        { status: 403 },
      ),
      user: null,
    };
  }
  return auth;
}

/** Schreibende Mail-Route: Häkchen, gleiche Herkunft, Rate-Limit. */
export async function requireBrainMailMutation(
  request: Request,
  preset: keyof typeof RATE_LIMIT_PRESETS = "setup",
): Promise<MailApiAuth> {
  const auth = await requireBrainUser();
  if (auth.error) return auth;

  const csrfError = requireSameOriginMutation(request);
  if (csrfError) return { error: csrfError, user: null };

  const ip = clientIpFromHeaders(request.headers);
  const limit = checkRateLimit(`brain-mail:${preset}:${ip}`, RATE_LIMIT_PRESETS[preset]);
  if (!limit.allowed) {
    return {
      error: NextResponse.json(
        { error: "Zu viele Anfragen. Bitte kurz warten." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      ),
      user: null,
    };
  }

  return auth;
}

export function mailApiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
