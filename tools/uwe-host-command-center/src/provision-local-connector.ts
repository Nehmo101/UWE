import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  defaultConnectorClientConfig,
  parseConnectorClientConfig,
} from "@uwe/connector-client-config";

const DEFAULT_LOCAL_HOST_URL = "http://127.0.0.1:3000";
const LOCAL_CONNECTOR_NAME = "UWE Command Center (lokal)";

interface ConnectorIdentity {
  id: string;
  name: string;
}

export interface LocalConnectorService {
  authenticate(token: string): Promise<ConnectorIdentity | null>;
  listConnectors(): Promise<ConnectorIdentity[]>;
  createConnector(name: string): Promise<{ connector: ConnectorIdentity; token: string }>;
  rotateToken(connectorId: string): Promise<{ token: string }>;
}

export interface ProvisionLocalConnectorOptions {
  root: string;
  dataRoot: string;
  service: LocalConnectorService;
  hostUrl?: string;
}

export interface ProvisionLocalConnectorResult {
  ok: true;
  connectorId: string;
  reusedToken: boolean;
  configPath: string;
  backupCreated: boolean;
}

function argumentValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function defaultDataRoot(): string {
  const configured = process.env.UWE_COMMAND_CENTER_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "UWE", "rtx-connector-client", "host");
  }
  return path.join(os.homedir(), ".local", "share", "UWE", "rtx-connector-client", "host");
}

function readCurrentConfig(configPath: string): ReturnType<typeof defaultConnectorClientConfig> {
  if (!fs.existsSync(configPath)) return defaultConnectorClientConfig();
  return parseConnectorClientConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
}

function writeConfig(configPath: string, value: ReturnType<typeof defaultConnectorClientConfig>): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, configPath);
  if (process.platform !== "win32") fs.chmodSync(configPath, 0o600);
}

export async function provisionLocalConnector(
  options: ProvisionLocalConnectorOptions,
): Promise<ProvisionLocalConnectorResult> {
  const configPath = path.join(path.dirname(options.dataRoot), "config.json");
  const backupPath = path.join(path.dirname(options.dataRoot), "config.remote-before-local.json");
  const localHostUrl = options.hostUrl?.trim() || DEFAULT_LOCAL_HOST_URL;
  const current = readCurrentConfig(configPath);
  const authenticated = current.token ? await options.service.authenticate(current.token) : null;
  let connector = authenticated;
  let token = current.token;

  if (!connector) {
    const existing = (await options.service.listConnectors()).find(
      (candidate) => candidate.name === LOCAL_CONNECTOR_NAME,
    );
    if (existing) {
      connector = existing;
      token = (await options.service.rotateToken(existing.id)).token;
    } else {
      const created = await options.service.createConnector(LOCAL_CONNECTOR_NAME);
      connector = created.connector;
      token = created.token;
    }
  }

  const backupCreated =
    fs.existsSync(configPath) &&
    current.hostUrl !== localHostUrl &&
    !fs.existsSync(backupPath);
  if (backupCreated) fs.copyFileSync(configPath, backupPath);

  writeConfig(configPath, parseConnectorClientConfig({
    ...current,
    hostUrl: localHostUrl,
    token,
    name: connector.name,
    localHostRoot: path.resolve(options.root),
    wizardCompleted: true,
    autoConnect: true,
  }));

  return {
    ok: true,
    connectorId: connector.id,
    reusedToken: Boolean(authenticated),
    configPath,
    backupCreated,
  };
}

async function main(): Promise<void> {
  const root = path.resolve(argumentValue(process.argv.slice(2), "--root") ?? process.cwd());
  const [{ prisma }, { ConnectorService }] = await Promise.all([
    import("@uwe/database/client"),
    import("@uwe/database/connector-service"),
  ]);
  try {
    const result = await provisionLocalConnector({
      root,
      dataRoot: defaultDataRoot(),
      service: new ConnectorService(prisma),
      hostUrl: process.env.NEXT_PUBLIC_STUDIO_URL,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : "";
const currentModule = path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
if (entrypoint === currentModule) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
