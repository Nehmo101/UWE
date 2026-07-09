import { PRIVACY_CATEGORY_LABELS } from "./constants";
import type { GatewayDashboard, PrivacyLevel } from "./types";

export function AiGatewayPrivacyTab({
  data,
  patchConfig,
}: {
  data: GatewayDashboard;
  patchConfig: (body: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h3>Privacy-Regeln</h3>
      <p className="uwe-muted">
        Legt fest, welche Inhalte an Cloud-Provider gesendet werden dürfen. RTX wird immer bevorzugt.
      </p>
      <p className="uwe-muted">
        <strong>Hinweis:</strong> Persönliches Life-Brain ist permanent lokal-only und nicht konfigurierbar.
      </p>
      {Object.entries(data.config.privacyRules).map(([category, level]) => {
        const isLocked = category === "personal_brain";
        const label = PRIVACY_CATEGORY_LABELS[category] ?? category;
        return (
          <label key={category} className="uwe-field">
            {label}
            {isLocked ? (
              <span className="uwe-input uwe-input--disabled" aria-disabled="true">
                Nur lokal — nicht änderbar (LOCAL_REQUIRED)
              </span>
            ) : (
              <select
                className="uwe-input"
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
          </label>
        );
      })}
    </section>
  );
}
