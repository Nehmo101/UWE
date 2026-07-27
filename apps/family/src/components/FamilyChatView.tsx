import type { FamilyChatScope } from "@uwe/database/family-service";
import {
  appendMessageAction,
  createConversationAction,
  createFactAction,
  deleteConversationAction,
  deleteFactAction,
} from "@/app/family-actions";

/**
 * Die gemeinsame Fläche für beide Chats — der Unterschied ist genau ein Wert:
 * `scope`. „shared" schreibt ins Family-Brain und ist für alle sichtbar,
 * „private" gehört der angemeldeten Person allein (G12 / G19).
 *
 * Zwei Seiten, eine Komponente: sonst driften die beiden Chats auseinander,
 * und genau das war der Fehler, den Abschnitt H aufräumt.
 */

interface ConversationView {
  id: string;
  title: string;
  updatedAt: Date;
}

interface MessageView {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  errorMessage: string | null;
}

interface FactView {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
}

const DATE_TIME = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

export function FamilyChatView({
  scope,
  conversations,
  activeConversation,
  messages,
  facts,
}: {
  scope: FamilyChatScope;
  conversations: ConversationView[];
  activeConversation: ConversationView | null;
  messages: MessageView[];
  facts: FactView[];
}) {
  const shared = scope === "shared";

  return (
    <>
      <div className={shared ? "family-callout" : "family-callout family-callout-warn"}>
        {shared
          ? "Gemeinsam: alles hier sehen alle mit dem Häkchen Family."
          : "Privat: nur du siehst das hier. Der Owner schreibt sein privates Wissen weiterhin ins Owner-Brain."}
      </div>

      <section className="family-section">
        <h2>Neue Unterhaltung</h2>
        <form action={createConversationAction} className="family-form-row">
          <input type="hidden" name="scope" value={scope} />
          <input name="title" required placeholder="Worum geht's?" />
          <button type="submit" className="family-btn family-btn-sm">
            Anlegen
          </button>
        </form>
      </section>

      <section className="family-section">
        <h2>Unterhaltungen · {conversations.length}</h2>
        {conversations.length === 0 ? (
          <p className="family-muted">Noch keine.</p>
        ) : (
          <ul className="family-list">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="family-row">
                <div className="family-row-head">
                  <strong>{conversation.title}</strong>
                  <span className="family-muted">{DATE_TIME.format(conversation.updatedAt)}</span>
                  {activeConversation?.id === conversation.id ? (
                    <span className="family-tag">offen</span>
                  ) : null}
                  <form action={deleteConversationAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={conversation.id} />
                    <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeConversation ? (
        <section className="family-section">
          <h2>{activeConversation.title}</h2>
          {messages.length === 0 ? (
            <p className="family-muted">Noch nichts gesagt.</p>
          ) : (
            <ul className="family-list">
              {messages.map((message) => (
                <li key={message.id} className="family-row">
                  <div className="family-row-head">
                    <span className="family-tag">{message.role}</span>
                    <span className="family-muted">{DATE_TIME.format(message.createdAt)}</span>
                  </div>
                  <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>
                  {message.errorMessage ? (
                    <p className="family-callout family-callout-warn">{message.errorMessage}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <form action={appendMessageAction} className="family-form">
            <input type="hidden" name="conversationId" value={activeConversation.id} />
            <label>
              Nachricht
              <textarea name="content" rows={3} required />
            </label>
            <div>
              <button type="submit" className="family-btn family-btn-sm">
                Senden
              </button>
            </div>
          </form>
          <p className="family-muted">
            Die Antwort der KI kommt vom RTX-Host. Solange der Runner nicht angebunden ist, bleibt
            der Verlauf ein reines Notizbuch — geschrieben wird trotzdem alles.
          </p>
        </section>
      ) : null}

      <section className="family-section">
        <h2>{shared ? "Family-Wissen" : "Dein privates Wissen"} · {facts.length}</h2>
        <form action={createFactAction} className="family-form family-card">
          <input type="hidden" name="scope" value={scope} />
          <div className="family-form-row">
            <label>
              Titel
              <input name="title" required placeholder="z. B. WLAN-Passwort Gäste" />
            </label>
            <label>
              Tags (kommagetrennt)
              <input name="tags" placeholder="zuhause, technik" />
            </label>
          </div>
          <label>
            Inhalt
            <textarea name="content" rows={3} />
          </label>
          <div>
            <button type="submit" className="family-btn family-btn-sm">
              Merken
            </button>
          </div>
        </form>

        {facts.length === 0 ? (
          <p className="family-muted">Noch nichts gemerkt.</p>
        ) : (
          <ul className="family-list">
            {facts.map((fact) => (
              <li key={fact.id} className="family-row">
                <div className="family-row-head">
                  <strong>{fact.title}</strong>
                  <span className="family-muted">{DATE_TIME.format(fact.updatedAt)}</span>
                  <form action={deleteFactAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={fact.id} />
                    <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                {fact.content ? <p>{fact.content}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
