import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Badge,
  Empty,
  Fields,
  Notes,
  Pills,
  RawData,
  dateTime,
  flag,
  list,
  record,
  text,
} from "./ops-view-kit";

/**
 * Security — die Sicherheitsübersicht des Hosts als Felder statt als JSON.
 * Ersetzt die Studio-Seite `/admin/security` (Abschnitt D).
 */

const ACCESS_LABELS: Record<string, string> = {
  owner: "Owner",
  portal: "Portal",
  studio: "Studio",
  brain: "Brain",
  family: "Family",
};

const CHECK_LABELS: Record<string, string> = {
  studioApiTokenConfigured: "STUDIO_API_TOKEN gesetzt",
  authSecretConfigured: "AUTH_SECRET gesetzt",
  authSecretLooksWeak: "AUTH_SECRET wirkt schwach",
  runDbSeedDisabled: "DB-Seed abgeschaltet",
  sessionCookieSecure: "Session-Cookie „secure“",
  portalAuthRequired: "Portal-Login erforderlich",
  trustProxy: "TRUST_PROXY",
  cloudflareTunnel: "CLOUDFLARE_TUNNEL",
  networkProtectionLikely: "Netzwerk-Schutz wahrscheinlich",
};

function checkFields(source: unknown) {
  return Object.entries(record(source)).map(([key, value]) => ({
    label: CHECK_LABELS[key] ?? key,
    value: flag(value),
  }));
}

export function OpsSecurityView({ data }: { data: unknown }) {
  const root = record(data);
  const auth = record(root.auth);
  const env = record(root.env);
  const sessionSecret = record(env.sessionSecret);
  const setupToken = record(env.setupToken);
  const rtxToken = record(env.rtxServiceToken);
  const publicRoutes = record(root.publicRoutes);
  const backup = record(root.backup);
  const upload = record(root.uploadPolicy);
  const ai = record(root.aiPolicy);
  const network = record(root.networkProtection);
  const studio = record(root.studioSecurity);
  const warnings = list(root.warnings);

  return (
    <div className="command-center-stack">
      <Card>
        <CardHeader>
          <CardTitle>Anmeldung</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              { label: "Login aktiv", value: flag(auth.active) },
              { label: "Portal verlangt Anmeldung", value: flag(auth.portalAuthRequired) },
              { label: "Bewertung", value: text(auth.message) },
              { label: "Stand", value: dateTime(root.timestamp) },
            ]}
          />
          <Pills
            items={Object.entries(record(root.accessCounts)).map(([key, value]) => ({
              label: ACCESS_LABELS[key] ?? key,
              value: text(value),
            }))}
          />
        </CardContent>
      </Card>

      {warnings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Warnungen ({warnings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="command-center-stack">
              {warnings.map((entry, index) => {
                const warning = record(entry);
                return (
                  <div key={text(warning.id, String(index))} className="connector-inline-card">
                    <div className="connector-inline-card-header">
                      <strong>{text(warning.title)}</strong>
                      <Badge level={warning.severity} label={text(warning.severity, "Hinweis")} />
                    </div>
                    <p className="connector-muted">{text(warning.description)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Schlüssel und Tokens (.env)</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              {
                label: text(sessionSecret.envKey, "SESSION_SECRET"),
                value: text(sessionSecret.message),
                hint: `gesetzt: ${flag(sessionSecret.configured)} · stark: ${flag(sessionSecret.strong)}`,
              },
              {
                label: "Setup-Token",
                value: text(setupToken.message),
                hint: `aktiv: ${flag(setupToken.active)} · sicher: ${flag(setupToken.secure)}`,
              },
              {
                label: text(rtxToken.envKey, "RTX_SERVICE_TOKEN"),
                value: text(rtxToken.message),
                hint: `erforderlich: ${flag(rtxToken.required)} · gesetzt: ${flag(rtxToken.configured)}`,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Öffentliche Erreichbarkeit</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              { label: "Player-Routen öffentlich", value: flag(publicRoutes.playerRoutesPublic) },
              { label: "Studio-Admin geschützt", value: flag(publicRoutes.studioAdminProtected) },
              { label: "Öffentlich konfiguriert", value: flag(studio.publicExposureConfigured) },
              ...checkFields(studio.proxyIndicators),
              ...checkFields(studio.checks),
            ]}
          />
          <Notes items={list(publicRoutes.details)} />
          {list(studio.misconfigurations).length > 0 ? (
            <>
              <p className="connector-muted">Konfigurationsprobleme</p>
              <Notes items={list(studio.misconfigurations)} />
            </>
          ) : null}
          {list(studio.nextSteps).length > 0 ? (
            <>
              <p className="connector-muted">Nächste Schritte</p>
              <Notes items={list(studio.nextSteps)} />
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Netzwerk-Schutz</CardTitle>
        </CardHeader>
        <CardContent>
          <Notes items={list(network.checklist)} />
          <p className="connector-muted">{text(network.note)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              { label: "Letztes Backup", value: dateTime(backup.lastBackupAt) },
              { label: "Datei", value: text(backup.lastBackupFilename) },
              { label: "Vorhandene Backups", value: text(backup.backupCount) },
              { label: "Wiederherstellung möglich", value: flag(backup.restoreAvailable) },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploads und KI</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              { label: "Maximale Dateigröße", value: text(upload.maxSizeLabel) },
              { label: "KI aktiv", value: flag(ai.enabled) },
              { label: "Nur lokale Modelle", value: flag(ai.localOnly) },
              { label: "Bewertung", value: text(ai.message) },
            ]}
          />
          <Pills items={list(upload.allowedTypes).map((type) => ({ label: text(type) }))} />
          <p className="connector-muted">{text(upload.note)}</p>
          <Pills items={list(ai.allowedModels).map((model) => ({ label: text(model) }))} />
          <Notes items={list(ai.rateLimits)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Letzte sicherheitsrelevante Ereignisse</CardTitle>
        </CardHeader>
        <CardContent>
          {list(root.auditLog).length === 0 ? (
            <Empty>Keine Ereignisse aufgezeichnet.</Empty>
          ) : (
            <Fields
              items={list(root.auditLog).map((entry, index) => {
                const event = record(entry);
                return {
                  label: text(event.action, `Ereignis ${index + 1}`),
                  value: text(event.summary),
                  hint: dateTime(event.createdAt),
                };
              })}
            />
          )}
        </CardContent>
      </Card>

      <RawData data={data} />
    </div>
  );
}
