import { ResponsiveTable } from "@uwe/shared-ui";
import { Card, CardContent, CardHeader, CardTitle, Input } from "@/src/components/ui";
import { FEATURE_MODEL_KEYS, FEATURE_MODEL_LABELS } from "./constants";
import type { GatewayDashboard } from "./types";


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
        {/*
          Die Zeilen tragen Bedienelemente, keine reinen Werte. Auf dem Telefon
          werden daraus Karten: Feld unter Beschriftung statt drei Spalten, die
          sich ein Select und ein Eingabefeld teilen müssen.
        */}
        <ResponsiveTable
          caption="Modell pro Feature"
          rowKey={(featureKey) => featureKey}
          rows={[...FEATURE_MODEL_KEYS]}
          columns={[
            {
              key: "feature",
              label: "Feature",
              primary: true,
              render: (featureKey) => FEATURE_MODEL_LABELS[featureKey] ?? featureKey,
            },
            {
              key: "provider",
              label: "Provider",
              render: (featureKey) => {
                const override = data.config.featureModels?.[featureKey] ?? {};
                if (featureKey === "personal_brain") {
                  return <span className="text-muted-foreground">Maschinenraum (fest)</span>;
                }
                return (
                  <select
                    aria-label={`Provider für ${FEATURE_MODEL_LABELS[featureKey] ?? featureKey}`}
                    className={NATIVE_SELECT_CLASS}
                    value={override.providerId ?? ""}
                    onChange={(e) =>
                      void patchFeatureModel(featureKey, { providerId: e.target.value || null })
                    }
                  >
                    <option value="">— Standard —</option>
                    <option value="local_engine">Maschinenraum (lokal)</option>
                  </select>
                );
              },
            },
            {
              key: "model",
              label: "Modell",
              render: (featureKey) => {
                const override = data.config.featureModels?.[featureKey] ?? {};
                return (
                  <Input
                    aria-label={`Modell für ${FEATURE_MODEL_LABELS[featureKey] ?? featureKey}`}
                    defaultValue={override.model ?? ""}
                    disabled={featureKey === "personal_brain"}
                    onBlur={(e) => {
                      const model = e.target.value.trim() || null;
                      if (model !== (override.model ?? null)) {
                        void patchFeatureModel(featureKey, { model });
                      }
                    }}
                  />
                );
              },
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
