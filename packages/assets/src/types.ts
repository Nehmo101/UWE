/** Supported asset categories in UWE. */
export type AssetType =
  | "image"
  | "map"
  | "handout"
  | "document"
  | "audio"
  | "video"
  | "other";

export interface AssetRecord {
  id: string;
  worldId: string;
  campaignId: string | null;
  title: string;
  description: string | null;
  type: AssetType;
  storageKey: string;
  mimeType: string | null;
  size: number;
  tags: string[];
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssetInput {
  worldId: string;
  campaignId?: string | null;
  title: string;
  description?: string | null;
  type: AssetType;
  storageKey: string;
  mimeType?: string | null;
  size?: number;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
}

export interface UpdateAssetInput {
  title?: string;
  description?: string | null;
  type?: AssetType;
  campaignId?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  image: "Bild",
  map: "Karte",
  handout: "Handout",
  document: "Dokument",
  audio: "Audio",
  video: "Video",
  other: "Sonstiges",
};

export const ASSET_TYPES: AssetType[] = [
  "image",
  "map",
  "handout",
  "document",
  "audio",
  "video",
  "other",
];
