import Link from "next/link";
import {
  ASSISTANT_CONTEXT_MODE_LABELS,
  type AssistantConversationSummary,
} from "@uwe/brain-assistant/types";
import { createConversationAction, deleteConversationAction } from "../assistant-actions";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConversationList({
  conversations,
  activeId,
}: {
  conversations: AssistantConversationSummary[];
  activeId?: string;
}) {
  return (
    <>
      <form action={createConversationAction} className="brain-form-inline">
        <button className="brain-btn" type="submit">
          Neue Unterhaltung
        </button>
      </form>

      {conversations.length === 0 ? (
        <p className="brain-muted">Noch keine Unterhaltung. Leg oben eine neue an.</p>
      ) : (
        <ul className="brain-list">
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              className="brain-row"
              aria-current={conversation.id === activeId ? "true" : undefined}
            >
              <div className="brain-row-head">
                <strong>
                  <Link href={`/ki-chat/${conversation.id}`}>{conversation.title}</Link>
                </strong>
                <span className="brain-tag">
                  {ASSISTANT_CONTEXT_MODE_LABELS[conversation.contextMode]}
                </span>
                <span className="brain-muted">
                  {conversation.messageCount} Nachrichten · {formatDate(conversation.updatedAt)}
                  {conversation.modelLabel ? ` · ${conversation.modelLabel}` : ""}
                </span>
              </div>
              <form action={deleteConversationAction}>
                <input type="hidden" name="conversationId" value={conversation.id} />
                <button className="brain-btn-ghost brain-btn-sm" type="submit">
                  Löschen
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
