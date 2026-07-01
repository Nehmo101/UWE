// UWE — Beispiel-Weltdaten für den Nachbarschafts-Graphen.
// Kampagne "Die Aschelande". Struktur spiegelt das echte GraphNode/GraphEdge-Modell
// (packages/database/graph-types.ts): id, title, category, visibility, slug + Kanten mit Relations-Label.

// Kategorie-Metadaten. Farben sind erdig/gedämpft, damit sie auf Pergament (#f1e8d4)
// ruhig und unterscheidbar lesen — keine grellen Default-Flow-Farben mehr.
export const CATEGORIES = {
  npc:      { label: "NPC",      color: "#c76b52", glyph: "◆" },
  location: { label: "Ort",      color: "#2f7d6e", glyph: "▲" },
  faction:  { label: "Fraktion", color: "#b08322", glyph: "❖" },
  session:  { label: "Session",  color: "#4f6d94", glyph: "●" },
  dungeon:  { label: "Dungeon",  color: "#7a5480", glyph: "✦" },
  item:     { label: "Item",     color: "#c78a3e", glyph: "◈" },
  lore:     { label: "Lore",     color: "#6f7d5c", glyph: "❦" },
  quest:    { label: "Quest",    color: "#b8462c", glyph: "✸" },
  handout:  { label: "Handout",  color: "#4d8a9e", glyph: "▮" },
};

export const CATEGORY_ORDER = [
  "session", "npc", "location", "faction", "quest", "dungeon", "item", "lore", "handout",
];

// Sichtbarkeit — UWE Player-Safety-Vokabular.
export const VISIBILITY_LABELS = {
  private: "Privat",
  dm_only: "Nur GM",
  player_visible: "Portal sichtbar",
  public: "Share-Link",
};

export const NODES = [
  // NPCs
  { id: "n_alderad", title: "Alderad Weißhand", category: "npc", visibility: "player_visible", meta: "Ordenspriester" },
  { id: "n_mira",    title: "Mira von Talstein", category: "npc", visibility: "player_visible", meta: "Bürgermeisterin" },
  { id: "n_pilger",  title: "Der Graue Pilger", category: "npc", visibility: "dm_only", meta: "Wandernder Seher" },
  { id: "n_kessa",   title: "Kessa Rabenzahn", category: "npc", visibility: "player_visible", meta: "Schmugglerin" },
  { id: "n_ysolde",  title: "Hochmagier Ysolde", category: "npc", visibility: "dm_only", meta: "Zirkel-Meisterin" },
  { id: "n_borin",   title: "Borin Erzfaust", category: "npc", visibility: "player_visible", meta: "Waffenschmied" },
  { id: "n_veil",    title: "Die Verhüllte", category: "npc", visibility: "private", meta: "?" },

  // Orte
  { id: "o_talstein",   title: "Talstein", category: "location", visibility: "player_visible", meta: "Stadt" },
  { id: "o_aschenwald", title: "Der Aschenwald", category: "location", visibility: "player_visible", meta: "Wildnis" },
  { id: "o_morrigane",  title: "Hafen von Morrigane", category: "location", visibility: "player_visible", meta: "Hafenstadt" },
  { id: "o_duned",      title: "Feste Duned", category: "location", visibility: "player_visible", meta: "Ruinenfeste" },
  { id: "o_markt",      title: "Marktplatz Talstein", category: "location", visibility: "player_visible", meta: "Bezirk" },

  // Fraktionen
  { id: "f_zirkel",   title: "Zirkel der Asche", category: "faction", visibility: "dm_only", meta: "Geheimbund" },
  { id: "f_gilde",    title: "Handelsgilde Morrigane", category: "faction", visibility: "player_visible", meta: "Gilde" },
  { id: "f_waechter", title: "Wächter von Duned", category: "faction", visibility: "player_visible", meta: "Orden" },

  // Quests
  { id: "q_siegel",   title: "Das Siegel von Duned", category: "quest", visibility: "player_visible", meta: "Hauptquest" },
  { id: "q_karawane", title: "Die verschwundene Karawane", category: "quest", visibility: "player_visible", meta: "Nebenquest" },
  { id: "q_asche",    title: "Ursprung der Asche", category: "quest", visibility: "dm_only", meta: "GM-Faden" },

  // Sessions
  { id: "s_ftkj",    title: "2025-01-14 · Session FTKJ", category: "session", visibility: "player_visible", meta: "Letzte Session" },
  { id: "s_auftakt", title: "2024-12-20 · Auftakt", category: "session", visibility: "player_visible", meta: "Session 1" },

  // Dungeons
  { id: "d_krypta",     title: "Versunkene Krypta", category: "dungeon", visibility: "player_visible", meta: "Dungeon" },
  { id: "d_katakomben", title: "Aschenkatakomben", category: "dungeon", visibility: "dm_only", meta: "Dungeon" },

  // Items
  { id: "i_stab",   title: "Der Aschestab", category: "item", visibility: "dm_only", meta: "Artefakt" },
  { id: "i_siegel", title: "Siegel des Zirkels", category: "item", visibility: "player_visible", meta: "Schlüsselobjekt" },

  // Lore
  { id: "l_krieg",   title: "Der Aschekrieg", category: "lore", visibility: "player_visible", meta: "Ereignis" },
  { id: "l_ordnung", title: "Die Alte Ordnung", category: "lore", visibility: "public", meta: "Epoche" },

  // Handouts
  { id: "h_brief", title: "Brief an Ysolde", category: "handout", visibility: "player_visible", meta: "Dokument" },
  { id: "h_karte", title: "Karte der Aschelande", category: "handout", visibility: "public", meta: "Karte" },
];

export const EDGES = [
  ["s_ftkj", "o_talstein", "spielt in"],
  ["s_ftkj", "n_mira", "trifft"],
  ["s_ftkj", "q_siegel", "verfolgt"],
  ["s_ftkj", "n_kessa", "trifft"],
  ["s_auftakt", "o_talstein", "spielt in"],
  ["s_auftakt", "n_alderad", "trifft"],
  ["o_talstein", "o_markt", "enthält"],
  ["o_talstein", "n_mira", "regiert von"],
  ["o_talstein", "n_borin", "Bewohner"],
  ["o_talstein", "o_aschenwald", "grenzt an"],
  ["o_aschenwald", "n_pilger", "Heimat von"],
  ["o_aschenwald", "d_krypta", "enthält"],
  ["o_morrigane", "f_gilde", "Sitz"],
  ["o_morrigane", "n_kessa", "operiert in"],
  ["o_duned", "f_waechter", "bewacht von"],
  ["o_duned", "q_siegel", "Schauplatz"],
  ["o_duned", "d_katakomben", "unter"],
  ["f_zirkel", "n_ysolde", "geführt von"],
  ["f_zirkel", "i_stab", "sucht"],
  ["f_zirkel", "l_krieg", "entstand im"],
  ["f_zirkel", "n_veil", "verbündet?"],
  ["q_siegel", "i_siegel", "Ziel"],
  ["q_siegel", "f_waechter", "Auftraggeber"],
  ["q_karawane", "f_gilde", "Auftraggeber"],
  ["q_karawane", "o_aschenwald", "Schauplatz"],
  ["q_asche", "l_krieg", "Hintergrund"],
  ["q_asche", "n_veil", "Drahtzieher"],
  ["d_krypta", "i_siegel", "Fundort"],
  ["d_katakomben", "i_stab", "birgt"],
  ["d_katakomben", "l_ordnung", "Grabkammer"],
  ["n_ysolde", "n_alderad", "Rivale"],
  ["n_ysolde", "h_brief", "Empfänger"],
  ["n_mira", "n_borin", "beauftragt"],
  ["n_kessa", "f_gilde", "Mitglied"],
  ["n_pilger", "l_ordnung", "kennt"],
  ["n_pilger", "n_veil", "?"],
  ["l_krieg", "l_ordnung", "beendete"],
  ["h_karte", "o_talstein", "zeigt"],
  ["h_karte", "o_aschenwald", "zeigt"],
  ["i_siegel", "f_zirkel", "Symbol"],
].map((e, i) => ({ id: "e" + i, sourceId: e[0], targetId: e[1], label: e[2] }));

export const FOCUS_ID = "s_ftkj";
