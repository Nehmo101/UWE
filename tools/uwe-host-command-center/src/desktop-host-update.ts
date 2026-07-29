import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  collectDesktopHostStatus,
  commandCenterDataRoot,
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

const RELEASE_TAG_PREFIX = "uwe-v";
const RELEASE_TAG_PATTERN = /^uwe-v(\d+\.\d+\.\d+)$/;

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
  return /^\d+\.\d+\.\d+$/.test(value) ? value : null;
}

function readCommandCenterVersion(root: string): string | null {
  const configPath = path.join(root, "apps", "rtx-connector-client", "src-tauri", "tauri.conf.json");
  if (!fs.existsSync(configPath)) return readLocalVersion(root);
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as { version?: unknown };
    return typeof config.version === "string" && /^\d+\.\d+\.\d+$/.test(config.version)
      ? config.version
      : readLocalVersion(root);
  } catch {
    return readLocalVersion(root);
  }
}

export function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta < 0 ? -1 : 1;
  }
  return 0;
}

export function parseReleaseTag(tag: string): { tag: string; version: string } | null {
  const match = tag.trim().match(RELEASE_TAG_PATTERN);
  if (!match) return null;
  return { tag: match[0], version: match[1]! };
}

export function selectLatestReleaseTag(tags: string[]): { tag: string; version: string } | null {
  let latest: { tag: string; version: string } | null = null;
  for (const tag of tags) {
    const parsed = parseReleaseTag(tag);
    if (!parsed) continue;
    if (!latest || compareSemver(parsed.version, latest.version) > 0) {
      latest = parsed;
    }
  }
  return latest;
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

function resolveInstallerAssetName(root: string, tag: string, version: string): string {
  const viaGh = spawnSync(
    "gh",
    ["release", "view", tag, "--json", "assets", "--jq", ".assets[].name"],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    },
  );
  if (viaGh.status === 0) {
    const names = (viaGh.stdout ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const stable = names.find((name) => name === `UWE_Command_Center_${version}_x64-setup.exe`);
    if (stable) return stable;
    const setup = names.find((name) => /setup\.exe$/i.test(name) || /\.exe$/i.test(name));
    if (setup) return setup;
  }
  return `UWE_Command_Center_${version}_x64-setup.exe`;
}

function buildReleaseUrls(
  root: string,
  tag: string,
  version: string,
): Pick<DesktopHostUpdateInfo, "releaseUrl" | "windowsInstallerUrl"> {
  const slug = resolveGithubRepoSlug(root);
  if (!slug) {
    return { releaseUrl: null, windowsInstallerUrl: null };
  }
  const releaseUrl = `https://github.com/${slug}/releases/tag/${tag}`;
  const installerName = resolveInstallerAssetName(root, tag, version);
  return {
    releaseUrl,
    windowsInstallerUrl: `https://github.com/${slug}/releases/download/${tag}/${installerName.split("/").pop()}`,
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

function openExternal(url: string): void {
  if (process.platform === "win32") {
    spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "start", "", url], {
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

export async function checkDesktopHostUpdate(
  rootInput?: string,
): Promise<DesktopHostUpdateCheckResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const status = await collectDesktopHostStatus(root);
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
  const urls = buildReleaseUrls(root, latest.tag, latest.version);
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
      openExternal(check.windowsInstallerUrl);
    } else if (check.releaseUrl && check.commandCenterUpdateAvailable) {
      openExternal(check.releaseUrl);
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
