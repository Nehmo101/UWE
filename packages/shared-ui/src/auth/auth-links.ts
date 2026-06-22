import { resolveUweAppUrls } from "@uwe/auth";

export type UweAuthApp = "studio" | "portal";

export interface AuthLinkTargets {
  studioHref: string;
  portalHref: string;
  loginHref: string;
  logoutHref: string;
}

const DEV_STUDIO_URL = "http://localhost:3000";
const DEV_PORTAL_URL = "http://localhost:3001";

function trimBaseUrl(url: string | undefined): string {
  return url?.replace(/\/$/, "") ?? "";
}

export function resolveAuthLinks(options: {
  isLoggedIn: boolean;
  currentApp: UweAuthApp;
  studioBaseUrl?: string;
  portalBaseUrl?: string;
}): AuthLinkTargets {
  const studioBase = trimBaseUrl(options.studioBaseUrl);
  const portalBase = trimBaseUrl(options.portalBaseUrl);

  const loginHref = "/login";
  const logoutHref = options.currentApp === "studio" ? "/logout" : loginHref;

  if (!options.isLoggedIn) {
    return {
      studioHref: options.currentApp === "studio" ? loginHref : `${studioBase}${loginHref}`,
      portalHref: options.currentApp === "portal" ? loginHref : `${portalBase}${loginHref}`,
      loginHref,
      logoutHref,
    };
  }

  const studioPath = "/studio";
  const portalPath = "/portal";

  return {
    studioHref: options.currentApp === "studio" ? studioPath : `${studioBase}${studioPath}`,
    portalHref: options.currentApp === "portal" ? portalPath : `${portalBase}${portalPath}`,
    loginHref,
    logoutHref,
  };
}

export function readPublicAppUrls(
  env: NodeJS.ProcessEnv = process.env,
): { studioBaseUrl: string; portalBaseUrl: string } {
  const urls = resolveUweAppUrls(env);

  return {
    studioBaseUrl: urls.studioUrl ?? DEV_STUDIO_URL,
    portalBaseUrl: urls.portalUrl ?? DEV_PORTAL_URL,
  };
}
