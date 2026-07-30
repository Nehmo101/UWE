import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { applySelectedPorts, buildLocalHostEnv, companionUrlUpdates } from "./host-env-file.ts";
import { normalizeInstallSelection, readServicePort } from "./install-selection.ts";
import type { HostPaths } from "./desktop-host-types.ts";

/**
 * Die im Ersteinrichtungs-Assistenten gewählten Ports auf dem Weg in die `.env`.
 *
 * Zwei Wege führen dorthin, und beide werden hier festgehalten: eine frisch
 * angelegte Datei bringt die Ports mit, eine bestehende bekommt sie nachgezogen.
 * Der heikle Teil ist die zweite Hälfte — die Loopback-URLs müssen mitwandern,
 * eine öffentliche Tunnel-Adresse aber unangetastet bleiben.
 */

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-host-ports-"));
  temporaryDirectories.push(directory);
  return directory;
}

function hostPaths(root: string): HostPaths {
  const data = path.join(root, "data");
  fs.mkdirSync(data, { recursive: true });
  return {
    root,
    dataRoot: root,
    data,
    uploads: path.join(data, "uploads"),
    backups: path.join(data, "backups"),
    exports: path.join(data, "exports"),
    logs: path.join(root, "logs"),
    runtime: path.join(root, "runtime"),
    database: path.join(data, "uwe.db"),
    envFile: path.join(root, ".env"),
  } as HostPaths;
}

function writeEnv(paths: HostPaths, lines: string[]): void {
  fs.writeFileSync(paths.envFile, `${lines.join("\n")}\n`, "utf8");
}

function readEnv(paths: HostPaths): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(paths.envFile, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq < 1 || line.trim().startsWith("#")) continue;
    values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return values;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("Portwahl der Ersteinrichtung", () => {
  it("schreibt gewählte Ports samt Loopback-URLs in eine neue .env", () => {
    const env = buildLocalHostEnv(hostPaths(temporaryDirectory()), { studio: 4000, brain: 4002 });

    assert.match(env, /^STUDIO_PORT=4000$/m);
    assert.match(env, /^BRAIN_PORT=4002$/m);
    // Nicht gewählt: der Standard des Dienstes.
    assert.match(env, /^PORTAL_PORT=3001$/m);
    assert.match(env, /^NEXT_PUBLIC_STUDIO_URL=http:\/\/127\.0\.0\.1:4000$/m);
    assert.match(env, /^PUBLIC_BASE_URL=http:\/\/127\.0\.0\.1:4000$/m);
  });

  it("zieht Ports und die zugehörigen Loopback-URLs in einer bestehenden .env nach", () => {
    const paths = hostPaths(temporaryDirectory());
    writeEnv(paths, [
      "STUDIO_PORT=3000",
      "PORTAL_PORT=3001",
      "NEXT_PUBLIC_STUDIO_URL=http://127.0.0.1:3000",
      "NEXT_PUBLIC_PORTAL_URL=http://localhost:3001",
      "AUTH_REQUIRED=true",
    ]);

    const written = applySelectedPorts(paths, { studio: 4000, portal: 4001 });
    const values = readEnv(paths);

    assert.deepEqual(values.STUDIO_PORT, "4000");
    assert.deepEqual(values.PORTAL_PORT, "4001");
    assert.equal(values.NEXT_PUBLIC_STUDIO_URL, "http://127.0.0.1:4000");
    assert.equal(values.NEXT_PUBLIC_PORTAL_URL, "http://127.0.0.1:4001");
    assert.equal(values.AUTH_REQUIRED, "true", "unbeteiligte Schlüssel bleiben unberührt");
    assert.ok(written.includes("STUDIO_PORT"));
  });

  it("lässt eine öffentliche Adresse in Ruhe — die gehört dem Tunnel, nicht dem Port", () => {
    const paths = hostPaths(temporaryDirectory());
    writeEnv(paths, [
      "STUDIO_PORT=3000",
      "NEXT_PUBLIC_STUDIO_URL=https://studio.uweanddragons.org",
      "PUBLIC_BASE_URL=https://uweanddragons.org",
    ]);

    applySelectedPorts(paths, { studio: 4000 });
    const values = readEnv(paths);

    assert.equal(values.STUDIO_PORT, "4000");
    assert.equal(values.NEXT_PUBLIC_STUDIO_URL, "https://studio.uweanddragons.org");
    assert.equal(values.PUBLIC_BASE_URL, "https://uweanddragons.org");
  });

  it("meldet nichts und schreibt nichts, wenn der Port schon stimmt", () => {
    const paths = hostPaths(temporaryDirectory());
    writeEnv(paths, ["STUDIO_PORT=4000"]);
    const logged: string[] = [];

    const written = applySelectedPorts(paths, { studio: 4000 }, (line) => logged.push(line));

    assert.deepEqual(written, []);
    assert.deepEqual(logged, []);
  });

  it("nimmt für einen Dienst ohne Eintrag in der .env dessen Standard als Ausgangswert", () => {
    const paths = hostPaths(temporaryDirectory());
    // Kein BRAIN_PORT in der Datei: Ausgangswert ist der Standard 3102.
    writeEnv(paths, ["NEXT_PUBLIC_BRAIN_URL=http://127.0.0.1:3102"]);

    applySelectedPorts(paths, { brain: 4002 });
    const values = readEnv(paths);

    assert.equal(values.BRAIN_PORT, "4002");
    assert.equal(values.NEXT_PUBLIC_BRAIN_URL, "http://127.0.0.1:4002");
  });
});

describe("Portänderung im Deployment-Editor", () => {
  it("zieht die Loopback-URL mit, obwohl das Formular den alten Wert mitschickt", () => {
    const paths = hostPaths(temporaryDirectory());
    writeEnv(paths, ["STUDIO_PORT=3100", "NEXT_PUBLIC_STUDIO_URL=http://127.0.0.1:3100"]);

    // So speichert die Oberfläche: alle Felder, der Port geändert, die URL nicht.
    const companions = companionUrlUpdates(paths.envFile, {
      STUDIO_PORT: "3200",
      NEXT_PUBLIC_STUDIO_URL: "http://127.0.0.1:3100",
    });

    assert.deepEqual(companions, { NEXT_PUBLIC_STUDIO_URL: "http://127.0.0.1:3200" });
  });

  it("lässt eine im selben Speichern von Hand geänderte URL gewinnen", () => {
    const paths = hostPaths(temporaryDirectory());
    writeEnv(paths, ["STUDIO_PORT=3100", "NEXT_PUBLIC_STUDIO_URL=http://127.0.0.1:3100"]);

    const companions = companionUrlUpdates(paths.envFile, {
      STUDIO_PORT: "3200",
      NEXT_PUBLIC_STUDIO_URL: "https://studio.uweanddragons.org",
    });

    assert.deepEqual(companions, {});
  });

  it("fasst nichts an, wenn der Port gleich bleibt", () => {
    const paths = hostPaths(temporaryDirectory());
    writeEnv(paths, ["STUDIO_PORT=3100", "NEXT_PUBLIC_STUDIO_URL=http://127.0.0.1:3100"]);

    assert.deepEqual(companionUrlUpdates(paths.envFile, { STUDIO_PORT: "3100" }), {});
  });

  it("rührt die öffentliche Family-Adresse beim Portwechsel nicht an", () => {
    const paths = hostPaths(temporaryDirectory());
    writeEnv(paths, [
      "FAMILY_PORT=3004",
      "NEXT_PUBLIC_FAMILY_URL=https://family.uweanddragons.org",
    ]);

    assert.deepEqual(companionUrlUpdates(paths.envFile, { FAMILY_PORT: "3104" }), {});
  });
});

describe("Portwerte der Auswahl-Datei", () => {
  it("nimmt ganze Zahlen im erlaubten Bereich an", () => {
    assert.equal(readServicePort(3000), 3000);
    assert.equal(readServicePort("3000"), 3000);
    assert.equal(readServicePort(65535), 65535);
  });

  it("weist alles zurück, was keine startbare Portnummer ist", () => {
    for (const value of [80, 1023, 65536, 0, -1, 3000.5, "", "  ", "dreitausend", null, undefined, {}]) {
      assert.equal(readServicePort(value), null, `unerwartet gültig: ${JSON.stringify(value)}`);
    }
  });

  it("hält nur gültige Ports bekannter Apps und fällt sonst auf den Standard zurück", () => {
    const selection = normalizeInstallSelection({
      apps: ["studio", "brain"],
      ports: { studio: 4000, brain: 80, unbekannt: 4004 },
    });

    assert.deepEqual(selection.ports, { studio: 4000 });
  });

  it("kennt Auswahl-Dateien ohne Ports (Installationen vor dieser Wahl)", () => {
    const selection = normalizeInstallSelection({ apps: ["studio"], seedDemoContent: false });

    assert.deepEqual(selection.ports, {});
    assert.deepEqual(selection.apps, ["studio"]);
  });
});
