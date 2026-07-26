import {
  ASSISTANT_CONTEXT_MODES,
  ASSISTANT_CONTEXT_MODE_LABELS,
  type AssistantConversationView,
  type AssistantModelOption,
} from "@uwe/brain-assistant/types";
import { formatAssistantModelRef } from "@/src/lib/assistant-model-ref";
import {
  renameConversationAction,
  setConversationContextModeAction,
  setConversationModelAction,
} from "../../assistant-actions";

/** Per-conversation overrides — title, assigned model, knowledge context. */
export function ConversationSettings({
  conversation,
  models,
}: {
  conversation: AssistantConversationView;
  models: AssistantModelOption[];
}) {
  const currentValue =
    conversation.connectorId && conversation.modelId
      ? formatAssistantModelRef({
          connectorId: conversation.connectorId,
          modelId: conversation.modelId,
          label: conversation.modelLabel ?? conversation.modelId,
        })
      : "";

  return (
    <section className="brain-section">
      <h2>Einstellungen dieser Unterhaltung</h2>

      <form action={renameConversationAction} className="brain-form brain-form-inline">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <label>
          Titel
          <input name="title" type="text" defaultValue={conversation.title} />
        </label>
        <button className="brain-btn-ghost brain-btn-sm" type="submit">
          Umbenennen
        </button>
      </form>

      <form action={setConversationContextModeAction} className="brain-form brain-form-inline">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <label>
          Wissen
          <select name="contextMode" defaultValue={conversation.contextMode}>
            {ASSISTANT_CONTEXT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {ASSISTANT_CONTEXT_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <button className="brain-btn-ghost brain-btn-sm" type="submit">
          Übernehmen
        </button>
      </form>

      <form action={setConversationModelAction} className="brain-form brain-form-inline">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <label>
          Modell nur hier
          <select name="chatModel" defaultValue={currentValue}>
            <option value="">— hinterlegte KI verwenden —</option>
            {models.map((model) => (
              <option
                key={`${model.connectorId}::${model.modelId}`}
                value={formatAssistantModelRef(model)}
              >
                {model.connectorName}: {model.label}
              </option>
            ))}
          </select>
        </label>
        <button className="brain-btn-ghost brain-btn-sm" type="submit">
          Übernehmen
        </button>
      </form>
    </section>
  );
}
