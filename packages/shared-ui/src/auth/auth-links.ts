import {
  resolvePortalLoginHref,
  resolvePortalSessionHref,
  resolveStudioPublicBaseUrl,
  resolveStudioSessionHref,
  resolveUweAppUrls,
} from "@uwe/auth";

export type UweAuthApp = "studio" | "portal";

export interface AuthLinkTargets {
  studioHref: string;
  portalHref: string;
  loginHref: string;
  logoutHref: string;
}

const DEV_STUDIO_URL = "http://localhost:3000";
const DEV_PORTAL_URL = "http://localhost:3001";

export function resolveAuthLinks(options: {
  isLoggedIn: boolean;
  currentApp: UweAuthApp;
  studioBaseUrl?: string;
  portalBaseUrl?: string;
  env?: NodeJS.ProcessEnv;
}): AuthLinkTargets {
  const env = options.env ?? process.env;
  const loginHref = "/login";
  const logoutHref = options.currentApp === "studio" ? "/logout" : loginHref;

  if (!options.isLoggedIn) {
    return {
      studioHref:
        options.currentApp === "studio"
          ? loginHref
          : `${options.studioBaseUrl ?? resolveStudioPublicBaseUrl(env)}${loginHref}`,
      portalHref: resolvePortalLoginHref(env, { currentApp: options.currentApp }),
      loginHref,
      logoutHref,
    };
  }

  return {
    studioHref: resolveStudioSessionHref(env, { currentApp: options.currentApp }),
    portalHref: resolvePortalSessionHref(env, { currentApp: options.currentApp }),
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
