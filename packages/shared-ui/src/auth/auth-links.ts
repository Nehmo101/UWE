export type UweAuthApp = "studio" | "portal";

export interface AuthLinkTargets {
  studioHref: string;
  portalHref: string;
  loginHref: string;
  logoutHref: string;
}

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

export function readPublicAppUrls(): { studioBaseUrl: string; portalBaseUrl: string } {
  return {
    studioBaseUrl: trimBaseUrl(process.env.NEXT_PUBLIC_STUDIO_URL),
    portalBaseUrl: trimBaseUrl(process.env.NEXT_PUBLIC_PORTAL_URL),
  };
}
