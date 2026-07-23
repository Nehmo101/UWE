import {
  argumentValue,
  backupHost,
  collectDesktopHostStatus,
  openTarget,
  readLogs,
  setupHost,
  startHost,
  startHostService,
  stopHost,
  stopHostService,
} from "./desktop-host.ts";
import { applyDesktopHostUpdate, checkDesktopHostUpdate } from "./desktop-host-update.ts";
import { setHostProgressSink } from "./desktop-host-progress.ts";
import { getHostEnv, setHostEnv } from "./desktop-host-env.ts";

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
  | "restart-service";

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
      case "setup":
        result = await setupHost(root);
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
      case "logs":
        result = readLogs(root, target);
        break;
      case "open":
        openTarget(root, target);
        result = {
          ok: true,
          message: `${target === "portal" ? "Portal" : target === "brain" ? "Brain" : "Studio"} wurde geöffnet.`,
        };
        break;
      case "check-update":
        result = await checkDesktopHostUpdate(root);
        break;
      case "update":
        result = await applyDesktopHostUpdate(root);
        break;
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
