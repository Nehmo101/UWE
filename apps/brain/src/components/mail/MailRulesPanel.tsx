"use client";

import * as React from "react";
import { MailButton, IconButton } from "./mail-ui";
import { NavIcon } from "@uwe/shared-ui";

interface RuleVM {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Array<{ field: string; op?: string; value: unknown }>;
  actions: Array<{ type: string; target?: string; category?: string; priority?: number }>;
}

interface VipVM {
  id: string;
  address: string;
  label: string | null;
}

const CONDITION_FIELDS = [
  { value: "from", label: "Absender enthält" },
  { value: "subject", label: "Betreff enthält" },
] as const;

const ACTION_TYPES = [
  { value: "markRead", label: "Als gelesen markieren" },
  { value: "star", label: "Markieren (Stern)" },
  { value: "move:archive", label: "Ins Archiv" },
  { value: "move:trash", label: "In Papierkorb" },
  { value: "skipAiTriage", label: "KI-Triage überspringen" },
] as const;

function describeRule(rule: RuleVM): string {
  const cond = rule.conditions
    .map((c) => `${c.field}~"${String(c.value)}"`)
    .join(" & ");
  const act = rule.actions.map((a) => (a.type === "move" ? `move→${a.target}` : a.type)).join(", ");
  return `${cond || "—"}  →  ${act || "—"}`;
}

/** Rules + VIP-sender management. Local-only, no LLM. Embedded in Mail settings. */
export function MailRulesPanel() {
  const [rules, setRules] = React.useState<RuleVM[]>([]);
  const [vips, setVips] = React.useState<VipVM[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [field, setField] = React.useState<string>("from");
  const [value, setValue] = React.useState("");
  const [action, setAction] = React.useState<string>("move:archive");

  const [vipAddress, setVipAddress] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mail/rules", { headers: { Accept: "application/json" } });
      const data = (await response.json().catch(() => ({}))) as { rules?: RuleVM[]; vips?: VipVM[] };
      setRules(data.rules ?? []);
      setVips(data.vips ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createRule() {
    if (!name.trim() || !value.trim()) {
      setStatus("Name und Bedingungswert sind erforderlich.");
      return;
    }
    const actions =
      action === "move:archive"
        ? [{ type: "move", target: "archive" }]
        : action === "move:trash"
          ? [{ type: "move", target: "trash" }]
          : [{ type: action }];
    const response = await fetch("/api/mail/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        conditions: [{ field, op: "contains", value: value.trim() }],
        actions,
      }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setStatus(data.error ?? "Regel konnte nicht angelegt werden.");
      return;
    }
    setName("");
    setValue("");
    setStatus(null);
    await load();
  }

  async function toggleRule(rule: RuleVM) {
    await fetch(`/api/mail/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    await load();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/mail/rules/${id}`, { method: "DELETE" });
    await load();
  }

  async function addVip() {
    if (!vipAddress.trim()) return;
    await fetch("/api/mail/vips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: vipAddress.trim() }),
    });
    setVipAddress("");
    await load();
  }

  async function removeVip(id: string) {
    await fetch(`/api/mail/vips?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: "var(--uwe-fg)",
    background: "var(--uwe-card-bg)",
    border: "1px solid var(--uwe-border)",
    borderRadius: 8,
    padding: "5px 9px",
    fontFamily: "inherit",
  };

  return (
    <div>
      {loading ? (
        <p style={{ margin: "4px 0", fontSize: 12.5, color: "var(--uwe-fg-subtle)" }}>Wird geladen…</p>
      ) : (
        <>
          {rules.length === 0 ? (
            <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "var(--uwe-fg-subtle)" }}>
              Noch keine Regeln. Regeln laufen lokal beim Sync — z. B. Newsletter automatisch archivieren.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 0",
                  borderBottom: "1px solid var(--uwe-border-muted)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--uwe-fg)" }}>{rule.name}</div>
                  <div style={{ fontSize: 11, color: "var(--uwe-fg-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {describeRule(rule)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleRule(rule)}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid var(--uwe-border-muted)",
                    background: rule.enabled ? "color-mix(in srgb, var(--uwe-success) 16%, transparent)" : "transparent",
                    color: rule.enabled ? "var(--uwe-success)" : "var(--uwe-fg-subtle)",
                    cursor: "pointer",
                  }}
                >
                  {rule.enabled ? "aktiv" : "aus"}
                </button>
                <IconButton icon="trash-2" size={14} tone="danger" title="Regel löschen" onClick={() => void deleteRule(rule.id)} />
              </div>
            ))
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center", marginTop: 12 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Regelname" style={{ ...inputStyle, width: 130 }} />
            <select value={field} onChange={(e) => setField(e.target.value)} style={inputStyle}>
              {CONDITION_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Wert" style={{ ...inputStyle, width: 130 }} />
            <select value={action} onChange={(e) => setAction(e.target.value)} style={inputStyle}>
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <MailButton variant="subtle" size="sm" icon="plus" onClick={() => void createRule()}>
              Regel
            </MailButton>
          </div>
          {status ? <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--uwe-danger)" }}>{status}</div> : null}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--uwe-border-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <NavIcon name="star" width={14} height={14} style={{ color: "var(--uwe-warning)" }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--uwe-fg)" }}>VIP-Absender</span>
              <span style={{ fontSize: 11, color: "var(--uwe-fg-subtle)" }}>— erhöhen die Priorität automatisch</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {vips.map((vip) => (
                <span
                  key={vip.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    border: "1px solid var(--uwe-border)",
                    borderRadius: 999,
                    padding: "2px 6px 2px 10px",
                    background: "var(--uwe-card-bg)",
                    color: "var(--uwe-fg)",
                  }}
                >
                  {vip.address}
                  <IconButton icon="x" size={12} title="Entfernen" onClick={() => void removeVip(vip.id)} />
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
              <input
                value={vipAddress}
                onChange={(e) => setVipAddress(e.target.value)}
                placeholder="vip@example.com"
                style={{ ...inputStyle, flex: 1 }}
              />
              <MailButton variant="subtle" size="sm" icon="plus" onClick={() => void addVip()}>
                VIP
              </MailButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
