#!/usr/bin/env node
/**
 * Build uwe-release.json for GitHub Releases.
 *
 * Das Manifest ist der Vertrag zwischen Release und Command Center: es sagt,
 * welche App-Bundles zu dieser Version gehören, wie groß sie sind und welche
 * SHA-256 sie haben muss. Der Client lädt nur, was im Manifest steht, und
 * verwirft jedes Bundle mit falscher Summe.
 *
 * Usage:
 *   node scripts/build-uwe-release-manifest.mjs \
 *     --version 0.1.0 \
 *     --tag uwe-v0.1.0 \
 *     --sha abcdef \
 *     --nsis path/to/setup.exe \
 *     --app studio=path/to/uwe-studio-0.1.0.zip \
 *     --app portal=path/to/uwe-portal-0.1.0.zip \
 *     --databases path/to/uwe-databases-0.1.0.zip \
 *     --node-version 22.19.0 \
 *     --out uwe-release.json
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Jede App, die als eigenes Bundle ausgeliefert werden kann. */
const KNOWN_APPS = ["studio", "portal", "brain", "family", "landing"];

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Mehrfach angegebene Flags (--app studio=… --app portal=…). */
function argValues(argv, name) {
  const values = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name && argv[i + 1] !== undefined) values.push(argv[i + 1]);
  }
  return values;
}

const argv = process.argv.slice(2);
const version = argValue(argv, "--version");
const tag = argValue(argv, "--tag") || (version ? `uwe-v${version}` : undefined);
const sha = argValue(argv, "--sha") || process.env.GITHUB_SHA || "";
const nsis = argValue(argv, "--nsis");
const msi = argValue(argv, "--msi");
const out = argValue(argv, "--out") || "uwe-release.json";
const notes = argValue(argv, "--notes") || "";
const appArgs = argValues(argv, "--app");
const databases = argValue(argv, "--databases");

if (!version || !tag) {
  console.error("Usage: build-uwe-release-manifest.mjs --version X.Y.Z [--tag uwe-vX.Y.Z] ...");
  process.exit(1);
}

/**
 * Die Node-Fassung im Manifest ist immer die, mit der gerade gebaut wird — dazu
 * passt die ABI, an der `better-sqlite3` und die Prisma-Query-Engine hängen.
 * `--node-version` darf mitgegeben werden, muss aber übereinstimmen: eine
 * abweichende Angabe würde eine node.exe ausliefern, unter der die nativen
 * Module nicht laden.
 */
const nodeVersionArg = argValue(argv, "--node-version");
if (nodeVersionArg && nodeVersionArg !== process.versions.node) {
  console.error(
    `--node-version (${nodeVersionArg}) weicht von der Build-Laufzeit (${process.versions.node}) ab. ` +
      "Die Bundles werden mit der Build-Laufzeit erzeugt; eine andere Angabe wäre falsch.",
  );
  process.exit(1);
}
const nodeVersion = process.versions.node;

function basenameOrNull(value) {
  if (!value) return null;
  return path.basename(value);
}

/**
 * SHA-256 einer Datei, damit der Update-Pfad die Unversehrtheit unabhängig von
 * GitHub-HTTPS prüfen kann. Ein angegebener, aber fehlender Pfad bricht den Build
 * ab, statt still ein Manifest ohne Prüfsumme zu veröffentlichen.
 *
 * Blockweise gelesen: Die App-Bundles sind mehrere hundert MB groß, ein
 * `readFileSync` würde sie komplett in den Speicher holen.
 */
function sha256OrNull(value) {
  if (!value) return null;
  if (!fs.existsSync(value)) {
    console.error(`Datei für Prüfsumme nicht gefunden: ${value}`);
    process.exit(1);
  }
  const hash = crypto.createHash("sha256");
  const puffer = Buffer.alloc(1024 * 1024);
  const fd = fs.openSync(value, "r");
  try {
    let gelesen = 0;
    while ((gelesen = fs.readSync(fd, puffer, 0, puffer.length, null)) > 0) {
      hash.update(puffer.subarray(0, gelesen));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

/** Ein Release-Asset: Dateiname, Prüfsumme, Größe. */
function assetOrNull(value) {
  if (!value) return null;
  const sha256 = sha256OrNull(value);
  return { file: path.basename(value), sha256, size: fs.statSync(value).size };
}

/**
 * `--app <name>=<pfad>` einsammeln. Ein unbekannter App-Name ist ein Tippfehler
 * im Workflow und bricht ab — sonst fehlt im Release still ein Bundle, und der
 * Assistent kann das Profil beim Nutzer nicht erfüllen.
 */
function collectApps(entries) {
  const apps = {};
  for (const entry of entries) {
    const trenner = entry.indexOf("=");
    if (trenner < 1) {
      console.error(`--app erwartet <name>=<pfad>, bekommen: ${entry}`);
      process.exit(1);
    }
    const name = entry.slice(0, trenner);
    const file = entry.slice(trenner + 1);
    if (!KNOWN_APPS.includes(name)) {
      console.error(`Unbekannte App "${name}". Erlaubt: ${KNOWN_APPS.join(", ")}`);
      process.exit(1);
    }
    apps[name] = assetOrNull(file);
  }
  return apps;
}

const apps = collectApps(appArgs);

const manifest = {
  // v2 ergänzt `apps`, `databases` und `runtime` — die v1-Felder bleiben
  // unverändert erhalten, damit ein älteres Command Center weiter nur den
  // Installer liest und nicht am unbekannten Rest scheitert.
  schemaVersion: 2,
  product: "uwe",
  version,
  tag,
  gitSha: sha,
  commandCenterVersion: version,
  publishedAt: new Date().toISOString(),
  notes,
  windows: {
    nsis: basenameOrNull(nsis),
    msi: basenameOrNull(msi),
    nsisSha256: sha256OrNull(nsis),
    msiSha256: sha256OrNull(msi),
  },
  // Die Node-Fassung, mit der die Bundles gebaut wurden. `better-sqlite3` und
  // die Prisma-Query-Engine hängen an der ABI: läuft die mitgelieferte node.exe
  // mit einer anderen, laden die nativen Module nicht. Der Client prüft das,
  // bevor er startet.
  runtime: {
    node: nodeVersion,
    nodeAbi: process.versions.modules,
    platform: "win32",
    arch: "x64",
  },
  apps,
  databases: assetOrNull(databases),
};

fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const appNamen = Object.keys(apps);
console.log(
  `Wrote ${out} (schemaVersion 2, ${appNamen.length} App-Bundles: ${appNamen.join(", ") || "keine"})`,
);
