import {
  CALENDAR_FEED_TYPE_LABELS,
  createCalendarService,
  prisma,
} from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { createFeedAction, deleteFeedAction, toggleFeedAction } from "../feed-actions";

/**
 * Fremde Kalender — abonnieren, an- und abschalten, entfernen.
 *
 * Bisher ging das nur über die Kalender-API von Studio; wer ausschließlich
 * Family nutzt, kam gar nicht heran. Abos sind schreibgeschützt: was von aussen
 * kommt, wird hier nicht geändert.
 */

export const dynamic = "force-dynamic";

export default async function FamilyCalendarFeedsPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/calendar" title="Fremde Kalender">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const feeds = await createCalendarService(familyPrisma, prisma).listFeeds(true);
  const external = feeds.filter((feed) => feed.type !== "local");

  return (
    <FamilyShell
      active="/calendar"
      title="Fremde Kalender"
      eyebrow="Gemeinsamer Bereich"
      lede="Kalender von Schule, Verein oder Arbeit hier abonnieren. Sie erscheinen im Haushalts-Kalender und im Abo aufs Handy — schreibgeschützt."
    >
      <section className="family-section">
        <h2>Kalender abonnieren</h2>
        <form action={createFeedAction} className="family-form family-card">
          <div className="family-form-row">
            <label>
              Name
              <input name="name" required placeholder="z. B. Schule Lino" />
            </label>
            <label>
              Art
              <select name="type" defaultValue="ical_url">
                <option value="ical_url">iCal-Adresse (ICS)</option>
                <option value="caldav">CalDAV</option>
              </select>
            </label>
            <label>
              Farbe
              <input type="color" name="color" defaultValue="#64748b" />
            </label>
          </div>
          <label>
            iCal-Adresse
            <input name="url" placeholder="https://… .ics" />
          </label>
          <details className="family-edit">
            <summary>CalDAV statt iCal</summary>
            <label>
              CalDAV-Adresse
              <input name="caldavUrl" placeholder="https://…/dav/calendars/…" />
            </label>
            <div className="family-form-row">
              <label>
                Benutzername
                <input name="username" autoComplete="off" />
              </label>
              <label>
                Passwort
                <input name="password" type="password" autoComplete="new-password" />
              </label>
            </div>
          </details>
          <div>
            <button type="submit" className="family-btn family-btn-sm">
              Abonnieren
            </button>
          </div>
        </form>
        <p className="family-muted">
          Das Passwort wird verschlüsselt abgelegt und nie wieder angezeigt. Abgeholt werden die
          Termine von einem Job auf dem Host — hier stehen sie danach zum Nachsehen.
        </p>
      </section>

      <section className="family-section">
        <h2>Abonniert · {external.length}</h2>
        {external.length === 0 ? (
          <p className="family-muted">Noch kein fremder Kalender abonniert.</p>
        ) : (
          <ul className="family-list">
            {external.map((feed) => (
              <li key={feed.id} className="family-row">
                <div className="family-row-head">
                  <strong>{feed.name}</strong>
                  <span className="family-tag">{CALENDAR_FEED_TYPE_LABELS[feed.type]}</span>
                  {feed.enabled ? null : <span className="family-tag family-tag-warn">aus</span>}
                  <span className="family-muted">
                    {feed.lastSyncAt
                      ? `zuletzt ${feed.lastSyncAt.toLocaleString("de-DE")}`
                      : "noch nie synchronisiert"}
                  </span>
                  {feed.syncError ? (
                    <span className="family-tag family-tag-warn">Fehler</span>
                  ) : null}
                  <form action={toggleFeedAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={feed.id} />
                    <label className="family-check">
                      <input
                        type="checkbox"
                        name="enabled"
                        defaultChecked={feed.enabled}
                        // Ohne Client-JS: das Abschicken übernimmt der Knopf daneben.
                      />
                      aktiv
                    </label>
                    <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                      Übernehmen
                    </button>
                  </form>
                  <form action={deleteFeedAction}>
                    <input type="hidden" name="id" value={feed.id} />
                    <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                      Entfernen
                    </button>
                  </form>
                </div>
                {feed.syncError ? <p className="family-muted">{feed.syncError}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </FamilyShell>
  );
}
