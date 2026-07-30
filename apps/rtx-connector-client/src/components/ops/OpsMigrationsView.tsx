import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge, Empty, Fields, Notes, RawData, list, record, text } from "./ops-view-kit";

/**
 * Migrationen — was angewendet ist, was aussteht, was fehlgeschlagen ist.
 * Ersetzt die Studio-Seite `/admin/migrations` (Abschnitt D).
 *
 * Die angewendeten Migrationen sind über hundert Einträge: sie stehen
 * eingeklappt, damit Ausstehendes und Fehlgeschlagenes — das, weswegen man
 * hier hinschaut — nicht darin untergeht.
 */

export function OpsMigrationsView({ data }: { data: unknown }) {
  const root = record(data);
  const applied = list(root.appliedMigrations);
  const pending = list(root.pendingMigrations);
  const failed = list(root.failedMigrations);
  const failedDetails = list(root.failedDetails);
  const ok = root.ok === true;

  return (
    <div className="command-center-stack">
      <Card>
        <CardHeader>
          <CardTitle>Stand der Datenbank</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="connector-inline-card-header">
            <Badge level={ok ? "ok" : "error"} label={ok ? "Aktuell" : "Handlungsbedarf"} />
            <span className="connector-muted">{text(root.message, "")}</span>
          </div>
          <Fields
            items={[
              { label: "Angewendet", value: text(root.appliedCount ?? applied.length) },
              { label: "Ausstehend", value: text(pending.length) },
              { label: "Fehlgeschlagen", value: text(failed.length) },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ausstehend</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? <Empty>Nichts ausstehend.</Empty> : <Notes items={pending} />}
        </CardContent>
      </Card>

      {failed.length > 0 || failedDetails.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Fehlgeschlagen</CardTitle>
          </CardHeader>
          <CardContent>
            <Notes items={failed} />
            {failedDetails.map((entry, index) => {
              const detail = record(entry);
              return (
                <div key={text(detail.name, String(index))} className="connector-inline-card">
                  <strong>{text(detail.name, `Eintrag ${index + 1}`)}</strong>
                  <p className="connector-muted">{text(detail.message ?? detail.error, "")}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Angewendet ({applied.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {applied.length === 0 ? (
            <Empty>Keine Migration angewendet.</Empty>
          ) : (
            <>
              <Fields
                items={[
                  { label: "Erste", value: text(applied[0]) },
                  { label: "Letzte", value: text(applied[applied.length - 1]) },
                ]}
              />
              <details className="connector-inline-card">
                <summary className="connector-muted">Alle {applied.length} anzeigen</summary>
                <Notes items={applied} />
              </details>
            </>
          )}
        </CardContent>
      </Card>

      <RawData data={data} />
    </div>
  );
}
