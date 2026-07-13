import { resolveHostReadDeps, type HostReadDeps } from "./runner";
import type { HostSecurityCheck } from "./types";

/**
 * Host-laptop security posture. Every probe is read-only and degrades to
 * `unknown` + `manual` when the tool or file is unavailable or needs
 * privileges. Debian/Ubuntu and Fedora use different host tooling, but expose
 * the same stable checks to the Command Center.
 */

type HostDistro = "debian" | "fedora" | "other";

function unknown(id: string, label: string, message: string): HostSecurityCheck {
  return { id, label, ok: false, severity: "unknown", message, manual: true };
}

export function parseHostDistro(osRelease: string | null): HostDistro {
  const id = /^ID=["']?([^"'\n]+)["']?$/m.exec(osRelease ?? "")?.[1]?.trim();
  if (id === "fedora") return "fedora";
  if (id === "debian" || id === "ubuntu") return "debian";
  return "other";
}

async function checkFirewall(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "firewall";
  const label = "Firewall aktiv";

  const firewalld = await deps.run("firewall-cmd", ["--state"]);
  if (firewalld != null) {
    const active = firewalld.code === 0 && /running/i.test(firewalld.stdout);
    return {
      id,
      label,
      ok: active,
      severity: active ? "ok" : "warn",
      message: active ? "firewalld aktiv" : "firewalld installiert, aber inaktiv",
      manual: false,
    };
  }

  const ufw = await deps.run("ufw", ["status"]);
  if (ufw != null && ufw.code === 0) {
    const active = /Status:\s*active/i.test(ufw.stdout);
    return {
      id,
      label,
      ok: active,
      severity: active ? "ok" : "warn",
      message: active ? "ufw aktiv" : "ufw installiert, aber inaktiv",
      manual: false,
    };
  }

  const nft = await deps.run("nft", ["list", "ruleset"]);
  if (nft != null && nft.code === 0) {
    const hasRules = /\bchain\b/.test(nft.stdout) && nft.stdout.trim().length > 0;
    return {
      id,
      label,
      ok: hasRules,
      severity: hasRules ? "ok" : "warn",
      message: hasRules ? "nftables-Regeln aktiv" : "nftables ohne Regeln",
      manual: false,
    };
  }
  return unknown(id, label, "Keine firewalld/ufw/nftables-Info — Firewall manuell prüfen");
}

async function checkSshHardening(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "ssh_hardening";
  const label = "SSH gehärtet (kein Root-/Passwort-Login)";
  const effective = await deps.run("sshd", ["-T"]);
  const raw = effective?.code === 0 ? effective.stdout : await deps.readFile("/etc/ssh/sshd_config");
  if (raw == null) {
    return unknown(id, label, "sshd-Konfiguration nicht lesbar — manuell prüfen");
  }
  const text = raw.toLowerCase();
  const rootLoginNo = /permitrootlogin\s+(no|prohibit-password)/.test(text);
  const passwordNo = /passwordauthentication\s+no/.test(text);
  const ok = rootLoginNo && passwordNo;
  const gaps = [
    !rootLoginNo && "Root-Login erlaubt",
    !passwordNo && "Passwort-Login erlaubt",
  ].filter(Boolean);
  return {
    id,
    label,
    ok,
    severity: ok ? "ok" : "warn",
    message: ok ? "Root- und Passwort-Login deaktiviert" : gaps.join(", "),
    manual: false,
  };
}

export function countDnfUpdates(stdout: string): number {
  return stdout
    .split(/\r?\n/)
    .filter((line) => /^\S+\.(?:x86_64|aarch64|noarch|i686)\s+\S+\s+\S+/.test(line.trim()))
    .length;
}

export function parseDnfRebootRequired(stdout: string): boolean | null {
  try {
    const payload = JSON.parse(stdout) as Array<{ reboot_required?: unknown }>;
    const value = payload[0]?.reboot_required;
    return typeof value === "boolean" ? value : null;
  } catch {
    return null;
  }
}
export function dnfAutomaticAppliesUpdates(config: string | null): boolean {
  return /^\s*apply_updates\s*=\s*(?:true|yes|1)\s*(?:[#;].*)?$/im.test(config ?? "");
}

async function checkPendingUpdates(
  deps: HostReadDeps,
  distro: HostDistro,
): Promise<HostSecurityCheck> {
  const id = "os_updates";
  const label = "OS-Updates eingespielt";

  if (distro === "fedora") {
    // Cache-only keeps the frequently-polled Command Center read-only, fast and
    // independent of mirror availability. The system's normal DNF timer/update
    // workflow refreshes this metadata.
    const result = await deps.run("dnf", ["--cacheonly", "--quiet", "check-upgrade"]);
    if (result != null && (result.code === 0 || result.code === 100)) {
      const count = countDnfUpdates(result.stdout);
      return {
        id,
        label,
        ok: count === 0,
        severity: count === 0 ? "ok" : "warn",
        message: count === 0 ? "Keine ausstehenden Updates" : `${count} DNF-Update(s) verfügbar`,
        manual: false,
      };
    }
    return unknown(id, label, "DNF-Update-Cache nicht lesbar — dnf makecache ausführen");
  }

  const summary = await deps.readFile("/var/lib/update-notifier/updates-available");
  if (summary != null) {
    const match = /(\d+)\s+update/i.exec(summary);
    const count = match ? Number(match[1]) : 0;
    const secMatch = /(\d+)\s+.*securit/i.exec(summary);
    const security = secMatch ? Number(secMatch[1]) : 0;
    const ok = count === 0;
    return {
      id,
      label,
      ok,
      severity: security > 0 ? "warn" : ok ? "ok" : "warn",
      message: ok
        ? "Keine ausstehenden Updates"
        : `${count} Update(s) verfügbar${security > 0 ? `, davon ${security} sicherheitsrelevant` : ""}`,
      manual: false,
    };
  }
  return unknown(id, label, "Update-Status nicht lesbar — manuell prüfen");
}

async function checkRebootRequired(
  deps: HostReadDeps,
  distro: HostDistro,
): Promise<HostSecurityCheck> {
  const id = "reboot_required";
  const label = "Kein Neustart erforderlich";

  if (distro === "fedora") {
    const result = await deps.run("dnf", ["--cacheonly", "needs-restarting", "--json"]);
    const required = result == null ? null : parseDnfRebootRequired(result.stdout);
    if (required == null) {
      return unknown(id, label, "DNF needs-restarting nicht verfügbar — Neustartbedarf manuell prüfen");
    }
    return {
      id,
      label,
      ok: !required,
      severity: required ? "warn" : "ok",
      message: required ? "Neustart nach Update erforderlich" : "Kein Neustart nötig",
      manual: false,
    };
  }

  const required = await deps.fileExists("/var/run/reboot-required");
  return {
    id,
    label,
    ok: !required,
    severity: required ? "warn" : "ok",
    message: required ? "Neustart nach Update erforderlich" : "Kein Neustart nötig",
    manual: false,
  };
}

async function checkAutomaticUpdates(
  deps: HostReadDeps,
  distro: HostDistro,
): Promise<HostSecurityCheck> {
  const id = "unattended_upgrades";
  const label = "Automatische Sicherheitsupdates";

  if (distro === "fedora") {
    let systemctlAvailable = false;
    for (const unit of ["dnf5-automatic.timer", "dnf-automatic.timer"]) {
      const result = await deps.run("systemctl", ["is-enabled", unit]);
      if (result == null) continue;
      systemctlAvailable = true;
      if (result.code === 0 && /enabled|static/.test(result.stdout)) {
        const config = await deps.readFile("/etc/dnf/automatic.conf");
        const appliesUpdates = dnfAutomaticAppliesUpdates(config);
        return {
          id,
          label,
          ok: appliesUpdates,
          severity: appliesUpdates ? "ok" : "warn",
          message: appliesUpdates
            ? `${unit} installiert Updates automatisch`
            : `${unit} aktiv, aber apply_updates ist nicht aktiviert`,
          manual: false,
        };
      }
    }
    if (systemctlAvailable) {
      return {
        id,
        label,
        ok: false,
        severity: "warn",
        message: "Kein DNF-Automatic-Timer aktiviert",
        manual: false,
      };
    }
    return unknown(id, label, "DNF-Automatic-Status nicht lesbar");
  }

  const conf = await deps.readFile("/etc/apt/apt.conf.d/20auto-upgrades");
  if (conf == null) {
    return unknown(id, label, "unattended-upgrades nicht konfiguriert gefunden");
  }
  const enabled = /Unattended-Upgrade"?\s+"1"/.test(conf) || /Update-Package-Lists"?\s+"1"/.test(conf);
  return {
    id,
    label,
    ok: enabled,
    severity: enabled ? "ok" : "warn",
    message: enabled ? "unattended-upgrades aktiv" : "unattended-upgrades inaktiv",
    manual: false,
  };
}

async function checkDiskEncryption(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "disk_encryption";
  const label = "Festplatten-Verschlüsselung (LUKS)";
  const lsblk = await deps.run("lsblk", ["-o", "TYPE", "-n"]);
  if (lsblk != null && lsblk.code === 0) {
    const encrypted = /\bcrypt\b/.test(lsblk.stdout);
    return {
      id,
      label,
      ok: encrypted,
      severity: encrypted ? "ok" : "warn",
      message: encrypted ? "LUKS-Volume aktiv" : "Keine crypt-Volumes erkannt",
      manual: false,
    };
  }
  return unknown(id, label, "lsblk nicht verfügbar — Verschlüsselung manuell prüfen");
}

async function checkSelinux(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "selinux";
  const label = "SELinux erzwingt Richtlinien";
  const result = await deps.run("getenforce", []);
  if (result == null || result.code !== 0) {
    return unknown(id, label, "SELinux-Status nicht lesbar");
  }
  const state = result.stdout.trim().toLowerCase();
  const enforcing = state === "enforcing";
  return {
    id,
    label,
    ok: enforcing,
    severity: enforcing ? "ok" : "warn",
    message: enforcing ? "SELinux enforcing" : `SELinux ${state || "unbekannt"}`,
    manual: false,
  };
}

/** Collect the full host-security checklist, degrading gracefully per item. */
export async function collectHostSecurity(
  deps: Partial<HostReadDeps> = {},
): Promise<HostSecurityCheck[]> {
  const resolved = resolveHostReadDeps(deps);
  const distro = parseHostDistro(await resolved.readFile("/etc/os-release"));
  const checks = await Promise.all([
    checkFirewall(resolved),
    checkSshHardening(resolved),
    checkPendingUpdates(resolved, distro),
    checkRebootRequired(resolved, distro),
    checkAutomaticUpdates(resolved, distro),
    checkDiskEncryption(resolved),
  ]);
  if (distro === "fedora") {
    checks.push(await checkSelinux(resolved));
  }
  return checks;
}
