import { resolveHostReadDeps, type HostReadDeps } from "./runner";
import type { HostSecurityCheck } from "./types";

/**
 * Host-laptop security posture. Every probe is read-only and degrades to
 * `unknown` + `manual` when the tool or file is unavailable or needs
 * privileges — mirroring `buildHomelabSecurityChecklist`. Nothing here should
 * ever throw or block the Command Center.
 */

function unknown(id: string, label: string, message: string): HostSecurityCheck {
  return { id, label, ok: false, severity: "unknown", message, manual: true };
}

async function checkFirewall(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "firewall";
  const label = "Firewall aktiv";
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
  return unknown(id, label, "Keine ufw/nftables-Info — Firewall manuell prüfen");
}

async function checkSshHardening(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "ssh_hardening";
  const label = "SSH gehärtet (kein Root-/Passwort-Login)";
  // Prefer the effective config; fall back to the raw file.
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

async function checkPendingUpdates(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "os_updates";
  const label = "OS-Updates eingespielt";
  // update-notifier caches a human-readable summary without needing apt locks.
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

async function checkRebootRequired(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "reboot_required";
  const label = "Kein Neustart erforderlich";
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

async function checkUnattendedUpgrades(deps: HostReadDeps): Promise<HostSecurityCheck> {
  const id = "unattended_upgrades";
  const label = "Automatische Sicherheitsupdates";
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

/** Collect the full host-security checklist, degrading gracefully per item. */
export async function collectHostSecurity(
  deps: Partial<HostReadDeps> = {},
): Promise<HostSecurityCheck[]> {
  const resolved = resolveHostReadDeps(deps);
  return Promise.all([
    checkFirewall(resolved),
    checkSshHardening(resolved),
    checkPendingUpdates(resolved),
    checkRebootRequired(resolved),
    checkUnattendedUpgrades(resolved),
    checkDiskEncryption(resolved),
  ]);
}
