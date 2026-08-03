import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Empty, Fields, RawData, TableWrap, dateTime, list, record, text } from "./ops-view-kit";

/**
 * Audit-Log — die letzten sicherheitsrelevanten Ereignisse als Tabelle.
 * Ersetzt die Studio-Seite `/admin/audit-log` (Abschnitt D).
 *
 * `details` ist je Aktion anders geformt (IDs, Zähler, Feldnamen) und bleibt
 * deshalb eingeklappt beim Eintrag stehen, statt in Spalten gepresst zu werden.
 */

/** Aktionsnamen des Hosts sind snake_case-Schlüssel — hier lesbar gemacht. */
function actionLabel(value: unknown): string {
  const raw = text(value, "");
  if (!raw) return "—";
  return raw.replace(/_/g, " ");
}

export function OpsAuditLogView({ data }: { data: unknown }) {
  const root = record(data);
  const entries = list(root.entries);

  return (
    <div className="command-center-stack">
      <Card>
        <CardHeader>
          <CardTitle>Umfang</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              { label: "Angezeigte Einträge", value: text(root.count ?? entries.length) },
              { label: "Abgefragtes Limit", value: text(root.limit) },
              { label: "Jüngstes Ereignis", value: dateTime(record(entries[0]).createdAt) },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ereignisse</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <Empty>Keine Ereignisse im Zeitraum.</Empty>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Aktion</th>
                  <th>Ziel</th>
                  <th>Zusammenfassung</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const event = record(entry);
                  const details = record(event.details);
                  const undo = record(event.undo);
                  return (
                    <tr key={text(event.id, String(index))}>
                      <td className="connector-table-secondary">{dateTime(event.createdAt)}</td>
                      <td className="connector-table-primary">
                        {actionLabel(event.action)}
                        {undo.entryId ? (
                          <div className="connector-muted">
                            {undo.undoneAt ? `rückgängig ${dateTime(undo.undoneAt)}` : "rückgängig möglich"}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {text(event.targetLabel, text(event.targetType))}
                        {event.worldSlug ? <div className="connector-muted">Welt: {text(event.worldSlug)}</div> : null}
                      </td>
                      <td>
                        {text(event.summary)}
                        {Object.keys(details).length > 0 ? (
                          <details>
                            <summary className="connector-muted">Details</summary>
                            <pre className="connector-pre">{JSON.stringify(details, null, 2)}</pre>
                          </details>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <RawData data={data} />
    </div>
  );
}
