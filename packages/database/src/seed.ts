import type { Page, World } from "./types";

export const SEED_WORLDS: World[] = [
  {
    id: "world-terra",
    slug: "terra",
    name: "Terra",
    description: "Die Hauptwelt der Kampagne — Kontinent Valendor und seine Geheimnisse.",
  },
];

export const SEED_PAGES: Page[] = [
  {
    id: "page-arbor",
    worldId: "world-terra",
    title: "Arbor",
    slug: "arbor",
    category: "lore",
    content:
      "Arbor ist eine alte Waldgottheit, die von den Druiden von [[Validori]] verehrt wird. " +
      "Ihr Widersacher ist [[Nepurga]], die sich als [[böse Fee]] in den Wäldern nährt.",
    aliases: ["Waldgöttin"],
    tags: ["religion", "natur"],
    relations: [{ targetPageId: "page-validori", type: "worshipped_in" }],
  },
  {
    id: "page-validori",
    worldId: "world-terra",
    title: "Validori",
    slug: "validori",
    category: "locations",
    content:
      "Validori ist eine Handelsstadt am Rande des Großen Waldes. " +
      "Berühmt für den [[Magister-Turm von Validori]], den Sitz der Magiergilde. " +
      "Die Bewohner verehren [[Arbor]].",
    aliases: ["Stadt Validori"],
    tags: ["stadt", "handel"],
    relations: [
      { targetPageId: "page-arbor", type: "worships" },
      { targetPageId: "page-magister-turm", type: "contains" },
    ],
  },
  {
    id: "page-nepurga",
    worldId: "world-terra",
    title: "Nepurga",
    slug: "nepurga",
    category: "npcs",
    content:
      "Nepurga ist eine mächtige Fee, bekannt als [[Feenkönigin]] und Herrin der Weißen Pocken. " +
      "Sie hasst [[Arbor]] und lauert den Reisenden nach [[Validori]] auf.",
    aliases: ["böse Fee", "Feenkönigin", "Herrin der Weißen Pocken"],
    tags: ["fee", "antagonist"],
    relations: [
      { targetPageId: "page-arbor", type: "enemy_of" },
      { targetPageId: "page-validori", type: "threatens" },
    ],
  },
  {
    id: "page-magister-turm",
    worldId: "world-terra",
    title: "Magister-Turm von Validori",
    slug: "magister-turm-von-validori",
    category: "dungeons",
    content:
      "Der Magister-Turm thront über [[Validori]]. Im Keller lagern uralte Schriften über [[Arbor]]. " +
      "Nur wenige wissen von [[Geheime Verschwörung]] im Turm.",
    aliases: ["Magisterturm"],
    tags: ["dungeon", "magie"],
    relations: [{ targetPageId: "page-validori", type: "located_in" }],
  },
  {
    id: "page-secret-conspiracy",
    worldId: "world-terra",
    title: "Geheime Verschwörung",
    slug: "geheime-verschwoerung",
    category: "lore",
    content:
      "Die Magister verschwören sich gegen [[Nepurga]] und planen einen Angriff aus [[Validori]]. " +
      "Spieler sollen hiervon nichts erfahren.",
    aliases: ["Verschwörung der Magister"],
    tags: ["geheim", "plot"],
    relations: [
      { targetPageId: "page-magister-turm", type: "centered_in" },
      { targetPageId: "page-nepurga", type: "targets" },
    ],
  },
];
