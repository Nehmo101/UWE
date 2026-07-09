import { SECURITY_ROLE_LABELS } from "@uwe/auth";
import type { Dispatch, SetStateAction } from "react";
import { GRANT_PERMISSIONS } from "./constants";
import type { AdminUserOption, GatewayDashboard } from "./types";

export function AiGatewayGrantsTab({
  data,
  adminUsers,
  grantForm,
  setGrantForm,
  saveGrant,
  deleteGrant,
}: {
  data: GatewayDashboard;
  adminUsers: AdminUserOption[];
  grantForm: { userId: string; permissions: string[]; cloudFallbackAllowed: boolean };
  setGrantForm: Dispatch<
    SetStateAction<{ userId: string; permissions: string[]; cloudFallbackAllowed: boolean }>
  >;
  saveGrant: () => Promise<void>;
  deleteGrant: (userId: string) => Promise<void>;
}) {
  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h3>User-Freigaben</h3>
      <div className="uwe-form-grid">
        <label className="uwe-field">
          Benutzer
          <select
            className="uwe-input"
            value={grantForm.userId}
            onChange={(e) => setGrantForm((g) => ({ ...g, userId: e.target.value }))}
          >
            <option value="">— Benutzer wählen —</option>
            {adminUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
                {user.email ? ` (${user.email})` : ""} —{" "}
                {SECURITY_ROLE_LABELS[user.role as keyof typeof SECURITY_ROLE_LABELS] ?? user.role}
              </option>
            ))}
          </select>
        </label>
        <label className="uwe-checkbox-row">
          <input
            type="checkbox"
            checked={grantForm.cloudFallbackAllowed}
            onChange={(e) =>
              setGrantForm((g) => ({ ...g, cloudFallbackAllowed: e.target.checked }))
            }
          />
          Cloud-Fallback für diesen User erlauben
        </label>
      </div>
      <fieldset>
        <legend>Features</legend>
        {GRANT_PERMISSIONS.map((perm) => (
          <label key={perm} className="uwe-checkbox-row">
            <input
              type="checkbox"
              checked={grantForm.permissions.includes(perm)}
              onChange={(e) => {
                setGrantForm((g) => ({
                  ...g,
                  permissions: e.target.checked
                    ? [...g.permissions, perm]
                    : g.permissions.filter((p) => p !== perm),
                }));
              }}
            />
            {perm}
          </label>
        ))}
      </fieldset>
      <button type="button" className="uwe-button-primary" onClick={() => void saveGrant()}>
        Freigabe speichern
      </button>
      <ul>
        {data.userGrants.map((g) => (
          <li key={g.id}>
            {g.displayName} — {g.permissions.join(", ")}
            <button
              type="button"
              className="uwe-button-secondary"
              onClick={() => void deleteGrant(g.userId)}
            >
              Entfernen
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
