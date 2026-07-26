/**
 * Connector capabilities — what a worker (RTX Host Connector) is able to do
 * locally. Reported by the connector on every heartbeat; the host uses them to
 * decide which queued jobs a connector may claim.
 */

export const CONNECTOR_CAPABILITIES = [
  "audio_local",
  "spotify_connect",
  "llm_local",
  "image_generation",
  "embedding_local",
  "vision_local",
  "stt_local",
  "file_cache",
  "label_printing",
  "system_info",
] as const;

export type ConnectorCapability = (typeof CONNECTOR_CAPABILITIES)[number];

export const CONNECTOR_CAPABILITY_LABELS: Record<ConnectorCapability, string> = {
  audio_local: "Lokale Audioausgabe",
  spotify_connect: "Spotify Connect",
  llm_local: "Lokale LLMs",
  image_generation: "Bildgenerierung",
  embedding_local: "Lokale Embeddings",
  vision_local: "Lokale Vision/OCR",
  stt_local: "Lokale Spracherkennung",
  file_cache: "Datei-Cache",
  label_printing: "Label-Druck",
  system_info: "Systeminfo",
};

const CAPABILITY_SET = new Set<string>(CONNECTOR_CAPABILITIES);

export function isConnectorCapability(value: unknown): value is ConnectorCapability {
  return typeof value === "string" && CAPABILITY_SET.has(value);
}

/** Filter an arbitrary list down to known capabilities (deduplicated, ordered). */
export function normalizeCapabilities(values: readonly unknown[]): ConnectorCapability[] {
  const seen = new Set<ConnectorCapability>();
  for (const value of values) {
    if (isConnectorCapability(value)) {
      seen.add(value);
    }
  }
  return CONNECTOR_CAPABILITIES.filter((capability) => seen.has(capability));
}
