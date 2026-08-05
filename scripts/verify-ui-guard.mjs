/**
 * Startsperre für `pnpm verify:ui`.
 *
 * Der Verifikationslauf baut `apps/*​/.next` neu. **Genau aus diesem Verzeichnis
 * bedienen die laufenden Live-Dienste** (`desktop-host.ts` startet
 * `apps/<id>/.next/standalone/apps/<id>/server.js`). Wer den Lauf im
 * Haupt-Arbeitsbaum startet, während die Dienste laufen, reißt damit
 * uweanddragons.org mitten im Betrieb herunter.
 *
 * Deshalb entscheidet dieses Modul vor jedem Start, ob gestartet werden darf.
 * Die Entscheidung selbst ist eine reine Funktion — das Sammeln der Tatsachen
 * (Git-Verzeichnis, antwortende Ports) steht daneben und ist ersetzbar.
 */

import net from "node:net";

/**
 * Entscheidet über den Start.
 *
 * @param {object} facts
 * @param {boolean} facts.isMainWorktree  Läuft im Haupt-Arbeitsbaum (nicht in einem `git worktree`)?
 * @param {number[]} facts.livePorts      Ports der Live-Dienste laut `.env`.
 * @param {number[]} facts.respondingLivePorts  Davon die, die gerade antworten.
 * @param {number[]} facts.verifyPorts    Ports, die der Verifikationslauf belegen will.
 * @returns {{allowed: boolean, reason: string|null, message: string}}
 */
export function assessRunLocation(facts) {
  const { isMainWorktree, livePorts, respondingLivePorts, verifyPorts } = facts;

  const collision = verifyPorts.filter((port) => livePorts.includes(port));
  if (collision.length > 0) {
    return {
      allowed: false,
      reason: "port-collision",
      message:
        `Der Verifikationslauf will Port ${collision.join(", ")} belegen — dort liegen die ` +
        `Live-Dienste. Setze E2E_STUDIO_PORT/E2E_PORTAL_PORT auf freie Ports (Vorgabe 3199/3200).`,
    };
  }

  if (isMainWorktree && respondingLivePorts.length > 0) {
    return {
      allowed: false,
      reason: "live-services-in-main-worktree",
      message:
        `Hier laufen Live-Dienste (Port ${respondingLivePorts.join(", ")} antwortet), und dies ist ` +
        `der Haupt-Arbeitsbaum. Der Lauf würde apps/*/.next neu bauen — genau das Verzeichnis, aus ` +
        `dem diese Dienste bedienen, und damit die öffentliche Seite herunterreißen.\n\n` +
        `Stattdessen einen eigenen Arbeitsbaum benutzen:\n` +
        `  git worktree add ../UWE-verify -b verify/<thema> origin/main\n` +
        `  cd ../UWE-verify && pnpm install && pnpm verify:ui …`,
    };
  }

  if (isMainWorktree) {
    return {
      allowed: true,
      reason: null,
      message:
        "Hinweis: Lauf im Haupt-Arbeitsbaum. Zurzeit antwortet kein Live-Dienst, der Lauf ist " +
        "deshalb unbedenklich — sobald Dienste laufen, wird er verweigert.",
    };
  }

  return { allowed: true, reason: null, message: "" };
}

/**
 * Prüft und normalisiert eine Route.
 *
 * Git Bash auf Windows schreibt Argumente um, die wie ein Unix-Pfad aussehen:
 * aus `--routen "/worlds/terra/dashboard"` wird
 * `C:/Program Files/Git/worlds/terra/dashboard`. Der Lauf holt dann eine Seite,
 * die es nicht gibt, und der Fehler sieht aus wie ein Anwendungsfehler. Deshalb
 * wird eine so verunstaltete Route erkannt und benannt, statt sie zu raten.
 *
 * @returns {{ok: true, route: string} | {ok: false, message: string}}
 */
export function normalizeRoute(input) {
  const route = String(input).trim();
  if (!route) return { ok: false, message: "Leere Route." };

  if (/^[A-Za-z]:[\\/]/.test(route)) {
    return {
      ok: false,
      message:
        `„${route}" ist keine Route, sondern ein Dateipfad — Git Bash hat den führenden „/" ` +
        `umgeschrieben.\nRouten ohne führenden Schrägstrich angeben ` +
        `(--routen "worlds/terra/kampagnen") oder MSYS_NO_PATHCONV=1 setzen.`,
    };
  }

  return { ok: true, route: route.startsWith("/") ? route : `/${route}` };
}

/** Antwortet auf 127.0.0.1:<port> etwas? Kurzer TCP-Verbindungsversuch. */
export function isPortAnswering(port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (answering) => {
      socket.destroy();
      resolve(answering);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

/**
 * Live-Ports aus einer `.env`-Datei lesen.
 *
 * Bewusst ohne dotenv: Die Datei enthält Geheimnisse, und hier werden genau
 * fünf Zahlen gebraucht.
 */
export function readLivePorts(envContent) {
  const keys = ["STUDIO_PORT", "PORTAL_PORT", "BRAIN_PORT", "LANDING_PORT", "FAMILY_PORT"];
  const ports = [];
  for (const key of keys) {
    const match = envContent.match(new RegExp(`^${key}\\s*=\\s*(\\d+)`, "m"));
    if (match) ports.push(Number(match[1]));
  }
  return ports;
}
