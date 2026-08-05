import fs from "node:fs";
import path from "node:path";

/**
 * Family bekommt den DAV-Methoden-Proxy vorgeschaltet: der iOS-CalDAV-Account
 * spricht PROPFIND/REPORT, Next-Route-Handler kennen diese Methoden nicht.
 * Der Proxy hält den Service-Port und startet den eigentlichen Server als
 * Kind auf dem Upstream-Port (Loopback). Fehlt das Skript (Bundle-Install
 * ohne deploy/), startet Family direkt — dann ohne CalDAV-Funktion.
 *
 * Gegenstück für den systemd-Weg: deploy/scripts/start-uwe.sh.
 */

export function familyDavProxyPath(root: string): string {
  return path.join(root, "deploy", "scripts", "uwe-dav-proxy.mjs");
}

export function shouldUseFamilyDavProxy(root: string, serviceId: string): boolean {
  return serviceId === "family" && fs.existsSync(familyDavProxyPath(root));
}

/** Interner Port des Next-Servers hinter dem Proxy. */
export function familyDavUpstreamPort(servicePort: number): number {
  return servicePort + 10;
}

/**
 * Wickelt das berechnete Spawn-Kommando in den Proxy ein. `env.PORT` und
 * `env.HOSTNAME` gehören danach dem Proxy — er setzt beides für das Kind.
 */
export function wrapSpawnWithFamilyDavProxy(input: {
  root: string;
  servicePort: number;
  spawnArgs: string[];
  spawnCwd: string;
  nodeBin: string;
  env: Record<string, string | undefined>;
}): { spawnArgs: string[]; spawnCwd: string } {
  delete input.env.PORT;
  delete input.env.HOSTNAME;
  return {
    spawnArgs: [
      familyDavProxyPath(input.root),
      "--listen",
      String(input.servicePort),
      "--upstream",
      String(familyDavUpstreamPort(input.servicePort)),
      "--host",
      "127.0.0.1",
      "--child-cwd",
      input.spawnCwd,
      "--",
      input.nodeBin,
      ...input.spawnArgs,
    ],
    spawnCwd: input.root,
  };
}
