import { useCallback, useEffect, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";

import {
  createUser,
  deleteUser,
  listUsers,
  setUserPassword,
  type CommandCenterUser,
  type CommandCenterUserRole,
} from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

const ROLE_OPTIONS: { value: CommandCenterUserRole; label: string }[] = [
  { value: "owner", label: "Owner (voller Zugriff, Brain)" },
  { value: "admin", label: "Admin" },
  { value: "dm", label: "DM (Studio)" },
  { value: "player", label: "Player (Portal)" },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  dm: "DM",
  player: "Player",
  readonly: "Readonly",
  guest: "Gast",
};

export function UsersPanel() {
  const [users, setUsers] = useState<CommandCenterUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Default to the least-privileged role so a user added without touching the
  // dropdown never silently becomes an owner. When no owner exists yet, the
  // create form pre-selects owner (see refresh) to smooth first-run setup.
  const [role, setRole] = useState<CommandCenterUserRole>("player");

  const [pwUserId, setPwUserId] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await listUsers();
      if (!result.ok) throw new Error(result.message ?? "Benutzer konnten nicht geladen werden.");
      const nextUsers = result.users ?? [];
      setUsers(nextUsers);
      // First-run convenience: if there is no owner yet, pre-select the owner role.
      if (!nextUsers.some((user) => user.role === "owner")) setRole("owner");
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ownerExists = users.some((user) => user.role === "owner");

  async function submitCreate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createUser({ displayName, email, password, role });
      if (!result.ok) throw new Error(result.message ?? "Benutzer konnte nicht angelegt werden.");
      setMessage(`${ROLE_LABEL[role] ?? role} „${displayName}" wurde angelegt.`);
      setDisplayName("");
      setEmail("");
      setPassword("");
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await setUserPassword(id, pwValue);
      if (!result.ok) throw new Error(result.message ?? "Passwort konnte nicht gesetzt werden.");
      setMessage("Passwort wurde aktualisiert.");
      setPwUserId(null);
      setPwValue("");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user: CommandCenterUser) {
    if (!window.confirm(`„${user.displayName}" (${user.email ?? "ohne E-Mail"}) endgültig löschen?`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await deleteUser(user.id);
      if (!result.ok) throw new Error(result.message ?? "Benutzer konnte nicht gelöscht werden.");
      setMessage(`„${user.displayName}" wurde gelöscht.`);
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  const createDisabled =
    busy || !displayName.trim() || !email.trim() || password.length < 8;

  return (
    <div className="command-center-stack">
      <section className="command-center-hero is-attention">
        <div>
          <span className="connector-kicker">BENUTZER · OWNER · ZUGÄNGE</span>
          <h3>Benutzer & Owner verwalten</h3>
          <p>Lege den Owner und alle weiteren Benutzer direkt hier an — ohne die Studio-Weboberfläche.</p>
        </div>
        <div className="command-center-hero-status">
          <HealthBadge status={ownerExists ? "ok" : "error"} label={ownerExists ? "Owner vorhanden" : "Kein Owner"} />
          <small>{users.length} Benutzer</small>
        </div>
      </section>

      {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
      {!ownerExists ? (
        <div className="connector-banner connector-banner-error">
          Es existiert noch kein Owner-Account. Lege zuerst einen Benutzer mit der Rolle „Owner" an —
          nur der Owner erreicht den privaten Brain-Bereich.
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Neuen Benutzer / Owner anlegen</CardTitle></CardHeader>
        <CardContent>
          <div className="connector-form-grid">
            <label className="connector-field">
              <span>Anzeigename</span>
              <input className="connector-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Lasse" />
            </label>
            <label className="connector-field">
              <span>E-Mail</span>
              <input className="connector-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.org" />
            </label>
            <label className="connector-field">
              <span>Passwort (min. 8 Zeichen)</span>
              <input className="connector-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
            </label>
            <label className="connector-field">
              <span>Rolle</span>
              <select className="connector-select" value={role} onChange={(event) => setRole(event.target.value as CommandCenterUserRole)}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="primary" onClick={submitCreate} disabled={createDisabled}>
            {busy ? "Wird angelegt …" : "Benutzer anlegen"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bestehende Benutzer</CardTitle></CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="connector-muted">Noch keine Benutzer.</p>
          ) : (
            <ul className="command-center-user-list">
              {users.map((user) => (
                <li key={user.id} className="command-center-user-row">
                  <div className="command-center-user-main">
                    <HealthBadge status={user.role === "owner" ? "ok" : "degraded"} label={ROLE_LABEL[user.role] ?? user.role} />
                    <div>
                      <strong>{user.displayName}</strong>
                      <p className="connector-muted">{user.email ?? "—"}</p>
                    </div>
                  </div>
                  <div className="connector-actions">
                    <Button variant="ghost" onClick={() => { setPwUserId(pwUserId === user.id ? null : user.id); setPwValue(""); }} disabled={busy}>
                      Passwort ändern
                    </Button>
                    <Button variant="destructive" onClick={() => removeUser(user)} disabled={busy}>
                      Löschen
                    </Button>
                  </div>
                  {pwUserId === user.id ? (
                    <div className="command-center-user-pw">
                      <input className="connector-input" type="password" value={pwValue} onChange={(event) => setPwValue(event.target.value)} placeholder="Neues Passwort (min. 8 Zeichen)" />
                      <Button variant="primary" onClick={() => submitPassword(user.id)} disabled={busy || pwValue.length < 8}>Speichern</Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="ghost" onClick={() => void refresh()} disabled={busy}>Neu laden</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
