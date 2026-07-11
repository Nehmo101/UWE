import { Card, CardContent, CardHeader, CardTitle, Label } from "@/src/components/ui";
import { PRIVACY_CATEGORY_LABELS } from "./constants";
import type { GatewayDashboard, PrivacyLevel } from "./types";

/** TODO(design-kit): Controlled Select bleibt nativ — direkt an Server-Config gebunden,
    siehe gleiches Muster in AiGatewayRoutingTab.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AiGatewayPrivacyTab({
  data,
  patchConfig,
}: {
  data: GatewayDashboard;
  patchConfig: (body: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy-Regeln</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Legt fest, welche Inhalte an Cloud-Provider gesendet werden dürfen. RTX wird immer bevorzugt.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Hinweis:</strong> Persönliches Life-Brain ist permanent lokal-only und nicht konfigurierbar.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(data.config.privacyRules).map(([category, level]) => {
            const isLocked = category === "personal_brain";
            const label = PRIVACY_CATEGORY_LABELS[category] ?? category;
            const fieldId = `ai-gateway-privacy-${category}`;
            return (
              <div key={category} className="flex flex-col gap-1.5">
                <Label htmlFor={fieldId}>{label}</Label>
                {isLocked ? (
                  <span
                    id={fieldId}
                    aria-disabled="true"
                    className="flex h-9 w-full items-center rounded-[var(--radius)] border border-input bg-transparent px-3 text-sm text-muted-foreground opacity-50"
                  >
                    Nur lokal — nicht änderbar (LOCAL_REQUIRED)
                  </span>
                ) : (
                  <select
                    id={fieldId}
                    className={NATIVE_SELECT_CLASS}
                    value={level}
                    onChange={(e) =>
                      void patchConfig({ privacyRules: { [category]: e.target.value as PrivacyLevel } })
                    }
                  >
                    <option value="CLOUD_ALLOWED">Cloud erlaubt (RTX bevorzugt)</option>
                    <option value="CLOUD_FORBIDDEN">Cloud verboten (lokal erzwungen)</option>
                    <option value="LOCAL_REQUIRED">Nur lokal (streng)</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
