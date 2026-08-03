import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  collectDesktopHostStatus,
  commandCenterDataRoot,
  detectHostMode,
  getInstallSelection,
  resolveDesktopHostRoot,
  setupHost,
  setupStepCount,
  startHost,
  stopHost,
  type DesktopHostActionResult,
  type DesktopHostStatus,
} from "./desktop-host.ts";
import { beginHostProgress, reportHostStep } from "./desktop-host-progress.ts";
import { openExternalUrl, runningCommandCenterVersion } from "./desktop-host-system.ts";
import { releaseAssetUrl, releasePageUrl, tryFetchManifestForTag } from "./bundle-install.ts";
import { checkBundleUpdate, readInstalledState } from "./bundle-update.ts";
import {
  compareSemver,
  isReleaseVersion,
  parseReleaseTag,
  selectLatestReleaseTag,
  RELEASE_TAG_PREFIX,
} from "./release-tags.ts";

// Die Tag-Helfer bleiben von hier aus erreichbar — Bestandsimporte (CLI, Tests)
// zeigen weiter auf dieses Modul.
export { compareSemver, parseReleaseTag, selectLatestReleaseTag };

export interface DesktopHostUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string | null;
  currentRevision: string | null;
  latestVersion: string | null;
  latestTag: string | null;
  latestRevision: string | null;
  releaseUrl: string | null;
  windowsInstallerUrl: string | null;
  commandCenterUpdateAvailable: boolean;
  dirtyWorktree: boolean;
  message: string;
}

export interface DesktopHostUpdateCheckResult extends DesktopHostUpdateInfo {
  ok: boolean;
  status: DesktopHostStatus;
}

function git(root: string, args: string[], options: { allowFailure?: boolean } = {}): string {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  const stdout = (result.stdout ?? "").trim();
  const stderr = (result.stderr ?? "").trim();
  if (result.status !== 0) {
    if (options.allowFailure) return "";
    throw new Error(stderr || `git ${args.join(" ")} fehlgeschlagen.`);
  }
  return stdout;
}

function readLocalVersion(root: string): string | null {
  const versionPath = path.join(root, "VERSION");
  if (!fs.existsSync(versionPath)) return null;
  const value = fs.readFileSync(versionPath, "utf8").trim();
  return isReleaseVersion(value) ? value : null;
}

/**
 * Die Fassung des Command Centers: bevorzugt die des laufenden Prozesses (die
 * Bundle-Installation hat keine `tauri.conf.json` neben sich), sonst die des
 * Checkouts.
 */
function readCommandCenterVersion(root: string): string | null {
  const laufend = runningCommandCenterVersion();
  if (laufend) return laufend;
  const configPath = path.join(root, "apps", "engine-connector-client", "src-tauri", "tauri.conf.json");
  if (!fs.existsSync(configPath)) return readLocalVersion(root);
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as { version?: unknown };
    return typeof config.version === "string" && isReleaseVersion(config.version)
      ? config.version
      : readLocalVersion(root);
  } catch {
    return readLocalVersion(root);
  }
}

function listReleaseTags(root: string): string[] {
  const output = git(root, ["tag", "--list", `${RELEASE_TAG_PREFIX}*`], { allowFailure: true });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveGithubRepoSlug(root: string): string | null {
  const remote = git(root, ["remote", "get-url", "origin"], { allowFailure: true });
  if (!remote) return null;
  const sshMatch = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/i);
  if (sshMatch) return sshMatch[1]!;
  try {
    const url = new URL(remote);
    if (!/github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.replace(/\.git$/i, "").split("/").filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
  return null;
}

/**
 * Der Installer-Dateiname am Release-Tag. Quelle ist `uwe-release.json` des
 * Releases — kein `gh` und kein Token: die Zielrechner haben beides nicht. Ist
 * das Manifest nicht erreichbar, greift der Name, den der Release-Workflow
 * garantiert (stabiler NSIS-Name).
 */
async function resolveInstallerAssetName(
  slug: string,
  tag: string,
  version: string,
): Promise<string> {
  const manifest = await tryFetchManifestForTag(tag, slug);
  const nsis = manifest?.windows?.nsis?.split("/").pop();
  return nsis || `UWE_Command_Center_${version}_x64-setup.exe`;
}

async function buildReleaseUrls(
  root: string,
  tag: string,
  version: string,
): Promise<Pick<DesktopHostUpdateInfo, "releaseUrl" | "windowsInstallerUrl">> {
  const slug = resolveGithubRepoSlug(root);
  if (!slug) {
    return { releaseUrl: null, windowsInstallerUrl: null };
  }
  return {
    releaseUrl: releasePageUrl(tag, slug),
    windowsInstallerUrl: releaseAssetUrl(tag, await resolveInstallerAssetName(slug, tag, version), slug),
  };
}

function worktreeDirty(root: string): boolean {
  const output = git(root, ["status", "--porcelain"], { allowFailure: true });
  return output.length > 0;
}

function appendUpdateLog(_root: string, line: string): void {
  const logs = path.join(commandCenterDataRoot(), "logs");
  fs.mkdirSync(logs, { recursive: true });
  fs.appendFileSync(
    path.join(logs, "command-center.log"),
    `[${new Date().toISOString()}] ${line}\n`,
    "utf8",
  );
}

/**
 * Update-Check einer Bundle-Installation: hier gibt es kein git und keine Tags
 * im Dateisystem — die Wahrheit ist `uwe-release.json` des neuesten Releases,
 * und der Release-Tag darin ist die Version, gegen die verglichen wird.
 *
 * Das Ergebnis trägt dieselbe Form wie der Checkout-Weg, damit der Update-Knopf
 * im Command Center in beiden Welten derselbe bleibt.
 */
async function checkBundleReleaseUpdate(
  root: string,
  status: DesktopHostStatus,
): Promise<DesktopHostUpdateCheckResult> {
  const installedVersion = readInstalledState(root).version;
  try {
    appendUpdateLog(root, "Update-Check: Release-Manifest laden ...");
    const check = await checkBundleUpdate(root);
    const appVersion = runningCommandCenterVersion();
    const commandCenterUpdateAvailable = appVersion
      ? compareSemver(appVersion, check.latestVersion) < 0
      : false;
    const meldungen = [check.message];
    if (commandCenterUpdateAvailable) {
      meldungen.push(`Das Command Center selbst ist auf ${appVersion} und wird neu installiert.`);
    }
    return {
      ok: true,
      updateAvailable: check.updateAvailable || commandCenterUpdateAvailable,
      currentVersion: check.installedVersion,
      // Eine Bundle-Installation kennt keinen Commit — nur den Release-Tag.
      currentRevision: null,
      latestVersion: check.latestVersion,
      latestTag: check.latestTag,
      latestRevision: null,
      releaseUrl: releasePageUrl(check.latestTag),
      windowsInstallerUrl: check.installerFile
        ? releaseAssetUrl(check.latestTag, check.installerFile)
        : null,
      commandCenterUpdateAvailable,
      dirtyWorktree: false,
      message: meldungen.join(" "),
      status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendUpdateLog(root, `Update-Check fehlgeschlagen: ${message}`);
    return {
      ok: false,
      updateAvailable: false,
      currentVersion: installedVersion,
      currentRevision: null,
      latestVersion: null,
      latestTag: null,
      latestRevision: null,
      releaseUrl: null,
      windowsInstallerUrl: null,
      commandCenterUpdateAvailable: false,
      dirtyWorktree: false,
      message: `Update-Check fehlgeschlagen: ${message}`,
      status,
    };
  }
}

export async function checkDesktopHostUpdate(
  rootInput?: string,
): Promise<DesktopHostUpdateCheckResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const status = await collectDesktopHostStatus(root);
  if (detectHostMode(root) === "bundle") {
    return checkBundleReleaseUpdate(root, status);
  }
  const currentVersion = readLocalVersion(root);
  const currentRevision = git(root, ["rev-parse", "--short", "HEAD"], { allowFailure: true }) || null;

  try {
    appendUpdateLog(root, "Update-Check: git fetch origin --tags ...");
    git(root, ["fetch", "origin", "--tags", "--force"]);
    git(root, ["fetch", "origin", "main"], { allowFailure: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      updateAvailable: false,
      currentVersion,
      currentRevision,
      latestVersion: null,
      latestTag: null,
      latestRevision: null,
      releaseUrl: null,
      windowsInstallerUrl: null,
      commandCenterUpdateAvailable: false,
      dirtyWorktree: worktreeDirty(root),
      message: `Update-Check fehlgeschlagen: ${message}`,
      status,
    };
  }

  const latest = selectLatestReleaseTag(listReleaseTags(root));
  if (!latest) {
    const remoteMain = git(root, ["rev-parse", "--short", "origin/main"], { allowFailure: true }) || null;
    const localFull = git(root, ["rev-parse", "HEAD"], { allowFailure: true });
    const remoteFull = git(root, ["rev-parse", "origin/main"], { allowFailure: true });
    const updateAvailable = Boolean(localFull && remoteFull && localFull !== remoteFull);
    return {
      ok: true,
      updateAvailable,
      currentVersion,
      currentRevision,
      latestVersion: currentVersion,
      latestTag: updateAvailable ? "origin/main" : null,
      latestRevision: remoteMain,
      releaseUrl: null,
      windowsInstallerUrl: null,
      commandCenterUpdateAvailable: false,
      dirtyWorktree: worktreeDirty(root),
      message: updateAvailable
        ? `Kein Release-Tag gefunden. origin/main ist neuer (${remoteMain}). Update synchronisiert auf main und baut UWE neu.`
        : "Kein neueres UWE-Release gefunden.",
      status,
    };
  }

  const latestRevision =
    git(root, ["rev-parse", "--short", latest.tag], { allowFailure: true }) || null;
  const latestFull = git(root, ["rev-parse", latest.tag], { allowFailure: true });
  const currentFull = git(root, ["rev-parse", "HEAD"], { allowFailure: true });
  const versionNewer = currentVersion
    ? compareSemver(currentVersion, latest.version) < 0
    : true;
  const revisionNewer = Boolean(latestFull && currentFull && latestFull !== currentFull);
  const updateAvailable = versionNewer || revisionNewer;
  const urls = await buildReleaseUrls(root, latest.tag, latest.version);
  const commandCenterVersion = readCommandCenterVersion(root);
  const commandCenterUpdateAvailable = commandCenterVersion
    ? compareSemver(commandCenterVersion, latest.version) < 0
    : updateAvailable;

  return {
    ok: true,
    updateAvailable,
    currentVersion,
    currentRevision,
    latestVersion: latest.version,
    latestTag: latest.tag,
    latestRevision,
    releaseUrl: urls.releaseUrl,
    windowsInstallerUrl: urls.windowsInstallerUrl,
    commandCenterUpdateAvailable,
    dirtyWorktree: worktreeDirty(root),
    message: updateAvailable
      ? `Update verfügbar: ${latest.tag} (${latest.version}${latestRevision ? ` · ${latestRevision}` : ""}).`
      : `UWE ist aktuell (${latest.tag}).`,
    status,
  };
}

function syncRepositoryToTarget(root: string, target: string): void {
  appendUpdateLog(root, `Repository-Sync auf ${target} ...`);
  if (worktreeDirty(root)) {
    appendUpdateLog(root, "Lokale Änderungen werden per git stash gesichert.");
    git(root, ["stash", "push", "-u", "-m", `command-center update pre-sync ${new Date().toISOString()}`]);
  }

  if (target === "origin/main") {
    const ancestor = spawnSync(
      "git",
      ["-C", root, "merge-base", "--is-ancestor", "HEAD", "origin/main"],
      { windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    if (ancestor.status === 0) {
      git(root, ["merge", "--ff-only", "origin/main"]);
      return;
    }
    const backupRef = `refs/backup/command-center-before-update/${new Date()
      .toISOString()
      .replace(/[:.]/g, "")}`;
    git(root, ["update-ref", backupRef, "HEAD"]);
    appendUpdateLog(root, `Backup-Ref ${backupRef} gesetzt.`);
    git(root, ["checkout", "-B", "main", "origin/main"]);
    return;
  }

  git(root, ["checkout", "--detach", target]);
}

export async function applyDesktopHostUpdate(rootInput?: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const before = await collectDesktopHostStatus(root);
  const wasRunning = before.services.some((service) => service.healthy || service.state === "starting");
  const check = await checkDesktopHostUpdate(root);

  if (!check.ok) {
    return { ok: false, message: check.message, status: check.status };
  }
  if (!check.updateAvailable || !check.latestTag) {
    return {
      ok: true,
      message: check.message,
      status: check.status,
    };
  }

  try {
    appendUpdateLog(root, `Update gestartet → ${check.latestTag}`);
    // One continuous progress run across the whole update: optional stop, the
    // repository sync, all setup build steps, and an optional restart. setupHost
    // is told not to own progress so its steps extend this same 1..total counter.
    // The step count follows this installation's app selection, so a Studio-only
    // host doesn't advertise build steps it will never run.
    const setupSteps = setupStepCount(getInstallSelection(root).selection);
    beginHostProgress((wasRunning ? 1 : 0) + 1 + setupSteps + (wasRunning ? 1 : 0));
    if (wasRunning) {
      reportHostStep("stop", "Laufende Dienste stoppen");
      await stopHost(root);
    }
    reportHostStep("sync", "Code synchronisieren");
    syncRepositoryToTarget(root, check.latestTag);
    const setup = await setupHost(root, { ownProgress: false });
    if (!setup.ok) {
      return setup;
    }

    let status = setup.status;
    if (wasRunning) {
      reportHostStep("start", "Dienste neu starten");
      const started = await startHost(root);
      status = started.status;
      if (!started.ok) {
        return {
          ok: false,
          message: `Code und Build wurden aktualisiert, aber der Neustart scheiterte: ${started.message}`,
          status,
        };
      }
    }

    if (check.commandCenterUpdateAvailable && check.windowsInstallerUrl) {
      appendUpdateLog(root, `Command-Center-Installer öffnen: ${check.windowsInstallerUrl}`);
      openExternalUrl(check.windowsInstallerUrl);
    } else if (check.releaseUrl && check.commandCenterUpdateAvailable) {
      openExternalUrl(check.releaseUrl);
    }

    const versionLabel = check.latestVersion ?? check.latestTag;
    return {
      ok: true,
      message: check.commandCenterUpdateAvailable
        ? `UWE ${versionLabel} ist installiert und neu gebaut. Der Command-Center-Installer wurde geöffnet — bitte die App-Aktualisierung abschließen.`
        : `UWE ${versionLabel} ist installiert und neu gebaut.`,
      status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendUpdateLog(root, `Update fehlgeschlagen: ${message}`);
    return {
      ok: false,
      message: `Update fehlgeschlagen: ${message}`,
      status: await collectDesktopHostStatus(root),
    };
  }
}
