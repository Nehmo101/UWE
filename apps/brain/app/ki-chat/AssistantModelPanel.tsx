import {
  ASSISTANT_CONTEXT_MODES,
  ASSISTANT_CONTEXT_MODE_LABELS,
  type AssistantModelOption,
  type AssistantModelRef,
  type AssistantProfileView,
} from "@uwe/brain-assistant/types";
import {
  formatAssistantModelRef,
  isSameAssistantModel,
} from "@/src/lib/assistant-model-ref";
import { saveAssistantProfileAction } from "../assistant-actions";

/**
 * "KI hinterlegen": pick one of the models the Command Center transferred.
 *
 * The option value carries connector, model and label in one field so a plain
 * `<select>` inside a progressive-enhancement form can express the whole
 * reference. The label is a snapshot — it keeps the UI readable when the
 * connector later goes offline and the model can no longer be resolved.
 */
function optionLabel(model: AssistantModelOption): string {
  const hint = model.bestFor.length > 0 ? ` — ${model.bestFor.join(", ")}` : "";
  return `${model.connectorName}: ${model.label}${hint}`;
}

function ModelSelect({
  name,
  label,
  hint,
  models,
  selected,
}: {
  name: string;
  label: string;
  hint: string;
  models: AssistantModelOption[];
  selected: AssistantModelRef | null;
}) {
  const stillOffered = models.some((model) => isSameAssistantModel(model, selected));
  const selectedValue = selected && stillOffered ? formatAssistantModelRef(selected) : "";

  return (
    <>
      <label>
        {label}
        <select name={name} defaultValue={selectedValue}>
          <option value="">— nicht hinterlegt —</option>
          {models.map((model) => (
            <option key={formatAssistantModelRef(model)} value={formatAssistantModelRef(model)}>
              {optionLabel(model)}
            </option>
          ))}
        </select>
      </label>
      <p className="brain-muted">{hint}</p>
      {selected && !stillOffered && (
        <p className="brain-callout brain-callout-warn" role="note">
          Hinterlegt ist <strong>{selected.label}</strong>, aber kein Connector meldet dieses Modell
          gerade. Die Auswahl bleibt gespeichert — sobald der Command Center wieder online ist,
          funktioniert sie weiter.
        </p>
      )}
    </>
  );
}

export function AssistantModelPanel({
  profile,
  models,
}: {
  profile: AssistantProfileView;
  models: { chat: AssistantModelOption[]; vision: AssistantModelOption[] };
}) {
  const nothingTransferred = models.chat.length === 0 && models.vision.length === 0;

  return (
    <form action={saveAssistantProfileAction} className="brain-form brain-card">
      {nothingTransferred && (
        <p className="brain-muted">
          Gerade meldet kein Connector Modelle. Im Command Center unter „Modelle“ die gewünschten
          Modelle für UWE aktivieren — sie erscheinen dann automatisch hier.
        </p>
      )}

      <ModelSelect
        name="chatModel"
        label="Chat-Modell"
        hint="Beantwortet deine Fragen."
        models={models.chat}
        selected={profile.chat}
      />

      <ModelSelect
        name="visionModel"
        label="Vision-Modell"
        hint="Wertet angehängte Bilder aus — meist ein anderes Modell als das Chat-Modell."
        models={models.vision}
        selected={profile.vision}
      />

      <label>
        Sprachmodell fürs Diktat (optional)
        <input
          name="sttModelName"
          type="text"
          defaultValue={profile.sttModelName ?? ""}
          placeholder="z. B. large-v3-turbo"
        />
      </label>

      <label>
        Standard-Kontext neuer Unterhaltungen
        <select name="defaultContextMode" defaultValue={profile.defaultContextMode}>
          {ASSISTANT_CONTEXT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {ASSISTANT_CONTEXT_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      <label>
        System-Prompt (optional)
        <textarea
          name="systemPrompt"
          rows={3}
          defaultValue={profile.systemPrompt}
          placeholder="Wie die KI antworten soll."
        />
      </label>

      <button className="brain-btn" type="submit">
        KI hinterlegen
      </button>
    </form>
  );
}
