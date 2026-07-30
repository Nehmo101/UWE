import fs from "node:fs";

import { appendOperationLog, ensureHostDirectories, pidFile } from "./desktop-host-paths.ts";
import {
  listenerPids,
  probeHealth,
  processRunning,
  readPid,
  stopProcess,
} from "./desktop-host-system.ts";
import {
  HOST_SERVICE_LABELS,
  isOwnServiceApp,
  type HostPaths,
  type HostServiceId,
  type ServiceDefinition,
} from "./desktop-host-types.ts";

/**
 * Wem gehört ein belegter Dienstport?
 *
 * Ohne diese Unterscheidung galt jeder antwortende Port ohne PID-Datei als
 * fremd. Ein Rest einer früheren Sitzung (App abgestürzt, hart beendet,
 * PID-Datei verloren) war damit über kein Bedienelement mehr erreichbar:
 * „Alles stoppen" läuft nur über PID-Dateien und ging an ihm vorbei, „Alles
 * starten" blockierte an ihm. Grundlage der Zuordnung ist die Selbstauskunft
 * aus `/api/health` — nur wer sich als genau diese App ausweist, gehört uns.
 */

/**
 * Ein Dienst, der einen unserer Ports hält, ohne dass wir eine PID-Datei dazu
 * haben. „orphan" ist ein Rest von uns; „foreign" ist wirklich fremd und wird
 * nie angefasst.
 */
export interface PortHolder {
  service: ServiceDefinition;
  kind: "orphan" | "foreign";
}

export async function classifyPortHolder(
  paths: HostPaths,
  service: ServiceDefinition,
): Promise<PortHolder | null> {
  if (processRunning(readPid(pidFile(paths, service.id)))) return null; // gehört uns bereits
  const probe = await probeHealth(`http://127.0.0.1:${service.port}`);
  if (!probe.responding) return null; // Port frei
  return { service, kind: isOwnServiceApp(service.id, probe.app) ? "orphan" : "foreign" };
}

/**
 * Nimmt einen verwaisten eigenen Prozess wieder in Besitz: PID über den Port
 * ermitteln und die PID-Datei nachziehen. Danach greifen Status, Stopp und
 * Neustart wieder ganz normal.
 *
 * Nur bei genau einem lauschenden Prozess — bei mehreren (etwa zwei Resten auf
 * IPv4 und IPv6) wüssten wir nicht, welcher der Dienst ist; die räumt der Start
 * stattdessen weg.
 */
export function adoptOrphanService(paths: HostPaths, id: HostServiceId, port: number): number | null {
  const pids = listenerPids(port);
  if (pids.length !== 1) return null;
  ensureHostDirectories(paths);
  fs.writeFileSync(pidFile(paths, id), String(pids[0]), "utf8");
  appendOperationLog(paths, `${HOST_SERVICE_LABELS[id]}: verwaisten Prozess ${pids[0]} auf Port ${port} übernommen.`);
  return pids[0];
}

/**
 * Beendet die Reste einer früheren Sitzung auf dem Port eines Dienstes und
 * meldet, ob der Port danach frei ist. Beendet ausschließlich Prozesse, die
 * sich unmittelbar davor per `/api/health` als genau diese App ausgewiesen
 * haben — ein fremder Dienst bleibt unangetastet.
 */
export async function releaseOwnPort(paths: HostPaths, service: ServiceDefinition): Promise<boolean> {
  const url = `http://127.0.0.1:${service.port}`;
  const probe = await probeHealth(url);
  if (!probe.responding) return true;
  if (!isOwnServiceApp(service.id, probe.app)) return false;

  const pids = listenerPids(service.port);
  if (pids.length === 0) {
    appendOperationLog(
      paths,
      `${service.label}: Port ${service.port} ist belegt, der zugehörige Prozess ließ sich nicht ermitteln.`,
    );
    return false;
  }
  for (const pid of pids) stopProcess(pid);
  appendOperationLog(
    paths,
    `${service.label}: verwaiste Prozesse (${pids.join(", ")}) auf Port ${service.port} beendet.`,
  );
  fs.rmSync(pidFile(paths, service.id), { force: true });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!(await probeHealth(url)).responding) return true;
  }
  return false;
}
