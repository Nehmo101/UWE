#!/usr/bin/env node
/**
 * UWE DAV-Methoden-Proxy für die Family-App.
 *
 * Next.js-Route-Handler kennen nur GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS —
 * ein CalDAV-Client (iOS-Kalender) spricht aber PROPFIND und REPORT. Dieser
 * Proxy sitzt vor dem Next-Standalone-Server, startet ihn als Kindprozess auf
 * einem internen Port und reicht allen Verkehr unverändert durch. Nur für
 * DAV-Pfade (`/api/dav*`, `/.well-known/caldav`) übersetzt er DAV-Methoden in
 * `POST` + Header `x-uwe-dav-method`, den der Route Handler auswertet.
 *
 * Sicherheit: ein eingehender `x-uwe-dav-method`-Header wird auf JEDEM Request
 * entfernt — nur der Proxy selbst darf ihn setzen (Spoof-Schutz).
 *
 * Keine Abhängigkeiten, damit er in jedem Deployment-Layout läuft:
 *   node uwe-dav-proxy.mjs --listen 3004 --upstream 3014 --host 127.0.0.1 \
 *     --child-cwd <standalone-dir> -- <node> apps/family/server.js
 */

import http from "node:http";
import { spawn } from "node:child_process";

const DAV_METHODS = new Set([
  "PROPFIND",
  "PROPPATCH",
  "REPORT",
  "MKCALENDAR",
  "MKCOL",
  "COPY",
  "MOVE",
  "LOCK",
  "UNLOCK",
  "ACL",
]);

const DAV_METHOD_HEADER = "x-uwe-dav-method";
const UPSTREAM_TIMEOUT_MS = 120_000;

function isDavPath(pathname) {
  return pathname === "/.well-known/caldav" || pathname.startsWith("/api/dav");
}

function parseArgs(argv) {
  const options = { listen: null, upstream: null, host: "127.0.0.1", childCwd: null, childCmd: [] };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--") {
      options.childCmd = argv.slice(i + 1);
      break;
    }
    const value = argv[i + 1];
    if (arg === "--listen") options.listen = Number(value);
    else if (arg === "--upstream") options.upstream = Number(value);
    else if (arg === "--host") options.host = String(value);
    else if (arg === "--child-cwd") options.childCwd = String(value);
    else throw new Error(`Unbekanntes Argument: ${arg}`);
    i += 2;
  }
  if (!options.listen || !options.upstream) {
    throw new Error("--listen und --upstream sind erforderlich.");
  }
  if (options.childCmd.length === 0) {
    throw new Error("Kein Kind-Kommando angegeben (nach `--`).");
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  const [childBin, ...childArgs] = options.childCmd;
  const child = spawn(childBin, childArgs, {
    cwd: options.childCwd ?? process.cwd(),
    env: {
      ...process.env,
      PORT: String(options.upstream),
      HOSTNAME: "127.0.0.1",
    },
    stdio: "inherit",
  });

  let shuttingDown = false;
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dav-proxy] Kindprozess beendet (code=${code}, signal=${signal}) — Proxy stoppt.`);
    process.exit(1);
  });
  child.on("error", (error) => {
    console.error(`[dav-proxy] Kindprozess-Fehler: ${error.message}`);
    process.exit(1);
  });

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
      const killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
      killTimer.unref();
      child.on("exit", () => process.exit(0));
    } else {
      process.exit(0);
    }
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  const server = http.createServer((req, res) => {
    const headers = { ...req.headers };
    // Spoof-Schutz: der Übersetzungs-Header kommt ausschliesslich vom Proxy.
    delete headers[DAV_METHOD_HEADER];

    let method = req.method ?? "GET";
    let requestUrl = req.url ?? "/";
    const [pathname = "/", query] = requestUrl.split("?");
    if (isDavPath(pathname)) {
      if (DAV_METHODS.has(method)) {
        headers[DAV_METHOD_HEADER] = method;
        method = "POST";
      }
      // Trailing Slash entfernen, sonst antwortet Next mit einem 308-Redirect
      // auf jeden Collection-PROPFIND (/api/dav/cal/familie/ → …/familie).
      if (pathname.length > 1 && pathname.endsWith("/")) {
        const stripped = pathname.replace(/\/+$/, "");
        requestUrl = query != null ? `${stripped}?${query}` : stripped;
      }
    }

    const upstreamReq = http.request(
      {
        host: "127.0.0.1",
        port: options.upstream,
        method,
        path: requestUrl,
        headers,
        timeout: UPSTREAM_TIMEOUT_MS,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );

    upstreamReq.on("timeout", () => {
      upstreamReq.destroy(new Error("upstream timeout"));
    });
    upstreamReq.on("error", (error) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const status = error.message === "upstream timeout" ? 504 : 502;
      res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
      res.end(status === 504 ? "Upstream-Timeout." : "Upstream nicht erreichbar.");
    });

    req.pipe(upstreamReq);
  });

  server.listen(options.listen, options.host, () => {
    console.log(
      `[dav-proxy] lauscht auf ${options.host}:${options.listen}, Upstream 127.0.0.1:${options.upstream}`,
    );
  });
}

main();
