import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge, Empty, Fields, RawData, TableWrap, dateTime, list, record, text } from "./ops-view-kit";

/**
 * Webhooks — Endpunkte und die letzten Zustellungen (`webhooks-list`).
 * Ersetzt die Studio-Seite `/admin/webhooks` (Abschnitt D). Das Signier-Secret
 * gibt es nur einmal bei der Erstellung; hier steht nur sein Präfix.
 */

export function OpsWebhooksView({ data }: { data: unknown }) {
  const root = record(data);
  const endpoints = list(root.endpoints);
  const deliveryData = record(root.deliveries);
  const deliveries = list(deliveryData.deliveries);
  const failed = deliveries.filter((entry) => record(entry).success !== true).length;

  return (
    <div className="command-center-stack">
      <Card>
        <CardHeader>
          <CardTitle>Überblick</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              { label: "Endpunkte", value: text(endpoints.length) },
              { label: "Zustellungen gesamt", value: text(deliveryData.total ?? deliveries.length) },
              { label: "Angezeigt", value: text(deliveries.length) },
              { label: "Davon fehlgeschlagen", value: text(failed) },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpunkte</CardTitle>
        </CardHeader>
        <CardContent>
          {endpoints.length === 0 ? (
            <Empty>Kein Endpunkt eingerichtet.</Empty>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Ziel</th>
                  <th>Events</th>
                  <th>Zuletzt ausgelöst</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((entry, index) => {
                  const endpoint = record(entry);
                  const isActive = endpoint.isActive === true;
                  return (
                    <tr key={text(endpoint.id, String(index))}>
                      <td className="connector-table-primary">
                        {text(endpoint.name)}
                        <div className="connector-muted">
                          Secret <code className="connector-code">{text(endpoint.secretPrefix)}…</code>
                        </div>
                      </td>
                      <td className="connector-table-secondary">{text(endpoint.url)}</td>
                      <td className="connector-table-secondary">
                        {list(endpoint.events).length === 0
                          ? "—"
                          : list(endpoint.events).map((event) => text(event)).join(", ")}
                      </td>
                      <td className="connector-table-secondary">{dateTime(endpoint.lastTriggeredAt)}</td>
                      <td>
                        <Badge level={isActive ? "ok" : "warning"} label={isActive ? "aktiv" : "inaktiv"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Zustellungen</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <Empty>Noch nichts zugestellt.</Empty>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Endpunkt</th>
                  <th>Event</th>
                  <th>Antwort</th>
                  <th>Versuche</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((entry, index) => {
                  const delivery = record(entry);
                  const success = delivery.success === true;
                  return (
                    <tr key={text(delivery.id, String(index))}>
                      <td className="connector-table-secondary">{dateTime(delivery.createdAt)}</td>
                      <td className="connector-table-primary">{text(delivery.endpointName)}</td>
                      <td>{text(delivery.event)}</td>
                      <td className="connector-table-secondary">
                        {text(delivery.statusCode)}
                        {delivery.errorMessage ? (
                          <div className="connector-muted">{text(delivery.errorMessage)}</div>
                        ) : null}
                      </td>
                      <td>{text(delivery.attemptCount)}</td>
                      <td>
                        <Badge
                          level={success ? "ok" : "error"}
                          label={success ? "zugestellt" : "fehlgeschlagen"}
                        />
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
