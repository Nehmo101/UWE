import { Card, CardContent, CardHeader, CardTitle, Input } from "@/src/components/ui";
import { FEATURE_MODEL_KEYS, FEATURE_MODEL_LABELS } from "./constants";
import type { GatewayDashboard } from "./types";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

/** TODO(design-kit): Controlled Select bleibt nativ — direkt an Server-Config gebunden,
    siehe gleiches Muster in AiGatewayRoutingTab.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AiGatewayModelsTab({
  data,
  patchFeatureModel,
}: {
  data: GatewayDashboard;
  patchFeatureModel: (
    featureKey: string,
    patch: { providerId?: string | null; model?: string | null },
  ) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modell pro Feature</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH_CLASS}>Feature</th>
                <th className={TH_CLASS}>Provider</th>
                <th className={TH_CLASS}>Modell</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_MODEL_KEYS.map((featureKey) => {
                const override = data.config.featureModels?.[featureKey] ?? {};
                const isLocalOnly = featureKey === "personal_brain";
                return (
                  <tr key={featureKey}>
                    <td className={TD_CLASS}>{FEATURE_MODEL_LABELS[featureKey] ?? featureKey}</td>
                    <td className={TD_CLASS}>
                      {isLocalOnly ? (
                        <span className="text-muted-foreground">RTX (fest)</span>
                      ) : (
                        <select
                          className={NATIVE_SELECT_CLASS}
                          value={override.providerId ?? ""}
                          onChange={(e) =>
                            void patchFeatureModel(featureKey, { providerId: e.target.value || null })
                          }
                        >
                          <option value="">— Standard —</option>
                          <option value="local_rtx">RTX (lokal)</option>
                        </select>
                      )}
                    </td>
                    <td className={TD_CLASS}>
                      <Input
                        defaultValue={override.model ?? ""}
                        disabled={isLocalOnly}
                        onBlur={(e) => {
                          const model = e.target.value.trim() || null;
                          if (model !== (override.model ?? null)) {
                            void patchFeatureModel(featureKey, { model });
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
