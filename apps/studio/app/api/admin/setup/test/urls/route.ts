import { NextResponse } from "next/server";
import { resolveUweAppUrls } from "@uwe/auth";
import { requireOwnerApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

async function probeUrl(url: string): Promise<{ url: string; ok: boolean; status: number | null; message: string }> {
  const healthUrl = `${url.replace(/\/$/, "")}/api/health/public`;
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return {
      url: healthUrl,
      ok: response.ok,
      status: response.status,
      message: response.ok ? "Health OK" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      url: healthUrl,
      ok: false,
      status: null,
      message: error instanceof Error ? error.message : "Anfrage fehlgeschlagen",
    };
  }
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "setup" });
  if (authError) return authError;

  const urls = resolveUweAppUrls();
  const targets = [
    { label: "Studio", url: urls.studioUrl },
    { label: "Portal", url: urls.portalUrl },
  ].filter((entry): entry is { label: string; url: string } => Boolean(entry.url));

  if (targets.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Keine Studio-/Portal-URLs konfiguriert — PUBLIC_APP_URL setzen.",
      },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    targets.map(async (target) => ({
      label: target.label,
      ...(await probeUrl(target.url)),
    })),
  );

  const ok = results.every((result) => result.ok);
  return NextResponse.json({
    ok,
    message: ok
      ? "Studio- und Portal-Health erreichbar."
      : "Mindestens eine URL antwortet nicht mit Health OK.",
    results,
  });
}
