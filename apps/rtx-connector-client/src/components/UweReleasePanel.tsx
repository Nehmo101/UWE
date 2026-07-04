import { useEffect, useMemo, useState } from "react";

import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";
import type { ConnectorModelProfileStore } from "@uwe/connector-model-profile";

type Props = {
  loaded: boolean;
  store: ConnectorModelProfileStore;
  onLoadStore: () => Promise<ConnectorModelProfileStore>;
  onSaveStore: (store: ConnectorModelProfileStore) => Promise<ConnectorModelProfileStore>;
};

function toMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unbekannter Fehler";
  }
  if (error instanceof Error) {
    return error.message.trim() || "Unbekannter Fehler";
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return "Unbekannter Fehler";
}

export function UweReleasePanel({ loaded, store, onLoadStore, onSaveStore }: Props) {
  const [draft, setDraft] = useState(store);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(store);
  }, [store]);

  useEffect(() => {
    if (!loaded) {
      void onLoadStore().catch(() => undefined);
    }
  }, [loaded, onLoadStore]);

  const enabledCount = useMemo(
    () => draft.profiles.filter((profile) => profile.enabledForUwe).length,
    [draft.profiles],
  );

  function applyProfileField(
    profiles: ConnectorModelProfileStore["profiles"],
    profileId: string,
    field: "displayName" | "description" | "bestFor" | "enabledForUwe",
    value: boolean | string,
  ): ConnectorModelProfileStore["profiles"] {
    return profiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }

      if (field === "bestFor" && typeof value === "string") {
        return {
          ...profile,
          bestFor: value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        };
      }

      return { ...profile, [field]: value };
    });
  }

  function updateProfile(
    profileId: string,
    field: "displayName" | "description" | "bestFor" | "enabledForUwe",
    value: boolean | string,
  ) {
    setDraft((current) => ({
      ...current,
      profiles: applyProfileField(current.profiles, profileId, field, value),
    }));
  }

  async function persistDraft(nextDraft: ConnectorModelProfileStore) {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await onSaveStore(nextDraft);
      setDraft(saved);
      setNotice(
        `${saved.profiles.filter((profile) => profile.enabledForUwe).length} Modelle für UWE freigegeben.`,
      );
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  // The freigeben-toggle is the one control users expect to take effect at once,
  // so persist it immediately instead of waiting for the separate save button —
  // and surface any save failure right away instead of silently losing the flag.
  function toggleEnabledForUwe(profileId: string, checked: boolean) {
    const nextDraft: ConnectorModelProfileStore = {
      ...draft,
      profiles: applyProfileField(draft.profiles, profileId, "enabledForUwe", checked),
    };
    setDraft(nextDraft);
    void persistDraft(nextDraft);
  }

  async function saveReleaseConfig() {
    await persistDraft(draft);
  }

  const sortedProfiles = [...draft.profiles].sort((left, right) =>
    (left.displayName || left.name).localeCompare(right.displayName || right.name, "de"),
  );

  return (
    <CardV2
      title="UWE-Freigaben"
      footer={
        <div className="connector-actions">
          <ButtonV2 variant="primary" onClick={saveReleaseConfig} disabled={busy}>
            Freigaben speichern
          </ButtonV2>
        </div>
      }
    >
      <div className="connector-stack">
        <div className="connector-stats-row">
          <div className="connector-stat-pill">Profile: {draft.profiles.length}</div>
          <div className="connector-stat-pill">Aktiviert: {enabledCount}</div>
        </div>

        <p className="connector-muted">
          Nur Modelle mit „Für UWE freigeben“ werden per Heartbeat an den Host gemeldet. Der
          Schalter speichert sofort; „Freigaben speichern“ sichert zusätzlich Änderungen an
          Anzeigename, Best for und Beschreibung.
        </p>

        {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
        {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

        {sortedProfiles.length === 0 ? (
          <div className="connector-empty-state">
            Noch keine Profile vorhanden. Scanne zuerst lokale Provider oder Ollama-Modelle.
          </div>
        ) : (
          <div className="connector-profile-list">
            {sortedProfiles.map((profile) => (
              <div key={profile.id} className="connector-inline-card">
                <div className="connector-inline-card-header">
                  <div>
                    <p className="connector-lead">{profile.name}</p>
                    <p className="connector-muted">
                      {profile.provider} · {profile.modelType}
                    </p>
                  </div>
                  <HealthBadge
                    status={profile.enabledForUwe ? "ok" : "degraded"}
                    label={profile.enabledForUwe ? "Freigegeben" : "Nicht freigegeben"}
                  />
                </div>

                <div className="connector-form-grid">
                  <label className="connector-field">
                    <span>Anzeigename</span>
                    <input
                      className="connector-input"
                      value={profile.displayName}
                      onChange={(event) =>
                        updateProfile(profile.id, "displayName", event.target.value)
                      }
                      placeholder={profile.name}
                    />
                  </label>

                  <label className="connector-field">
                    <span>Best for</span>
                    <input
                      className="connector-input"
                      value={profile.bestFor.join(", ")}
                      onChange={(event) => updateProfile(profile.id, "bestFor", event.target.value)}
                      placeholder="DnD generator, Summaries"
                    />
                  </label>

                  <label className="connector-field connector-field-full">
                    <span>Beschreibung</span>
                    <textarea
                      className="connector-textarea"
                      rows={3}
                      value={profile.description}
                      onChange={(event) =>
                        updateProfile(profile.id, "description", event.target.value)
                      }
                      placeholder="Kurzer Hinweis für die Host-Auswahl."
                    />
                  </label>
                </div>

                <label className="connector-checkbox">
                  <input
                    type="checkbox"
                    checked={profile.enabledForUwe}
                    disabled={busy}
                    onChange={(event) =>
                      toggleEnabledForUwe(profile.id, event.target.checked)
                    }
                  />
                  <span>Für UWE freigeben</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </CardV2>
  );
}
