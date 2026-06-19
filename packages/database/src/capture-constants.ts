import type { CaptureType } from "./generated/prisma/client";

export const QUICK_CAPTURE_TYPE_OPTIONS: Array<{
  id: string;
  label: string;
  captureType: CaptureType;
  captureIntent?: string;
  placeholder: string;
  showUrl: boolean;
  showFile: boolean;
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
