import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge, Empty, Fields, Notes, RawData, TableWrap, dateTime, flag, list, record, text } from "./ops-view-kit";

/**
 * Einrichtung — was konfiguriert ist und was noch fehlt, Bereich für Bereich.
 * Der Host liefert die Bereiche bereits als Felder mit Anzeigewert und Quelle
 * (`setup-status`); hier werden sie nur noch dargestellt, nie ein Secret.
 */

const SOURCE_LABELS: Record<string, string> = {
  env: ".env",
  db: "Datenbank",
  database: "Datenbank",
  default: "Vorgabe",
  file: "Datei",
};

export function OpsSetupView({ data }: { data: unknown }) {
  const root = record(data);
  const sections = list(root.sections);

  return (
    <div className="command-center-stack">
      <Card>
        <CardHeader>
          <CardTitle>Überblick</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="connector-inline-card-header">
            <Badge
              level={root.ok === true ? "ok" : "warning"}
              label={root.ok === true ? "Vollständig" : "Offene Punkte"}
            />
            <span className="connector-muted">{sections.length} Bereiche</span>
          </div>
          <Fields
            items={[
              { label: "Bearbeitbar", value: flag(root.canEdit) },
              { label: "Als Owner angemeldet", value: flag(root.isOwner) },
              { label: "Stand", value: dateTime(root.timestamp) },
            ]}
          />
        </CardContent>
      </Card>

      {sections.length === 0 ? <Empty>Keine Bereiche gemeldet.</Empty> : null}

      {sections.map((entry, sectionIndex) => {
        const section = record(entry);
        const settings = list(section.settings);
        const nextSteps = list(section.nextSteps);
        return (
          <Card key={text(section.id, String(sectionIndex))}>
            <CardHeader>
              <CardTitle>{text(section.title)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="connector-inline-card-header">
                <Badge level={section.level} label={text(section.statusLabel, "Status")} />
                <span className="connector-muted">{text(section.message, "")}</span>
              </div>

              {settings.length === 0 ? (
                <Empty>Keine Einstellungen in diesem Bereich.</Empty>
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Einstellung</th>
                      <th>Wert</th>
                      <th>Quelle</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.map((settingEntry, settingIndex) => {
                      const setting = record(settingEntry);
                      const configured = setting.configured === true;
                      return (
                        <tr key={text(setting.id, String(settingIndex))}>
                          <td className="connector-table-primary">{text(setting.label)}</td>
                          <td>{text(setting.displayValue)}</td>
                          <td className="connector-table-secondary">
                            {SOURCE_LABELS[text(setting.source, "")] ?? text(setting.source)}
                            {setting.editable === false ? (
                              <div className="connector-muted">nicht änderbar</div>
                            ) : null}
                          </td>
                          <td>
                            <Badge
                              level={configured ? "ok" : "warning"}
                              label={configured ? "gesetzt" : "offen"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrap>
              )}

              {nextSteps.length > 0 ? (
                <>
                  <p className="connector-muted">Nächste Schritte</p>
                  <Notes items={nextSteps} />
                </>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <RawData data={data} />
    </div>
  );
}
