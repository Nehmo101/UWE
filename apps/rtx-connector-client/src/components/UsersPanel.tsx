import { useCallback, useEffect, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";

import {
  COMMAND_CENTER_AREAS,
  COMMAND_CENTER_AREA_LABELS,
  createUser,
  deleteUser,
  listUsers,
  setUserPassword,
  updateUser,
  type CommandCenterArea,
  type CommandCenterAreaAccess,
  type CommandCenterUser,
} from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

const NO_ACCESS: CommandCenterAreaAccess = {
  portal: false,
  studio: false,
  brain: false,
  family: false,
};

const ALL_ACCESS: CommandCenterAreaAccess = {
  portal: true,
  studio: true,
  brain: true,
  family: true,
};

function summarize(user: CommandCenterUser): string {
  const granted = COMMAND_CENTER_AREAS.filter((area) => user.access?.[area]).map(
    (area) => COMMAND_CENTER_AREA_LABELS[area],
  );
  // Die KI steht hinter einem Trennstrich, nicht in der Reihe der Apps: sie
  // ist kein Ort, den jemand betritt, sondern etwas, das er auslösen darf.
  if (user.aiAccess) granted.push("RTX-KI");
  return granted.length > 0 ? granted.join(" · ") : "kein Zugang";
}

export function UsersPanel() {
  const [users, setUsers] = useState<CommandCenterUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Default to Portal only, so an address added without touching a checkbox
  // never silently gets Studio, Brain or Family. When no owner exists yet, the
  // create form pre-selects owner + everything (see refresh) for first-run setup.
  const [isOwner, setIsOwner] = useState(false);
  const [access, setAccess] = useState<CommandCenterAreaAccess>({ ...NO_ACCESS, portal: true });
  // Die RTX-KI ist beim Anlegen aus, wie jedes andere Recht auch. Wer sie
  // braucht, bekommt sie bewusst — nicht als Beifang des Studio-Häkchens.
  const [aiAccess, setAiAccess] = useState(false);

  const [pwUserId, setPwUserId] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await listUsers();
      if (!result.ok) throw new Error(result.message ?? "Zugänge konnten nicht geladen werden.");
      const nextUsers = result.users ?? [];
      setUsers(nextUsers);
      if (!nextUsers.some((user) => user.isOwner)) {
        setIsOwner(true);
        setAccess({ ...ALL_ACCESS });
        setAiAccess(true);
      }
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ownerExists = users.some((user) => user.isOwner);

  async function submitCreate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createUser({ displayName, email, password, isOwner, ...access, ai: aiAccess });
      if (!result.ok) throw new Error(result.message ?? "Zugang konnte nicht angelegt werden.");
      setMessage(`„${displayName}" wurde angelegt.`);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setIsOwner(false);
      setAccess({ ...NO_ACCESS, portal: true });
      setAiAccess(false);
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

  async function toggleArea(user: CommandCenterUser, area: CommandCenterArea, enabled: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateUser({ id: user.id, [area]: enabled });
      if (!result.ok) throw new Error(result.message ?? "Zugang konnte nicht geändert werden.");
      setMessage(
        `„${user.displayName}" ${enabled ? "hat jetzt" : "hat nicht mehr"} ${
          COMMAND_CENTER_AREA_LABELS[area]
        }.`,
      );
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAi(user: CommandCenterUser, enabled: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateUser({ id: user.id, ai: enabled });
      if (!result.ok) throw new Error(result.message ?? "RTX-KI konnte nicht geändert werden.");
      setMessage(
        `„${user.displayName}" ${enabled ? "darf jetzt" : "darf nicht mehr"} die RTX-KI benutzen.`,
      );
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function toggleOwner(user: CommandCenterUser, enabled: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateUser({ id: user.id, isOwner: enabled });
      if (!result.ok) throw new Error(result.message ?? "Owner konnte nicht geändert werden.");
      setMessage(`„${user.displayName}" ist ${enabled ? "jetzt" : "nicht mehr"} Owner.`);
      await refresh();
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
      if (!result.ok) throw new Error(result.message ?? "Zugang konnte nicht gelöscht werden.");
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
          <span className="connector-kicker">ZUGÄNGE · E-MAIL-ALLOWLIST</span>
          <h3>Zugänge verwalten</h3>
          <p>
            Pro E-Mail-Adresse entscheiden vier Häkchen, welche App sie betreten darf. Das fünfte,
            „RTX-KI&quot;, entscheidet etwas anderes: ob diese Adresse den RTX-Host beschäftigen darf —
            Generatoren, Bildstudio, Assistent. Der Owner darf es immer. Es gibt keine
            Selbstregistrierung — Konten legst nur du hier an.
          </p>
        </div>
        <div className="command-center-hero-status">
          <HealthBadge status={ownerExists ? "ok" : "error"} label={ownerExists ? "Owner vorhanden" : "Kein Owner"} />
          <small>{users.length} Adressen</small>
        </div>
      </section>

      {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
      {!ownerExists ? (
        <div className="connector-banner connector-banner-error">
          Es existiert noch kein Owner-Account. Lege zuerst eine Adresse mit dem Häkchen „Owner&quot; an —
          nur der Owner darf Wiederherstellung und Host-Steuerung auslösen.
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Neue Adresse freischalten</CardTitle></CardHeader>
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
            <fieldset className="connector-field">
              <span>Zugänge</span>
              <div className="connector-checkbox-row">
                {COMMAND_CENTER_AREAS.map((area) => (
                  <label key={area} className="connector-checkbox">
                    <input
                      type="checkbox"
                      checked={access[area]}
                      onChange={(event) =>
                        setAccess((current) => ({ ...current, [area]: event.target.checked }))
                      }
                    />
                    {COMMAND_CENTER_AREA_LABELS[area]}
                  </label>
                ))}
                <label className="connector-checkbox">
                  <input
                    type="checkbox"
                    checked={aiAccess}
                    onChange={(event) => setAiAccess(event.target.checked)}
                  />
                  RTX-KI
                </label>
                <label className="connector-checkbox">
                  <input
                    type="checkbox"
                    checked={isOwner}
                    onChange={(event) => setIsOwner(event.target.checked)}
                  />
                  Owner
                </label>
              </div>
            </fieldset>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="primary" onClick={submitCreate} disabled={createDisabled}>
            {busy ? "Wird angelegt …" : "Adresse freischalten"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader><CardTitle>Freigeschaltete Adressen</CardTitle></CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="connector-muted">Noch keine Adresse freigeschaltet.</p>
          ) : (
            <ul className="command-center-user-list">
              {users.map((user) => (
                <li key={user.id} className="command-center-user-row">
                  <div className="command-center-user-main">
                    <HealthBadge status={user.isOwner ? "ok" : "degraded"} label={user.isOwner ? "Owner" : summarize(user)} />
                    <div>
                      <strong>{user.displayName}</strong>
                      <p className="connector-muted">{user.email ?? "—"}</p>
                    </div>
                  </div>
                  <div className="connector-checkbox-row">
                    {COMMAND_CENTER_AREAS.map((area) => (
                      <label key={area} className="connector-checkbox">
                        <input
                          type="checkbox"
                          checked={user.access?.[area] ?? false}
                          disabled={busy}
                          onChange={(event) => void toggleArea(user, area, event.target.checked)}
                          aria-label={`${COMMAND_CENTER_AREA_LABELS[area]} für ${user.displayName}`}
                        />
                        {COMMAND_CENTER_AREA_LABELS[area]}
                      </label>
                    ))}
                    <label className="connector-checkbox">
                      <input
                        type="checkbox"
                        checked={user.isOwner || user.aiAccess}
                        // Beim Owner steht das Häkchen fest an: er darf die KI
                        // über `isOwner`, das Feld daneben ändert daran nichts.
                        // Ein abwählbares Häkchen ohne Wirkung wäre eine Lüge.
                        disabled={busy || user.isOwner}
                        onChange={(event) => void toggleAi(user, event.target.checked)}
                        aria-label={`RTX-KI für ${user.displayName}`}
                      />
                      RTX-KI
                    </label>
                    <label className="connector-checkbox">
                      <input
                        type="checkbox"
                        checked={user.isOwner}
                        disabled={busy}
                        onChange={(event) => void toggleOwner(user, event.target.checked)}
                        aria-label={`Owner für ${user.displayName}`}
                      />
                      Owner
                    </label>
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
