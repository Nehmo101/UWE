import type { CaptureStatus, CaptureType } from "./generated/prisma-brain/client";

export type { CaptureStatus, CaptureType } from "./generated/prisma-brain/client";

export const CAPTURE_TYPE_LABELS: Record<CaptureType, string> = {
  quick_note: "Schnelle Notiz",
  dnd_idea: "DnD-Idee",
  uwe_todo: "UWE-To-do",
  project_idea: "Projektidee",
  hardware: "Hardware/Homelab",
  contract_expense: "Vertrag/Ausgabe",
  art_miniature_terrain: "Kunst/Miniatur/Terrain",
  link: "Link",
  file_image: "Datei/Bild",
  voice_memo: "Sprachmemo",
};

export const QUICK_CAPTURE_TYPE_OPTIONS: Array<{
  id: string;
  label: string;
  captureType: CaptureType;
  captureIntent?: string;
  placeholder: string;
  showUrl: boolean;
  showFile: boolean;
  fileAccept?: string;
}> = [
  {
    id: "quick_note",
    label: "Textnotiz",
    captureType: "quick_note",
    placeholder: "Was möchtest du festhalten?",
    showUrl: false,
    showFile: false,
  },
  {
    id: "link",
    label: "Link",
    captureType: "link",
    placeholder: "Kurze Notiz zum Link (optional)",
    showUrl: true,
    showFile: false,
  },
  {
    id: "file_image",
    label: "Bild/Datei",
    captureType: "file_image",
    placeholder: "Beschreibung des Anhangs (optional)",
    showUrl: false,
    showFile: true,
    fileAccept: "image/*,application/pdf,.txt,.md",
  },
  {
    id: "voice_memo",
    label: "Sprachmemo",
    captureType: "voice_memo",
    placeholder: "Kurze Notiz zum Memo (optional)",
    showUrl: false,
    showFile: true,
    fileAccept: "audio/*,.mp3,.wav,.ogg,.webm,.m4a",
  },
  {
    id: "dnd_idea",
    label: "DnD-Idee",
    captureType: "dnd_idea",
    placeholder: "NPC, Plot, Location, Session-Idee …",
    showUrl: false,
    showFile: false,
  },
  {
    id: "uwe_todo",
    label: "UWE-To-do",
    captureType: "uwe_todo",
    placeholder: "Was soll als Nächstes in UWE passieren?",
    showUrl: false,
    showFile: false,
  },
  {
    id: "hardware",
    label: "Hardware-Problem",
    captureType: "hardware",
    placeholder: "Symptom, Gerät, Fehlermeldung …",
    showUrl: false,
    showFile: false,
  },
  {
    id: "contract_expense",
    label: "Vertrag/Rechnung",
    captureType: "contract_expense",
    placeholder: "Anbieter, Betrag, Fälligkeit …",
    showUrl: true,
    showFile: true,
  },
  {
    id: "art_miniature_terrain",
    label: "Werkstatt/Miniatur/Terrain/3D",
    captureType: "art_miniature_terrain",
    placeholder: "Idee, Material, STL, Referenz …",
    showUrl: true,
    showFile: true,
  },
  {
    id: "life_brain",
    label: "Life-Brain-Fakt",
    captureType: "quick_note",
    captureIntent: "life_brain",
    placeholder: "Wissen, das ins persönliche Brain soll …",
    showUrl: true,
    showFile: false,
  },
];

export const CAPTURE_STATUS_LABELS: Record<CaptureStatus, string> = {
  inbox: "Inbox",
  triaged: "Sortiert",
  linked: "Verknüpft",
  archived: "Archiviert",
};
