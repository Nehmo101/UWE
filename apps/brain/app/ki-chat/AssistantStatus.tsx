import type { AssistantCapabilityView } from "@uwe/brain-assistant/types";

/**
 * Honest, non-blocking status line: says what works right now and what does
 * not, instead of letting the owner discover it by getting an error mid-chat.
 */
export function AssistantStatus({ capabilities }: { capabilities: AssistantCapabilityView }) {
  if (!capabilities.aiEnabled) {
    return (
      <p className="brain-callout brain-callout-warn" role="note">
        KI ist in den UWE-Einstellungen deaktiviert. Der Chat bleibt bis dahin stumm.
      </p>
    );
  }

  if (!capabilities.localAiReady) {
    return (
      <p className="brain-callout brain-callout-warn" role="note">
        Lokale KI ist offline. Der Brain-Assistent hat bewusst keinen Cloud-Fallback — bitte den
        Command Center bzw. den Maschinenraum starten.
      </p>
    );
  }

  const missing: string[] = [];
  if (!capabilities.visionAvailable) missing.push("Bildanalyse (kein Vision-Modell online)");
  if (!capabilities.sttAvailable) missing.push("lokales Diktat (kein STT-Kommando hinterlegt)");

  return (
    <p className="brain-callout" role="note">
      <span className="brain-tag">Lokal verbunden</span>{" "}
      {missing.length === 0
        ? "Chat, Bildanalyse und Diktat sind verfügbar."
        : `Verfügbar, ohne: ${missing.join(" · ")}.`}
    </p>
  );
}
