import { FEATURE_MODEL_KEYS, FEATURE_MODEL_LABELS } from "./constants";
import type { GatewayDashboard } from "./types";

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
    <section className="uwe-v2-card uwe-v2-section">
      <h3>Modell pro Feature</h3>
      <table className="uwe-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Provider</th>
            <th>Modell</th>
          </tr>
        </thead>
        <tbody>
          {FEATURE_MODEL_KEYS.map((featureKey) => {
            const override = data.config.featureModels?.[featureKey] ?? {};
            const isLocalOnly = featureKey === "personal_brain";
            return (
              <tr key={featureKey}>
                <td>{FEATURE_MODEL_LABELS[featureKey] ?? featureKey}</td>
                <td>
                  {isLocalOnly ? (
                    <span className="uwe-muted">RTX (fest)</span>
                  ) : (
                    <select
                      className="uwe-input"
                      value={override.providerId ?? ""}
                      onChange={(e) =>
                        void patchFeatureModel(featureKey, { providerId: e.target.value || null })
                      }
                    >
                      <option value="">— Standard —</option>
                      <option value="local_rtx">RTX (lokal)</option>
                      {data.providers
                        .filter((p) => p.isEnabled)
                        .map((p) => (
                          <option key={p.providerId} value={p.providerId}>
                            {p.label}
                          </option>
                        ))}
                    </select>
                  )}
                </td>
                <td>
                  <input
                    className="uwe-input"
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
    </section>
  );
}
