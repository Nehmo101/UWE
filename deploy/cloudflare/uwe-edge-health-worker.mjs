/**
 * Optional Cloudflare Worker: probes UWE public endpoints and stores last result in KV.
 * Does not replace cloudflared — runs on a separate route (e.g. status.uweandragons.org).
 */

const DEFAULT_PATHS = {
  portal: "/api/health/public",
  studio: "/api/health/public",
};

async function probe(url, expectAuthBlock = false) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    const ms = Date.now() - started;
    const ok = expectAuthBlock
      ? response.status === 401 || response.status === 403 || response.status === 302
      : response.ok;
    return { url, ok, status: response.status, ms };
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const worker = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runChecks(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/run" && request.method === "POST") {
      const result = await runChecks(env);
      return Response.json(result);
    }

    const cached = await env.HEALTH.get("last", { type: "json" });
    if (!cached) {
      const fresh = await runChecks(env);
      return Response.json(fresh, { status: fresh.ok ? 200 : 503 });
    }

    return Response.json(cached, { status: cached.ok ? 200 : 503 });
  },
};

export default worker;

async function runChecks(env) {
  const portalBase = (env.UWE_PORTAL_URL || env.UWE_PUBLIC_URL || "https://uweanddragons.org").replace(
    /\/$/,
    "",
  );
  const studioBase = (env.UWE_STUDIO_URL || "https://studio.uweanddragons.org").replace(/\/$/, "");
  const portalPath = env.UWE_PORTAL_HEALTH_PATH || DEFAULT_PATHS.portal;
  const studioPath = env.UWE_STUDIO_HEALTH_PATH || DEFAULT_PATHS.studio;

  const portal = await probe(`${portalBase}${portalPath}`);
  const studio = await probe(`${studioBase}${studioPath}`, true);

  const payload = {
    ok: portal.ok && studio.ok,
    checkedAt: new Date().toISOString(),
    portalBase,
    studioBase,
    probes: { portal, studio },
  };

  await env.HEALTH.put("last", JSON.stringify(payload), { expirationTtl: 86400 });
  return payload;
}
