import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge, Empty, Fields, RawData, TableWrap, dateTime, flag, list, record, text } from "./ops-view-kit";

/**
 * Secrets — Metadaten der Geheimnisse, nie ein Klartextwert. Ersetzt die
 * Studio-Seite `/admin/secrets` (Abschnitt D).
 */

const SOURCE_LABELS: Record<string, string> = {
  env: ".env",
  db: "Datenbank",
  database: "Datenbank",
  file: "Datei",
};

const STATUS_LABELS: Record<string, string> = {
  set: "gesetzt",
  missing: "fehlt",
  optional: "optional",
  rotate: "Rotation fällig",
};

export function OpsSecretsView({ data }: { data: unknown }) {
  const root = record(data);
  const sections = list(root.sections);
  const warnings = list(root.warnings);
  const rotationDue = list(root.rotationDueSecretIds);

  return (
    <div className="command-center-stack">
      <Card>
        <CardHeader>
          <CardTitle>Verschlüsselung</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              { label: "Gesamtstatus", value: flag(root.ok) },
              { label: "Schlüssel konfiguriert", value: flag(root.encryptionKeyConfigured) },
              { label: "Schlüssel aus", value: text(root.encryptionKeyEnvKey) },
              { label: "Rotation fällig", value: rotationDue.length === 0 ? "keine" : text(rotationDue.length) },
              { label: "Stand", value: dateTime(root.timestamp) },
            ]}
          />
        </CardContent>
      </Card>

      {warnings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Hinweise ({warnings.length})</CardTitle>
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

      {sections.length === 0 ? <Empty>Keine Secrets erfasst.</Empty> : null}

      {sections.map((entry, sectionIndex) => {
        const section = record(entry);
        const items = list(section.items);
        return (
          <Card key={text(section.id, String(sectionIndex))}>
            <CardHeader>
              <CardTitle>{text(section.title)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="connector-muted">{text(section.description, "")}</p>
              {items.length === 0 ? (
                <Empty>Nichts in diesem Bereich.</Empty>
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Secret</th>
                      <th>Quelle</th>
                      <th>Status</th>
                      <th>Hinweis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((itemEntry, itemIndex) => {
                      const item = record(itemEntry);
                      const status = text(item.status, "");
                      return (
                        <tr key={text(item.id, String(itemIndex))}>
                          <td className="connector-table-primary">
                            <strong>{text(item.label)}</strong>
                            <div className="connector-muted">{text(item.description, "")}</div>
                          </td>
                          <td>
                            {SOURCE_LABELS[text(item.source, "")] ?? text(item.source)}
                            {item.envKey ? <div className="connector-muted">{text(item.envKey)}</div> : null}
                          </td>
                          <td>
                            <Badge
                              level={status === "set" ? "ok" : status === "missing" ? "error" : "warning"}
                              label={STATUS_LABELS[status] ?? text(item.status)}
                            />
                          </td>
                          <td className="connector-table-secondary">{text(item.maskedHint, "—")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        );
      })}

      <RawData data={data} />
    </div>
  );
}
