import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge, Empty, Fields, Pills, RawData, TableWrap, dateTime, list, record, text } from "./ops-view-kit";

/**
 * API-Tokens — Metadaten der Tokens des Owners. Der Klartext eines Tokens
 * erscheint genau einmal bei der Erstellung und steht hier nie; sichtbar sind
 * Name, Präfix, Scopes und Nutzung (`api-tokens-list`).
 */

export function OpsTokensView({ data }: { data: unknown }) {
  const root = record(data);
  const tokens = list(root.tokens);
  const scopes = list(root.availableScopes);
  const active = tokens.filter((entry) => record(entry).isActive === true).length;

  return (
    <div className="command-center-stack">
      <Card>
        <CardHeader>
          <CardTitle>Überblick</CardTitle>
        </CardHeader>
        <CardContent>
          <Fields
            items={[
              { label: "Tokens gesamt", value: text(tokens.length) },
              { label: "Davon aktiv", value: text(active) },
              { label: "Konto", value: text(root.userId), hint: "Owner" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <Empty>Kein API-Token vergeben.</Empty>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Präfix</th>
                  <th>Scopes</th>
                  <th>Zuletzt benutzt</th>
                  <th>Läuft ab</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((entry, index) => {
                  const token = record(entry);
                  const isActive = token.isActive === true;
                  return (
                    <tr key={text(token.id, String(index))}>
                      <td className="connector-table-primary">{text(token.name)}</td>
                      <td>
                        <code className="connector-code">{text(token.tokenPrefix)}…</code>
                      </td>
                      <td className="connector-table-secondary">
                        {list(token.scopes).length === 0
                          ? "—"
                          : list(token.scopes).map((scope) => text(scope)).join(", ")}
                      </td>
                      <td className="connector-table-secondary">{dateTime(token.lastUsedAt)}</td>
                      <td className="connector-table-secondary">{dateTime(token.expiresAt)}</td>
                      <td>
                        <Badge level={isActive ? "ok" : "warning"} label={isActive ? "aktiv" : "gesperrt"} />
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
          <CardTitle>Verfügbare Scopes ({scopes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Pills items={scopes.map((scope) => ({ label: text(scope) }))} />
        </CardContent>
      </Card>

      <RawData data={data} />
    </div>
  );
}
