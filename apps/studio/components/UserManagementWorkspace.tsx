"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { UWE_AREAS, UWE_AREA_LABELS, type AreaAccess, type UweArea } from "@uwe/auth";
import { formatStudioDateOrDash } from "@/src/lib/format";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, type BadgeProps } from "@/src/components/ui";

interface WorldRef {
  id: string;
  name: string;
  slug: string;
}

interface WorldMembershipView {
  id: string;
  worldId: string;
  characterName: string | null;
  world: WorldRef;
}

interface AdminUserView {
  id: string;
  displayName: string;
  email: string | null;
  isOwner: boolean;
  access: AreaAccess;
  status?: "invited" | "active" | "disabled";
  hasPassword?: boolean;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  worldMemberships: WorldMembershipView[];
}

interface PortalAccessEvaluationView {
  allowed: boolean;
  summary: "granted" | "partial" | "denied";
  checks: Array<{ id: string; label: string; pass: boolean; detail?: string }>;
  blockers: string[];
}

const USER_STATUSES = ["invited", "active", "disabled"] as const;

/** The four checkboxes plus the owner flag, as the API expects them. */
const NO_ACCESS: AreaAccess = { portal: false, studio: false, brain: false, family: false };

function accessToBody(isOwner: boolean, access: AreaAccess) {
  return {
    isOwner,
    portalAccess: access.portal,
    studioAccess: access.studio,
    brainAccess: access.brain,
    familyAccess: access.family,
  };
}

function summarizeAccess(user: AdminUserView): string {
  const granted = UWE_AREAS.filter((area) => user.access[area]).map((area) => UWE_AREA_LABELS[area]);
  if (user.isOwner) {
    granted.unshift("Owner");
  }
  return granted.length > 0 ? granted.join(" · ") : "—";
}

const STATUS_LABELS: Record<(typeof USER_STATUSES)[number], string> = {
  invited: "Eingeladen",
  active: "Aktiv",
  disabled: "Deaktiviert",
};

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

/** Native select styling — siehe TODO(design-kit) bei der ersten Verwendung unten. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

type PortalAccessBadgeVariant = NonNullable<BadgeProps["variant"]>;

function portalAccessBadge(user: AdminUserView): { label: string; variant: PortalAccessBadgeVariant } {
  if (user.status !== "active") return { label: "Inaktiv", variant: "danger" };
  if (!user.hasPassword || !user.email?.trim()) return { label: "Login unvollständig", variant: "warning" };
  if (!user.access.portal) return { label: "Kein Portal-Häkchen", variant: "warning" };
  if (!user.access.studio && user.worldMemberships.length === 0) {
    return { label: "Keine Welten", variant: "warning" };
  }
  return { label: "Portal bereit", variant: "success" };
}

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
    isOwner: false,
    access: { ...NO_ACCESS, portal: true } as AreaAccess,
    status: "active" as (typeof USER_STATUSES)[number],
  });

  const [editForm, setEditForm] = useState({
    displayName: "",
    email: "",
    isOwner: false,
    access: { ...NO_ACCESS } as AreaAccess,
    status: "active" as (typeof USER_STATUSES)[number],
    password: "",
  });

  const [membershipForm, setMembershipForm] = useState({
    worldId: "",
    characterName: "",
  });
  const [portalAccess, setPortalAccess] = useState<PortalAccessEvaluationView | null>(null);
  const [portalAccessLoading, setPortalAccessLoading] = useState(false);
  const [portalAccessError, setPortalAccessError] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const filteredUsers = users.filter((user) => {
    if (areaFilter && !user.access[areaFilter as UweArea]) return false;
    if (statusFilter && (user.status ?? "active") !== statusFilter) return false;
    return true;
  });

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
      isOwner: selectedUser.isOwner,
      access: { ...selectedUser.access },
      status: selectedUser.status ?? "active",
      password: "",
    });
    setMembershipForm({ worldId: "", characterName: "" });
    setPortalAccess(null);
    setPortalAccessError(null);
  }, [selectedUser]);

  async function createUser() {
    setError(null);
    const response = await fetch(studioApiUrl("/api/admin/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: createForm.displayName,
        email: createForm.email,
        password: createForm.password,
        status: createForm.status,
        ...accessToBody(createForm.isOwner, createForm.access),
      }),
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
      isOwner: false,
      access: { ...NO_ACCESS, portal: true },
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
        status: editForm.status,
        ...accessToBody(editForm.isOwner, editForm.access),
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
      setError(data.error ?? "Zuordnung konnte nicht gespeichert werden.");
      return;
    }
    setMembershipForm({ worldId: "", characterName: "" });
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

  async function checkPortalAccess() {
    if (!selectedUser) return;
    setPortalAccessLoading(true);
    setPortalAccessError(null);
    setPortalAccess(null);
    try {
      const response = await fetch(studioApiUrl(`/api/admin/users/${selectedUser.id}/portal-access`));
      const data = (await response.json()) as { evaluation?: PortalAccessEvaluationView; error?: string };
      if (!response.ok) {
        setPortalAccessError(data.error ?? `Portalzugriff konnte nicht geprüft werden (${response.status}).`);
        return;
      }
      if (data.evaluation) setPortalAccess(data.evaluation);
    } catch (err) {
      setPortalAccessError(err instanceof Error ? err.message : "Portalzugriff konnte nicht geprüft werden.");
    } finally {
      setPortalAccessLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <Alert tone="danger" role="alert">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Neuen Benutzer anlegen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-user-name">Name</Label>
              <Input id="create-user-name" type="text" value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-user-email">E-Mail</Label>
              <Input id="create-user-email" type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-user-password">Passwort</Label>
              <Input id="create-user-password" type="password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} />
            </div>
            {/* TODO(design-kit): Alle Selects hier sind controlled (value+onChange) bzw. brauchen einen
                Leerwert ("Welt wählen…") — Kit-Select (Radix) unterstützt das nicht; native <select> bleibt. */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Zugänge</Label>
              <div className="flex flex-wrap gap-4">
                {UWE_AREAS.map((area) => (
                  <label key={area} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={createForm.access[area]}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          access: { ...current.access, [area]: event.target.checked },
                        }))
                      }
                      className="size-4 rounded border-input"
                    />
                    {UWE_AREA_LABELS[area]}
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createForm.isOwner}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, isOwner: event.target.checked }))
                    }
                    className="size-4 rounded border-input"
                  />
                  Owner
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-user-status">Status</Label>
              <select id="create-user-status" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as (typeof USER_STATUSES)[number] }))} className={NATIVE_SELECT_CLASS}>
                {USER_STATUSES.map((status) => (<option key={status} value={status}>{STATUS_LABELS[status]}</option>))}
              </select>
            </div>
          </div>
          <Button type="button" onClick={() => void createUser()} className="self-start">Benutzer erstellen</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Benutzer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-area">Zugang filtern</Label>
              <select id="filter-area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} className={NATIVE_SELECT_CLASS}>
                <option value="">Alle Zugänge</option>
                {UWE_AREAS.map((area) => (<option key={area} value={area}>{UWE_AREA_LABELS[area]}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-status">Status filtern</Label>
              <select id="filter-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={NATIVE_SELECT_CLASS}>
                <option value="">Alle Status</option>
                {USER_STATUSES.map((status) => (<option key={status} value={status}>{STATUS_LABELS[status]}</option>))}
              </select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade Benutzer…</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Benutzer für diesen Filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Name</th>
                    <th className={TH_CLASS}>E-Mail</th>
                    <th className={TH_CLASS}>Zugänge</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Portal</th>
                    <th className={TH_CLASS}>Letzter Login</th>
                    <th className={TH_CLASS} />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className={TD_CLASS}>{user.displayName}</td>
                      <td className={TD_CLASS}>{user.email ?? "—"}</td>
                      <td className={TD_CLASS}>{summarizeAccess(user)}</td>
                      <td className={TD_CLASS}>{STATUS_LABELS[user.status ?? "active"]}</td>
                      <td className={TD_CLASS}><Badge variant={portalAccessBadge(user).variant}>{portalAccessBadge(user).label}</Badge></td>
                      <td className={TD_CLASS}>{formatStudioDateOrDash(user.lastLoginAt)}</td>
                      <td className={TD_CLASS}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedUserId(user.id)}>Bearbeiten</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedUser.displayName} bearbeiten</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-user-name">Name</Label>
                <Input id="edit-user-name" type="text" value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-user-email">E-Mail</Label>
                <Input id="edit-user-email" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Zugänge</Label>
                <div className="flex flex-wrap gap-4">
                  {UWE_AREAS.map((area) => (
                    <label key={area} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.access[area]}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            access: { ...current.access, [area]: event.target.checked },
                          }))
                        }
                        className="size-4 rounded border-input"
                      />
                      {UWE_AREA_LABELS[area]}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.isOwner}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, isOwner: event.target.checked }))
                      }
                      className="size-4 rounded border-input"
                    />
                    Owner
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-user-status">Status</Label>
                <select id="edit-user-status" value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as (typeof USER_STATUSES)[number] }))} className={NATIVE_SELECT_CLASS}>
                  {USER_STATUSES.map((status) => (<option key={status} value={status}>{STATUS_LABELS[status]}</option>))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-user-password">Neues Passwort (optional)</Label>
                <Input id="edit-user-password" type="password" value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void saveUser()}>Speichern</Button>
              <Button type="button" variant="secondary" onClick={() => void toggleUserStatus(selectedUser)}>
                {selectedUser.status === "disabled" ? "Reaktivieren" : "Deaktivieren"}
              </Button>
              <Button type="button" variant="destructive" onClick={() => void deleteUser(selectedUser)}>Endgültig löschen</Button>
              <Button type="button" variant="ghost" onClick={() => setSelectedUserId(null)}>Schließen</Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Welt-Zuordnungen</h3>
              {selectedUser.worldMemberships.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Keine Welten zugeordnet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {selectedUser.worldMemberships.map((membership) => (
                    <li key={membership.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <strong>{membership.world.name}</strong>
                      {membership.characterName ? ` (${membership.characterName})` : ""}
                      <Button type="button" variant="ghost" size="sm" onClick={() => void removeMembership(membership.worldId)}>Entfernen</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="membership-world">Welt</Label>
                <select id="membership-world" value={membershipForm.worldId} onChange={(event) => setMembershipForm((current) => ({ ...current, worldId: event.target.value }))} className={NATIVE_SELECT_CLASS}>
                  <option value="">Welt wählen…</option>
                  {worlds.map((world) => (<option key={world.id} value={world.id}>{world.name}</option>))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="membership-character-name">Charaktername</Label>
                <Input id="membership-character-name" type="text" value={membershipForm.characterName} onChange={(event) => setMembershipForm((current) => ({ ...current, characterName: event.target.value }))} />
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={() => void addMembership()} className="self-start">Welt zuordnen</Button>

            <div>
              <h3 className="text-sm font-semibold">Portalzugriff</h3>
              <Button type="button" variant="secondary" disabled={portalAccessLoading} onClick={() => void checkPortalAccess()} className="mt-2">
                {portalAccessLoading ? "Prüfe…" : "Portalzugriff prüfen"}
              </Button>
              {portalAccessError ? <Alert tone="danger" role="alert" className="mt-3">{portalAccessError}</Alert> : null}
              {portalAccess ? (
                <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                  {portalAccess.checks.map((check) => (
                    <li key={`${check.id}-${check.label}`} className="flex items-center gap-2">
                      <Badge variant={check.pass ? "success" : "danger"}>{check.pass ? "OK" : "Fehlt"}</Badge>
                      <span>{check.label}{check.detail ? ` — ${check.detail}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
