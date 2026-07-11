import { SECURITY_ROLE_LABELS } from "@uwe/auth";
import type { Dispatch, SetStateAction } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from "@/src/components/ui";
import { GRANT_PERMISSIONS } from "./constants";
import type { AdminUserOption, GatewayDashboard } from "./types";

/** TODO(design-kit): natives Select bleibt — direkt an lokalen State (grantForm) gebunden,
    siehe gleiches Muster in AiGatewayRoutingTab.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <Card>
      <CardHeader>
        <CardTitle>User-Freigaben</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gateway-grant-user">Benutzer</Label>
            <select
              id="ai-gateway-grant-user"
              className={NATIVE_SELECT_CLASS}
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
          </div>
          {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={grantForm.cloudFallbackAllowed}
              onChange={(e) =>
                setGrantForm((g) => ({ ...g, cloudFallbackAllowed: e.target.checked }))
              }
              className="h-4 w-4 rounded border-input"
            />
            Cloud-Fallback für diesen User erlauben
          </label>
        </div>
        <fieldset className="flex flex-col gap-2 rounded-[var(--radius)] border border-border p-4">
          <legend className="px-1 text-sm font-medium text-foreground">Features</legend>
          {GRANT_PERMISSIONS.map((perm) => (
            <label key={perm} className="flex items-center gap-2 text-sm">
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
                className="h-4 w-4 rounded border-input"
              />
              {perm}
            </label>
          ))}
        </fieldset>
        <Button type="button" onClick={() => void saveGrant()} className="self-start">
          Freigabe speichern
        </Button>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {data.userGrants.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2">
              {g.displayName} — {g.permissions.join(", ")}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void deleteGrant(g.userId)}
              >
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
