/**
 * Degraded-mode messaging. When no Maschinenraum is online, RTX-dependent
 * features stay visible but show a calm, explicit notice — never a crash or a
 * "system broken" error. This is the expected steady state, not a failure.
 */

import { CONNECTOR_CAPABILITY_LABELS, type ConnectorCapability } from "./capabilities";

export const CONNECTOR_OFFLINE_MESSAGE =
  "Maschinenraum offline. UWE bleibt online, lokale Audio-/KI-Funktionen sind pausiert.";

const CAPABILITY_OFFLINE_MESSAGES: Partial<Record<ConnectorCapability, string>> = {
  audio_local: "Maschinenraum offline — lokale Audioausgabe ist pausiert.",
  spotify_connect: "Maschinenraum offline — Spotify-Ausgabe über den Connector ist pausiert.",
  llm_local: "Maschinenraum offline — lokale KI ist nicht verfügbar.",
  image_generation: "Maschinenraum offline — lokale Bildgenerierung ist pausiert.",
  embedding_local: "Maschinenraum offline — lokale Embeddings sind pausiert.",
  label_printing: "Maschinenraum offline — lokaler Label-Druck ist pausiert.",
};

export function capabilityOfflineMessage(capability: ConnectorCapability): string {
  return (
    CAPABILITY_OFFLINE_MESSAGES[capability] ??
    `Maschinenraum offline — ${CONNECTOR_CAPABILITY_LABELS[capability]} ist pausiert.`
  );
}
