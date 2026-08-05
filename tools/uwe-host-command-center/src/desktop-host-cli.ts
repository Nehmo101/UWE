import {
  argumentValue,
  backupHost,
  collectDesktopHostStatus,
  getInstallSelection,
  listBackups,
  openTarget,
  readLogs,
  restoreBackup,
  setInstallSelection,
  startHost,
  startHostService,
  stopHost,
  stopHostService,
} from "./desktop-host.ts";
import { runSetupAction } from "./setup-action.ts";
import { withLongRunLock } from "./long-run-lock.ts";
import { applyDesktopHostUpdate, checkDesktopHostUpdate } from "./desktop-host-update.ts";
import { setHostProgressSink } from "./desktop-host-progress.ts";
import { getHostEnv, setHostEnv } from "./desktop-host-env.ts";
import { applyBundleInstall, applyBundleUpdate } from "./bundle-update.ts";
import {
  bundleInstallRoot,
  commandCenterDataRoot,
  detectHostMode,
  resolveDesktopHostRoot,
} from "./desktop-host.ts";
import { HOST_SERVICE_LABELS, isHostServiceId, type HostServiceId } from "./desktop-host-types.ts";
import path from "node:path";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

type HostAction =
  | "status"
  | "setup"
  | "start"
  | "stop"
  | "restart"
  | "backup"
  | "logs"
  | "open"
  | "check-update"
  | "update"
  | "get-env"
  | "set-env"
  | "start-service"
  | "stop-service"
  | "restart-service"
  | "list-backups"
  | "restore-backup"
  | "get-install-selection"
  | "set-install-selection"
  | "bundle-install"
  | "bundle-update";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const action = (argv[0] || "status") as HostAction;
  const root = argumentValue(argv, "--root");
  const target = argumentValue(argv, "--target");

  // Stream progress events as NDJSON lines so the Command Center can render a
  // live, determinate progress bar for the long actions (setup / update). The
  // Rust host reads stdout line-by-line: `progress` lines are forwarded to the
  // frontend, the single `result` line is the action's return value.
  setHostProgressSink((event) => process.stdout.write(`${JSON.stringify(event)}\n`));

  let result: unknown;
  try {
    switch (action) {
      // `setup` liest immer die gespeicherte Auswahl. Der Assistent schreibt sie
      // vorher über `set-install-selection` — bewusst zwei Aufrufe statt stdin,
      // damit der minutenlange Einrichtungslauf keine offene Eingabe braucht.
      // Die Weiche Checkout/Bundle liegt in `runSetupAction` — dieselbe Logik
      // wie beim `update` weiter unten.
      // Die Sperre sitzt hier und nicht in `runSetupAction`, weil `update`
      // intern `setupHost` aufruft — eine Sperre pro langem Lauf, nicht pro
      // Teilschritt, sonst sperrte sich das Update selbst aus.
      case "setup":
        result = await withLongRunLock(root, "setup", () => runSetupAction(root));
        break;
      case "get-install-selection":
        result = { ok: true, ...getInstallSelection(root) };
        break;
      case "set-install-selection":
        result = {
          ok: true,
          selection: setInstallSelection(root, JSON.parse(await readStdin()) as unknown),
        };
        break;
      case "start":
        result = await startHost(root);
        break;
      case "stop":
        result = await stopHost(root);
        break;
      case "restart":
        await stopHost(root);
        result = await startHost(root);
        break;
      case "start-service":
        result = await startHostService(root, target ?? "");
        break;
      case "stop-service":
        result = await stopHostService(root, target ?? "");
        break;
      case "restart-service":
        await stopHostService(root, target ?? "");
        result = await startHostService(root, target ?? "");
        break;
      case "backup":
        result = await backupHost(root);
        break;
      case "list-backups":
        result = listBackups(root);
        break;
      case "restore-backup":
        result = await restoreBackup(root, target ?? "");
        break;
      case "logs":
        result = readLogs(root, target);
        break;
      case "open":
        openTarget(root, target);
        result = {
          ok: true,
          // Label aus der Dienst-Registry; unbekannte Ziele öffnen Studio
          // (siehe desktopHostTargetUrl), also meldet die Rückmeldung dasselbe.
          message: `${HOST_SERVICE_LABELS[isHostServiceId(target) ? target : "studio"]} wurde geöffnet.`,
        };
        break;
      case "check-update":
        result = await checkDesktopHostUpdate(root);
        break;
      case "update": {
        // Ein Monorepo-Checkout aktualisiert über git + Build; eine
        // Bundle-Installation über das Release-Manifest. Die Weiche liegt hier,
        // damit der Update-Knopf im Command Center in beiden Welten derselbe ist.
        const updateRoot = resolveDesktopHostRoot(root);
        result = await withLongRunLock(root, "update", async () => {
          if (detectHostMode(updateRoot) === "bundle") {
            const dataDir = path.join(commandCenterDataRoot(), "data");
            return applyBundleUpdate(updateRoot, dataDir, path.join(dataDir, "backups"));
          }
          return applyDesktopHostUpdate(root);
        });
        break;
      }
      case "bundle-install": {
        const payload = JSON.parse(await readStdin()) as { apps?: unknown };
        const apps = Array.isArray(payload.apps) ? payload.apps.filter(isHostServiceId) : [];
        if (apps.length === 0) throw new Error("bundle-install erwartet {\"apps\": [\"studio\", …]} auf stdin.");
        const dataDir = path.join(commandCenterDataRoot(), "data");
        result = await withLongRunLock(root, "bundle-install", () =>
          applyBundleInstall(apps as HostServiceId[], bundleInstallRoot(), dataDir),
        );
        break;
      }
      case "bundle-update": {
        const dataDir = path.join(commandCenterDataRoot(), "data");
        result = await withLongRunLock(root, "bundle-update", () =>
          applyBundleUpdate(bundleInstallRoot(), dataDir, path.join(dataDir, "backups")),
        );
        break;
      }
      case "get-env":
        result = getHostEnv(root);
        break;
      case "set-env":
        result = setHostEnv(root, JSON.parse(await readStdin()) as Record<string, string>);
        break;
      case "status":
        result = await collectDesktopHostStatus(root);
        break;
      default:
        throw new Error(`Unbekannte Host-Aktion: ${action}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = { ok: false, message, status: await collectDesktopHostStatus(root) };
  }
  process.stdout.write(`${JSON.stringify({ type: "result", payload: result })}\n`);
}

void main();
