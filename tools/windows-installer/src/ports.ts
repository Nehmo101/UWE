import net from "node:net";

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export async function isPortAvailable(
  port: number,
  host = "127.0.0.1",
): Promise<boolean> {
  if (!isValidPort(port)) {
    return false;
  }

  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

export async function checkPorts(
  studioPort: number,
  portalPort: number,
  host = "127.0.0.1",
): Promise<{ ok: boolean; busy: number[] }> {
  const busy: number[] = [];

  if (!(await isPortAvailable(studioPort, host))) {
    busy.push(studioPort);
  }

  if (!(await isPortAvailable(portalPort, host))) {
    busy.push(portalPort);
  }

  if (studioPort === portalPort && busy.length === 1) {
    busy.push(portalPort);
  }

  return { ok: busy.length === 0, busy: [...new Set(busy)] };
}

export function isPublicHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "0.0.0.0" || normalized === "::" || normalized === "[::]";
}
