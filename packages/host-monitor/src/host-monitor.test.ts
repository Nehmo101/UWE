import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectHostMetrics, resolvePrimaryIpv4 } from "./host-metrics";
import { collectDiskUsage } from "./disk";
import {
  collectServiceStatus,
  parseNextElapse,
  parseSystemctlShow,
} from "./systemd";
import { collectHostSecurity } from "./host-security";
import { collectNetworkCounters, parseProcNetDev } from "./network";
import { collectOpenPorts, parseSsOutput, splitAddressPort } from "./ports";
import {
  collectRecentErrors,
  collectFailedLogins,
  parseJournalErrors,
  parseLastb,
  parseSshFailures,
} from "./logs";
import { collectCommandCenterSnapshot } from "./snapshot";
import { worstSeverity, severityFromPercent, formatDuration } from "./types";
import type { CommandResult, HostReadDeps } from "./runner";

const NOW = 1_700_000_000_000;

function fakeRun(
  map: Record<string, CommandResult | null>,
): HostReadDeps["run"] {
  return async (cmd, args) => {
    const key = [cmd, ...args].join(" ");
    if (key in map) return map[key];
    // Match by command prefix for convenience.
    if (cmd in map) return map[cmd];
    return null;
  };
}

describe("severity helpers", () => {
  it("worstSeverity ignores unknown but honors warn/error", () => {
    assert.equal(worstSeverity(["ok", "unknown", "ok"]), "ok");
    assert.equal(worstSeverity(["ok", "warn", "unknown"]), "warn");
    assert.equal(worstSeverity(["warn", "error"]), "error");
    assert.equal(worstSeverity([]), "ok");
  });

  it("severityFromPercent thresholds", () => {
    assert.equal(severityFromPercent(null, 85, 95), "unknown");
    assert.equal(severityFromPercent(50, 85, 95), "ok");
    assert.equal(severityFromPercent(90, 85, 95), "warn");
    assert.equal(severityFromPercent(99, 85, 95), "error");
  });

  it("formatDuration renders days and hh:mm", () => {
    assert.equal(formatDuration(0), "00:00");
    assert.equal(formatDuration(3 * 86400 + 4 * 3600 + 12 * 60), "3d 04:12");
    assert.equal(formatDuration(null), "—");
  });
});

describe("collectHostMetrics", () => {
  it("computes memory/cpu percentages and boot times from injected sources", () => {
    const metrics = collectHostMetrics({
      nowMs: NOW,
      sources: {
        hostname: () => "uwe-host",
        platform: () => "linux",
        release: () => "6.0",
        nodeVersion: "v22.0.0",
        osUptimeSeconds: () => 3600,
        processUptimeSeconds: () => 600,
        loadAverage: () => [2, 1, 0.5],
        cpus: () => [{ model: "Test CPU" }, { model: "Test CPU" }],
        totalMem: () => 1000,
        freeMem: () => 250,
        memoryUsage: () => ({ rss: 10, heapUsed: 5, heapTotal: 8 }),
        networkInterfaces: () => ({
          lo: [{ family: "IPv4", address: "127.0.0.1", internal: true } as never],
          eth0: [{ family: "IPv4", address: "192.168.1.5", internal: false } as never],
        }),
      },
    });

    assert.equal(metrics.memory.usedBytes, 750);
    assert.equal(metrics.memory.usedPercent, 75);
    assert.equal(metrics.memory.severity, "ok");
    assert.equal(metrics.cpu.cores, 2);
    assert.equal(metrics.cpu.loadPercent, 100); // load 2 / 2 cores
    assert.equal(metrics.cpu.severity, "warn"); // 100 >= warn(90), < crit(150)
    assert.equal(metrics.primaryIpv4, "192.168.1.5");
    assert.equal(metrics.hostBootTime, new Date(NOW - 3_600_000).toISOString());
    assert.equal(metrics.appStartTime, new Date(NOW - 600_000).toISOString());
  });

  it("resolvePrimaryIpv4 skips internal addresses", () => {
    assert.equal(
      resolvePrimaryIpv4({ lo: [{ family: "IPv4", address: "127.0.0.1", internal: true } as never] }),
      null,
    );
  });
});

describe("collectDiskUsage", () => {
  it("computes used percent and severity", () => {
    const disks = collectDiskUsage(
      [{ label: "Daten", path: "/data" }],
      () => ({ blocks: 100, bsize: 1024, bavail: 5 }),
    );
    assert.equal(disks[0].totalBytes, 102400);
    assert.equal(disks[0].usedPercent, 95);
    assert.equal(disks[0].severity, "error");
  });

  it("degrades to unknown when statfs throws", () => {
    const disks = collectDiskUsage(
      [{ label: "Daten", path: "/missing" }],
      () => {
        throw new Error("ENOENT");
      },
    );
    assert.equal(disks[0].severity, "unknown");
    assert.equal(disks[0].usedPercent, null);
  });
});

describe("systemd parsing", () => {
  it("parses key=value output", () => {
    const props = parseSystemctlShow("LoadState=loaded\nActiveState=active\nSubState=running");
    assert.equal(props.ActiveState, "active");
  });

  it("parses next elapse micros to ISO, 0 -> null", () => {
    assert.equal(parseNextElapse("0"), null);
    assert.equal(parseNextElapse(undefined), null);
    assert.equal(parseNextElapse(String(NOW * 1000)), new Date(NOW).toISOString());
  });

  it("marks active service ok and inactive service error", async () => {
    const statuses = await collectServiceStatus({
      units: [
        { unit: "uwe.service", label: "UWE", kind: "service" },
        { unit: "uwe-backup.timer", label: "Backup", kind: "timer" },
      ],
      deps: {
        run: fakeRun({
          "systemctl show uwe.service --property=LoadState --property=ActiveState --property=SubState --property=NextElapseUSecRealtime":
            { stdout: "LoadState=loaded\nActiveState=active\nSubState=running", code: 0 },
          "systemctl show uwe-backup.timer --property=LoadState --property=ActiveState --property=SubState --property=NextElapseUSecRealtime":
            { stdout: "LoadState=loaded\nActiveState=inactive\nSubState=dead\nNextElapseUSecRealtime=0", code: 0 },
        }),
      },
    });
    assert.equal(statuses[0].severity, "ok");
    assert.equal(statuses[0].ok, true);
    assert.equal(statuses[1].severity, "warn"); // inactive timer -> warn
  });

  it("degrades to unknown when systemctl is missing", async () => {
    const statuses = await collectServiceStatus({
      units: [{ unit: "uwe.service", label: "UWE", kind: "service" }],
      deps: { run: async () => null },
    });
    assert.equal(statuses[0].severity, "unknown");
    assert.match(statuses[0].message, /systemctl/);
  });

  it("degrades to unknown when systemd is not running (non-zero, empty output)", async () => {
    const statuses = await collectServiceStatus({
      units: [{ unit: "uwe.service", label: "UWE", kind: "service" }],
      deps: { run: async () => ({ stdout: "", code: 1 }) },
    });
    assert.equal(statuses[0].severity, "unknown");
    assert.match(statuses[0].message, /systemd/);
  });
});

describe("collectHostSecurity", () => {
  it("reports ok firewall + hardened ssh from fakes", async () => {
    const checks = await collectHostSecurity({
      run: fakeRun({
        ufw: { stdout: "Status: active", code: 0 },
        lsblk: { stdout: "disk\ncrypt\npart", code: 0 },
      }),
      readFile: async (path) => {
        if (path === "/etc/ssh/sshd_config") {
          return "PermitRootLogin no\nPasswordAuthentication no";
        }
        if (path === "/var/lib/update-notifier/updates-available") {
          return "0 updates can be applied immediately.";
        }
        if (path === "/etc/apt/apt.conf.d/20auto-upgrades") {
          return 'APT::Periodic::Unattended-Upgrade "1";';
        }
        return null;
      },
      fileExists: async () => false,
    });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    assert.equal(byId.firewall.severity, "ok");
    assert.equal(byId.ssh_hardening.severity, "ok");
    assert.equal(byId.reboot_required.severity, "ok");
    assert.equal(byId.unattended_upgrades.severity, "ok");
    assert.equal(byId.disk_encryption.severity, "ok");
  });

  it("degrades to unknown/manual when tools unavailable", async () => {
    const checks = await collectHostSecurity({
      run: async () => null,
      readFile: async () => null,
      fileExists: async () => false,
    });
    const firewall = checks.find((c) => c.id === "firewall");
    const ssh = checks.find((c) => c.id === "ssh_hardening");
    assert.equal(firewall?.severity, "unknown");
    assert.equal(firewall?.manual, true);
    assert.equal(ssh?.severity, "unknown");
  });
});

describe("network counters", () => {
  it("parses /proc/net/dev and drops loopback", () => {
    const content = [
      "Inter-|   Receive                                                |  Transmit",
      " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
      "    lo: 1000 10 0 0 0 0 0 0 1000 10 0 0 0 0 0 0",
      "  eth0: 5000 50 0 0 0 0 0 0 2000 20 0 0 0 0 0 0",
    ].join("\n");
    const interfaces = parseProcNetDev(content);
    assert.equal(interfaces.length, 1);
    assert.equal(interfaces[0].name, "eth0");
    assert.equal(interfaces[0].rxBytes, 5000);
    assert.equal(interfaces[0].txBytes, 2000);
  });

  it("aggregates counters and marks unavailable when /proc missing", async () => {
    const ok = await collectNetworkCounters({
      nowMs: NOW,
      deps: { readFile: async () => "h1\nh2\n  eth0: 5000 0 0 0 0 0 0 0 2000 0 0 0 0 0 0 0" },
    });
    assert.equal(ok.available, true);
    assert.equal(ok.rxBytes, 5000);
    assert.equal(ok.txBytes, 2000);
    assert.equal(ok.sampledAtMs, NOW);

    const missing = await collectNetworkCounters({ nowMs: NOW, deps: { readFile: async () => null } });
    assert.equal(missing.available, false);
  });
});

describe("open ports", () => {
  it("splits IPv4/IPv6 local addresses", () => {
    assert.deepEqual(splitAddressPort("0.0.0.0:3000"), { address: "0.0.0.0", port: 3000 });
    assert.deepEqual(splitAddressPort("[::]:22"), { address: "::", port: 22 });
    assert.equal(splitAddressPort("garbage"), null);
  });

  it("parses ss output with process names and dedupes", () => {
    const stdout = [
      'tcp   LISTEN 0 128  0.0.0.0:3000  0.0.0.0:*  users:(("node",pid=1,fd=1))',
      'tcp   LISTEN 0 128  0.0.0.0:22    0.0.0.0:*  users:(("sshd",pid=2,fd=3))',
      "udp   UNCONN 0 0    0.0.0.0:68    0.0.0.0:*",
    ].join("\n");
    const ports = parseSsOutput(stdout);
    assert.equal(ports.length, 3);
    assert.equal(ports[0].port, 22); // sorted
    assert.equal(ports[0].process, "sshd");
  });

  it("degrades when ss is missing", async () => {
    const result = await collectOpenPorts({ run: async () => null });
    assert.equal(result.available, false);
  });
});

describe("logs", () => {
  it("parses journal errors newest-first with timestamps", () => {
    const stdout = [
      "2026-07-08T10:00:00+0000 host app[1]: boom",
      "2026-07-08T10:01:00+0000 host app[1]: kaboom",
    ].join("\n");
    const entries = parseJournalErrors(stdout);
    assert.equal(entries[0].message, "host app[1]: kaboom");
    assert.equal(entries[0].timestamp, "2026-07-08T10:01:00+0000");
  });

  it("parses lastb and sshd journal failures", () => {
    const lastb = parseLastb("root ssh:notty 1.2.3.4 Sat Jul 8 10:00\nbtmp begins Sat Jul 8");
    assert.equal(lastb.length, 1);
    assert.equal(lastb[0].user, "root");
    assert.equal(lastb[0].from, "1.2.3.4");

    const ssh = parseSshFailures(
      "2026-07-08T10:00:00+0000 host sshd[1]: Failed password for invalid user admin from 9.9.9.9 port 22",
    );
    assert.equal(ssh[0].user, "admin");
    assert.equal(ssh[0].from, "9.9.9.9");
  });

  it("recent errors + failed logins degrade when tools missing", async () => {
    const errors = await collectRecentErrors({ run: async () => null });
    assert.equal(errors.available, false);
    const logins = await collectFailedLogins({ run: async () => null });
    assert.equal(logins.available, false);
  });
});

describe("collectCommandCenterSnapshot", () => {
  it("assembles all blocks and an overall ampel", async () => {
    const snapshot = await collectCommandCenterSnapshot({
      nowMs: NOW,
      diskTargets: [{ label: "Daten", path: "/data" }],
      units: [{ unit: "uwe.service", label: "UWE", kind: "service" }],
      deps: {
        run: fakeRun({
          "systemctl show uwe.service --property=LoadState --property=ActiveState --property=SubState --property=NextElapseUSecRealtime":
            { stdout: "LoadState=loaded\nActiveState=active\nSubState=running", code: 0 },
          ufw: { stdout: "Status: active", code: 0 },
          lsblk: { stdout: "crypt", code: 0 },
        }),
        readFile: async () => null,
        fileExists: async () => false,
      },
    });

    assert.equal(snapshot.collectedAt, new Date(NOW).toISOString());
    assert.equal(snapshot.services.length, 1);
    assert.equal(snapshot.disks.length, 1);
    assert.ok(snapshot.security.length >= 5);
    // diagnostic panels present and degrade cleanly with no host tools
    assert.equal(snapshot.network.available, false);
    assert.equal(snapshot.openPorts.available, false);
    assert.equal(snapshot.recentErrors.available, false);
    assert.equal(snapshot.failedLogins.available, false);
    // overall is a valid severity value, unaffected by diagnostic panels
    assert.ok(["ok", "warn", "error", "unknown"].includes(snapshot.overall));
  });
});
