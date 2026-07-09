import type { UserActiveSessionView } from "@uwe/database/account-session";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatIp(ipAddress: string | null): string {
  if (!ipAddress?.trim()) {
    return "Unbekannt";
  }
  return ipAddress;
}

interface PortalActiveSessionsListProps {
  sessions: UserActiveSessionView[];
}

export function PortalActiveSessionsList({ sessions }: PortalActiveSessionsListProps) {
  if (sessions.length === 0) {
    return (
      <p className="auth-muted" style={{ marginTop: "1rem" }}>
        Keine weiteren aktiven Sitzungen.
      </p>
    );
  }

  return (
    <ul className="auth-page-list portal-active-sessions-list">
      {sessions.map((session) => (
        <li key={session.id}>
          <div className="portal-active-session-row">
            <div>
              <strong>
                {session.isCurrent ? "Diese Sitzung" : "Aktive Sitzung"}
                {session.isCurrent ? (
                  <span className="auth-page-list-badges">
                    <span className="uwe-badge portal-new-badge">Aktuell</span>
                  </span>
                ) : null}
              </strong>
              <span className="auth-muted">
                IP {formatIp(session.ipAddress)} · zuletzt aktiv{" "}
                {DATE_FORMAT.format(session.lastActiveAt)} · angemeldet seit{" "}
                {DATE_FORMAT.format(session.createdAt)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
