import type { PortalCharacterView } from "./character-service";
import type { CharacterSpellView } from "./character-spell-service";

export interface CharacterInventoryItemView {
  name: string;
  quantity: number;
  notes: string;
}

export interface CharacterSheetExportInput {
  character: PortalCharacterView;
  inventoryItems?: CharacterInventoryItemView[];
  worldName?: string;
}

const ABILITY_LABELS: Record<string, string> = {
  strength: "Stärke",
  dexterity: "Geschick",
  constitution: "Konstitution",
  intelligence: "Intelligenz",
  wisdom: "Weisheit",
  charisma: "Charisma",
};

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSpellList(spells: CharacterSpellView[]): string {
  if (spells.length === 0) {
    return "<p class=\"cs-muted\">Keine Zauber eingetragen.</p>";
  }

  const rows = spells
    .map((spell) => {
      const levelLabel = spell.spellLevel === 0 ? "Zaubertrick" : `Grad ${spell.spellLevel}`;
      const prepared = spell.prepared ? " · vorbereitet" : "";
      const source = spell.source === "homebrew" ? " · Homebrew" : "";
      return `<li><strong>${escapeHtml(spell.displayName)}</strong> — ${levelLabel}${prepared}${source}</li>`;
    })
    .join("");

  return `<ul class="cs-spell-list">${rows}</ul>`;
}

function renderInventory(items: CharacterInventoryItemView[]): string {
  if (items.length === 0) {
    return "<p class=\"cs-muted\">Kein Inventar verknüpft.</p>";
  }

  const rows = items
    .map((item) => {
      const qty = item.quantity > 1 ? `${item.quantity}× ` : "";
      const notes = item.notes.trim() ? ` <span class="cs-muted">(${escapeHtml(item.notes)})</span>` : "";
      return `<li>${qty}${escapeHtml(item.name)}${notes}</li>`;
    })
    .join("");

  return `<ul class="cs-inventory-list">${rows}</ul>`;
}

export function buildCharacterSheetPrintStyles(): string {
  return `
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: #111;
      background: #fff;
      font-size: 11pt;
      line-height: 1.35;
    }
    .cs-sheet { max-width: 780px; margin: 0 auto; padding: 1rem; }
    .cs-header { border-bottom: 2px solid #111; margin-bottom: 1rem; padding-bottom: 0.5rem; }
    .cs-header h1 { margin: 0 0 0.25rem; font-size: 1.6rem; }
    .cs-meta { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.5rem 0 0; }
    .cs-meta div { min-width: 6rem; }
    .cs-meta dt { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
    .cs-meta dd { margin: 0; font-weight: 600; font-size: 1.05rem; }
    .cs-section { margin: 1rem 0; break-inside: avoid; }
    .cs-section h2 { font-size: 1rem; margin: 0 0 0.5rem; border-bottom: 1px solid #ccc; padding-bottom: 0.2rem; }
    .cs-abilities { width: 100%; border-collapse: collapse; }
    .cs-abilities th, .cs-abilities td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; text-align: left; }
    .cs-abilities th { background: #f5f5f5; font-size: 0.85rem; }
    .cs-spell-list, .cs-inventory-list { margin: 0; padding-left: 1.2rem; }
    .cs-muted { color: #666; font-size: 0.9rem; }
    .cs-toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .cs-toolbar button, .cs-toolbar a {
      font: inherit;
      padding: 0.35rem 0.75rem;
      border: 1px solid #333;
      background: #fff;
      color: #111;
      text-decoration: none;
      cursor: pointer;
      border-radius: 4px;
    }
    .cs-markdown-export {
      width: 100%;
      min-height: 12rem;
      font-family: ui-monospace, monospace;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }
    @media print {
      .cs-toolbar, .cs-markdown-block { display: none !important; }
      .cs-sheet { padding: 0; max-width: none; }
      a { color: inherit; text-decoration: none; }
    }
  `;
}

export function buildCharacterSheetMarkdown(input: CharacterSheetExportInput): string {
  const { character, inventoryItems = [], worldName } = input;
  const { sheet, spells, spellSlots } = character;
  const lines: string[] = [];

  lines.push(`# ${character.displayName}`);
  if (worldName) {
    lines.push(`Welt: ${worldName}`);
  }
  lines.push("");
  lines.push(`- Stufe: ${sheet.level}`);
  lines.push(`- Übungsbonus: ${formatModifier(sheet.proficiencyBonus)}`);
  lines.push(`- RK: ${sheet.armorClass ?? "—"}`);
  lines.push(`- Initiative: ${formatModifier(sheet.initiative)}`);
  if (sheet.combat.maxHp != null) {
    lines.push(`- TP: ${sheet.combat.currentHp ?? "?"}/${sheet.combat.maxHp}`);
  }
  lines.push("");
  lines.push("## Attribute");
  for (const key of Object.keys(ABILITY_LABELS)) {
    const abilityKey = key as keyof typeof sheet.abilities;
    lines.push(
      `- ${ABILITY_LABELS[key]}: ${sheet.abilities[abilityKey]} (${formatModifier(sheet.modifiers[abilityKey])})`,
    );
  }
  lines.push("");
  lines.push("## Zauberplätze");
  const slotLevels = Object.keys(spellSlots.byLevel).map(Number).sort((a, b) => a - b);
  if (slotLevels.length === 0) {
    lines.push("- Keine");
  } else {
    for (const level of slotLevels) {
      lines.push(`- Grad ${level}: ${spellSlots.byLevel[level]}`);
    }
  }
  lines.push("");
  lines.push("## Zauber");
  if (spells.length === 0) {
    lines.push("- Keine");
  } else {
    for (const spell of spells) {
      const levelLabel = spell.spellLevel === 0 ? "Zaubertrick" : `Grad ${spell.spellLevel}`;
      const prepared = spell.prepared ? ", vorbereitet" : "";
      lines.push(`- ${spell.displayName} (${levelLabel}${prepared})`);
    }
  }
  lines.push("");
  lines.push("## Inventar");
  if (inventoryItems.length === 0) {
    lines.push("- Kein Inventar verknüpft");
  } else {
    for (const item of inventoryItems) {
      const qty = item.quantity > 1 ? `${item.quantity}× ` : "";
      const notes = item.notes.trim() ? ` — ${item.notes}` : "";
      lines.push(`- ${qty}${item.name}${notes}`);
    }
  }
  if (character.notes.trim()) {
    lines.push("");
    lines.push("## Notizen");
    lines.push(character.notes.trim());
  }

  return lines.join("\n");
}

export function buildCharacterSheetPrintHtml(
  input: CharacterSheetExportInput,
  options?: { includeToolbar?: boolean; markdownExport?: boolean; layout?: "full" | "compact" },
): string {
  const { character, inventoryItems = [], worldName } = input;
  const { sheet, spells, spellSlots } = character;
  const includeToolbar = options?.includeToolbar ?? true;
  const markdownExport = options?.markdownExport ?? true;
  const layout = options?.layout ?? "full";
  const compact = layout === "compact";
  const markdown = buildCharacterSheetMarkdown(input);

  const abilityRows = Object.entries(ABILITY_LABELS)
    .map(([key, label]) => {
      const abilityKey = key as keyof typeof sheet.abilities;
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td>${sheet.abilities[abilityKey]}</td>
        <td>${formatModifier(sheet.modifiers[abilityKey])}</td>
      </tr>`;
    })
    .join("");

  const slotLevels = Object.keys(spellSlots.byLevel).map(Number).sort((a, b) => a - b);
  const slotHtml =
    slotLevels.length === 0
      ? "<p class=\"cs-muted\">Keine Zauberplätze.</p>"
      : `<dl class="cs-meta">${slotLevels
          .map(
            (level) =>
              `<div><dt>Grad ${level}</dt><dd>${spellSlots.byLevel[level]}</dd></div>`,
          )
          .join("")}</dl>`;

  const toolbar = includeToolbar
    ? `<div class="cs-toolbar">
        <button type="button" onclick="window.print()">Drucken</button>
        ${markdownExport ? `<button type="button" onclick="document.getElementById('cs-markdown').style.display='block'">Markdown anzeigen</button>` : ""}
      </div>`
    : "";

  const markdownBlock = markdownExport
    ? `<div id="cs-markdown" class="cs-markdown-block" style="display:none">
        <h2>Markdown-Export</h2>
        <textarea class="cs-markdown-export" readonly>${escapeHtml(markdown)}</textarea>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(character.displayName)} — Charakterbogen</title>
  <style>${buildCharacterSheetPrintStyles()}</style>
</head>
<body>
  <div class="cs-sheet">
    ${toolbar}
    <header class="cs-header">
      <h1>${escapeHtml(character.displayName)}</h1>
      ${worldName ? `<p class="cs-muted">${escapeHtml(worldName)}</p>` : ""}
      <dl class="cs-meta">
        <div><dt>Stufe</dt><dd>${sheet.level}</dd></div>
        <div><dt>Übungsbonus</dt><dd>${formatModifier(sheet.proficiencyBonus)}</dd></div>
        <div><dt>RK</dt><dd>${sheet.armorClass ?? "—"}</dd></div>
        <div><dt>Initiative</dt><dd>${formatModifier(sheet.initiative)}</dd></div>
        ${
          sheet.combat.maxHp != null
            ? `<div><dt>TP</dt><dd>${sheet.combat.currentHp ?? "?"} / ${sheet.combat.maxHp}</dd></div>`
            : ""
        }
      </dl>
    </header>

    <section class="cs-section">
      <h2>Attribute</h2>
      <table class="cs-abilities">
        <thead><tr><th>Attribut</th><th>Wert</th><th>Mod</th></tr></thead>
        <tbody>${abilityRows}</tbody>
      </table>
    </section>

    ${
      compact
        ? ""
        : `<section class="cs-section">
      <h2>Zauberplätze</h2>
      ${slotHtml}
    </section>

    <section class="cs-section">
      <h2>Zauber</h2>
      ${renderSpellList(spells)}
    </section>

    <section class="cs-section">
      <h2>Inventar</h2>
      ${renderInventory(inventoryItems)}
    </section>

    ${
      character.notes.trim()
        ? `<section class="cs-section"><h2>Notizen</h2><p>${escapeHtml(character.notes.trim())}</p></section>`
        : ""
    }`
    }

    ${markdownBlock}
  </div>
</body>
</html>`;
}
