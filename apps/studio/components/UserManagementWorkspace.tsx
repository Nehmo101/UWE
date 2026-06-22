"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { SECURITY_ROLE_LABELS } from "@uwe/auth";
import { formatStudioDateOrDash } from "@/src/lib/format";

interface WorldRef {
  id: string;
  name: string;
  slug: string;
}

interface WorldMembershipView {
  id: string;
  worldId: string;
  role: "owner" | "dm" | "co_dm" | "player";
  characterName: string | null;
  world: WorldRef;
}

interface AdminUserView {
  id: string;
  displayName: string;
  email: string | null;
  role: "owner" | "admin" | "dm" | "player" | "readonly" | "guest";
  status?: "invited" | "active" | "disabled";
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  worldMemberships: WorldMembershipView[];
}

const USER_ROLES = ["owner", "admin", "dm", "player", "readonly", "guest"] as const;
const USER_STATUSES = ["invited", "active", "disabled"] as const;
const WORLD_ROLES = ["owner", "dm", "co_dm", "player"] as const;

const STATUS_LABELS: Record<(typeof USER_STATUSES)[number], string> = {
  invited: "Eingeladen",
  active: "Aktiv",
  disabled: "Deaktiviert",
};

export function UserManagementWorkspace() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [worlds, setWorlds] = useState<WorldRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    displayName: "",
    email: "",
    password: "",
    role: "player" as (typeof USER_ROLES)[number],
    status: "active" as (typeof USER_STATUSES)[number],
  });

  const [editForm, setEditForm] = useState({
    displayName: "",
    email: "",
    role: "player" as (typeof USER_ROLES)[number],
    status: "active" as (typeof USER_STATUSES)[number],
    password: "",
  });

  const [membershipForm, setMembershipForm] = useState({
    worldId: "",
    role: "player" as (typeof WORLD_ROLES)[number],
    characterName: "",
  });

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(studioApiUrl("/api/admin/users"));
      if (!response.ok) {
        throw new Error(`Benutzer konnten nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as { users: AdminUserView[]; worlds?: WorldRef[] };
      setUsers(data.users);
      if (data.worlds) {
        setWorlds(data.worlds);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedUser) return;
    setEditForm({
      displayName: selectedUser.displayName,
      email: selectedUser.email ?? "",
      role: selectedUser.role,
      status: selectedUser.status ?? "active",
      password: "",
    });
    setMembershipForm({ worldId: "", role: "player", characterName: "" });
  }, [selectedUser]);

  async function createUser() {
    setError(null);
    const response = await fetch(studioApiUrl("/api/admin/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Benutzer konnte nicht erstellt werden.");
      return;
    }
    setCreateForm({
      displayName: "",
      email: "",
      password: "",
      role: "player",
      status: "active",
    });
    await loadUsers();
  }

  async function saveUser() {
    if (!selectedUser) return;
    setError(null);

    const response = await fetch(studioApiUrl(`/api/admin/users/${selectedUser.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: editForm.displayName,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Benutzer konnte nicht gespeichert werden.");
      return;
    }

    if (editForm.password.trim().length >= 8) {
      const passwordResponse = await fetch(studioApiUrl(`/api/admin/users/${selectedUser.id}/reset-password`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: editForm.password }),
      });
      const passwordData = (await passwordResponse.json()) as { error?: string };
      if (!passwordResponse.ok) {
        setError(passwordData.error ?? "Passwort konnte nicht gesetzt werden.");
        return;
      }
      setEditForm((current) => ({ ...current, password: "" }));
    }

    await loadUsers();
  }

  async function toggleUserStatus(user: AdminUserView) {
    setError(null);
    const endpoint =
      user.status === "disabled"
        ? `/api/admin/users/${user.id}/enable`
        : `/api/admin/users/${user.id}/disable`;
    const response = await fetch(studioApiUrl(endpoint), { method: "POST" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Status konnte nicht geändert werden.");
      return;
    }
    await loadUsers();
  }

  async function deleteUser(user: AdminUserView) {
    const confirmed = window.confirm(
      `Benutzer „${user.displayName}“ endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
    );
    if (!confirmed) return;

    setError(null);
    const response = await fetch(studioApiUrl(`/api/admin/users/${user.id}/delete`), { method: "POST" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Benutzer konnte nicht gelöscht werden.");
      return;
    }
    setSelectedUserId(null);
    await loadUsers();
  }

  async function addMembership() {
    if (!selectedUser || !membershipForm.worldId) return;
    setError(null);
    const response = await fetch(studioApiUrl(`/api/admin/users/${selectedUser.id}/world-memberships`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(membershipForm),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Mitgliedschaft konnte nicht gespeichert werden.");
      return;
    }
    setMembershipForm({ worldId: "", role: "player", characterName: "" });
    await loadUsers();
  }

  async function removeMembership(worldId: string) {
    if (!selectedUser) return;
    setError(null);
    const response = await fetch(
      studioApiUrl(`/api/admin/users/${selectedUser.id}/world-memberships/${worldId}`),
      { method: "DELETE" },
    );
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Mitgliedschaft konnte nicht entfernt werden.");
      return;
    }
    await loadUsers();
  }

  return (
    <>
      {error && (
        <p className="uwe-alert uwe-alert-error" role="alert">
          {error}
        </p>
      )}

      <section className="uwe-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Neuen Benutzer anlegen</h2>
        <div className="uwe-form-grid">
          <label>
            Name
            <input
              type="text"
              value={createForm.displayName}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, displayName: event.target.value }))
              }
            />
          </label>
          <label>
            E-Mail
            <input
              type="email"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              value={createForm.password}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>
          <label>
            Rolle
            <select
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  role: event.target.value as (typeof USER_ROLES)[number],
                }))
              }
            >
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {SECURITY_ROLE_LABELS[role] ?? role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={createForm.status}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  status: event.target.value as (typeof USER_STATUSES)[number],
                }))
              }
            >
              {USER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="uwe-btn uwe-btn-primary" onClick={() => void createUser()}>
          Benutzer erstellen
        </button>
      </section>

      <section className="uwe-card" style={{ marginBottom: "1.5rem" }}>
        <h2>Benutzer</h2>
        {loading ? (
          <p>Lade Benutzer…</p>
        ) : users.length === 0 ? (
          <p>Noch keine Benutzer angelegt.</p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Status</th>
                <th>Letzter Login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.email ?? "—"}</td>
                  <td>{SECURITY_ROLE_LABELS[user.role] ?? user.role}</td>
                  <td>{STATUS_LABELS[user.status ?? "active"]}</td>
                  <td>{formatStudioDateOrDash(user.lastLoginAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="uwe-btn uwe-btn-ghost"
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selectedUser && (
        <section className="uwe-card uwe-form">
          <h2>{selectedUser.displayName} bearbeiten</h2>
          <div className="uwe-form-grid">
            <label>
              Name
              <input
                type="text"
                value={editForm.displayName}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </label>
            <label>
              E-Mail
              <input
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label>
              Rolle
              <select
                value={editForm.role}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    role: event.target.value as (typeof USER_ROLES)[number],
                  }))
                }
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {SECURITY_ROLE_LABELS[role] ?? role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    status: event.target.value as (typeof USER_STATUSES)[number],
                  }))
                }
              >
                {USER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Neues Passwort (optional)
              <input
                type="password"
                value={editForm.password}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="uwe-form-actions">
            <button type="button" className="uwe-btn uwe-btn-primary" onClick={() => void saveUser()}>
              Speichern
            </button>
            <button
              type="button"
              className="uwe-btn uwe-btn-secondary"
              onClick={() => void toggleUserStatus(selectedUser)}
            >
              {selectedUser.status === "disabled" ? "Reaktivieren" : "Deaktivieren"}
            </button>
            <button
              type="button"
              className="uwe-btn uwe-btn-danger"
              onClick={() => void deleteUser(selectedUser)}
            >
              Endgültig löschen
            </button>
            <button
              type="button"
              className="uwe-btn uwe-btn-ghost"
              onClick={() => setSelectedUserId(null)}
            >
              Schließen
            </button>
          </div>

          <h3>Welt-Mitgliedschaften</h3>
          {selectedUser.worldMemberships.length === 0 ? (
            <p>Keine Welten zugeordnet.</p>
          ) : (
            <ul className="uwe-list">
              {selectedUser.worldMemberships.map((membership) => (
                <li key={membership.id}>
                  <strong>{membership.world.name}</strong> —{" "}
                  {SECURITY_ROLE_LABELS[membership.role] ?? membership.role}
                  {membership.characterName ? ` (${membership.characterName})` : ""}
                  <button
                    type="button"
                    className="uwe-btn uwe-btn-ghost"
                    onClick={() => void removeMembership(membership.worldId)}
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="uwe-form-grid" style={{ marginTop: "1rem" }}>
            <label>
              Welt
              <select
                value={membershipForm.worldId}
                onChange={(event) =>
                  setMembershipForm((current) => ({ ...current, worldId: event.target.value }))
                }
              >
                <option value="">Welt wählen…</option>
                {worlds.map((world) => (
                  <option key={world.id} value={world.id}>
                    {world.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rollen in der Welt
              <select
                value={membershipForm.role}
                onChange={(event) =>
                  setMembershipForm((current) => ({
                    ...current,
                    role: event.target.value as (typeof WORLD_ROLES)[number],
                  }))
                }
              >
                {WORLD_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {SECURITY_ROLE_LABELS[role] ?? role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Charaktername
              <input
                type="text"
                value={membershipForm.characterName}
                onChange={(event) =>
                  setMembershipForm((current) => ({
                    ...current,
                    characterName: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <button type="button" className="uwe-btn uwe-btn-secondary" onClick={() => void addMembership()}>
            Mitgliedschaft hinzufügen
          </button>
        </section>
      )}
    </>
  );
}
