/**
 * Degraded-mode messaging. When no RTX Host Connector is online, RTX-dependent
 * features stay visible but show a calm, explicit notice — never a crash or a
 * "system broken" error. This is the expected steady state, not a failure.
 */

import { CONNECTOR_CAPABILITY_LABELS, type ConnectorCapability } from "./capabilities";

export const CONNECTOR_OFFLINE_MESSAGE =
  "RTX Connector offline. UWE bleibt online, lokale Audio-/KI-Funktionen sind pausiert.";

const CAPABILITY_OFFLINE_MESSAGES: Partial<Record<ConnectorCapability, string>> = {
  audio_local: "RTX Connector offline — lokale Audioausgabe ist pausiert.",
  spotify_connect: "RTX Connector offline — Spotify-Ausgabe über den Connector ist pausiert.",
  llm_local: "RTX Connector offline — lokale KI ist nicht verfügbar.",
  image_generation: "RTX Connector offline — lokale Bildgenerierung ist pausiert.",
  embedding_local: "RTX Connector offline — lokale Embeddings sind pausiert.",
  label_printing: "RTX Connector offline — lokaler Label-Druck ist pausiert.",
};

export function capabilityOfflineMessage(capability: ConnectorCapability): string {
  return (
    CAPABILITY_OFFLINE_MESSAGES[capability] ??
    `RTX Connector offline — ${CONNECTOR_CAPABILITY_LABELS[capability]} ist pausiert.`
  );
}
