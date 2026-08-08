#!/usr/bin/env python3
"""Build a complete source-entity inventory from extracted Kanka PDF texts."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

EXTRACT = Path(r"C:\git\uwe\tmp\character-creator-source-extract")
OUT = Path(r"C:\git\uwe\data\character-creator-progress\source-entities.json")
OUT_MD = Path(r"C:\git\uwe\data\character-creator-progress\source-inventory.md")

BACKGROUND_ORDER = [
    "Acolyte",
    "Artisan",
    "Charlatan",
    "Criminal",
    "Entertainer",
    "Farmer",
    "Guard",
    "Guide",
    "Hermit",
    "Merchant",
    "Noble",
    "Sage",
    "Sailor",
    "Scribe",
    "Soldier",
    "Wayfarer",
]

ORIGIN_FEATS = [
    "Alert",
    "Crafter",
    "Fighting Initiate",
    "Healer",
    "Lucky",
    "Magic Initiate",
    "Musician",
    "Savage Attacker",
    "Skilled",
    "Tavern Brawler",
    "Tough",
]

SPECIES_CANDIDATES = [
    "Aasimar",
    "Dragonborn",
    "Dwarf",
    "Elf",
    "Gnome",
    "Goliath",
    "Halfling",
    "Human",
    "Orc",
    "Tiefling",
    "Goblin",
    "Hobgoblin",
    "Bugbear",
    "Kobold",
    "Kenku",
    "Tabaxi",
    "Firbolg",
    "Yuan-ti",
    "Triton",
    "Githyanki",
    "Githzerai",
    "Hadozee",
    "Harengon",
    "Owlin",
    "Plasmoid",
    "Thri-kreen",
    "Autognome",
    "Lizardfolk",
    "Minotaur",
    "Centaur",
    "Satyr",
    "Fairy",
    "Changeling",
    "Shadar-kai",
    "Eladrin",
    "Sea Elf",
    "Wood Elf",
    "High Elf",
    "Drow",
    "Duergar",
    "Deep Gnome",
    "Forest Gnome",
    "Rock Gnome",
    "Lightfoot Halfling",
    "Stout Halfling",
]


def split_sections(text: str) -> list[tuple[str, str]]:
    """Split on Kanka-style section markers (Title)."""
    parts = re.split(r"[􏔘]\s*", text)
    sections: list[tuple[str, str]] = []
    for part in parts:
        lines = [ln.strip() for ln in part.splitlines() if ln.strip()]
        if not lines:
            continue
        title = re.sub(r"\s+", " ", lines[0])[:120]
        body = "\n".join(lines[1:])
        sections.append((title, body))
    return sections


def find_named(text: str, names: list[str]) -> list[dict]:
    found = []
    for name in names:
        # Prefer section-like occurrence (name on its own line)
        pattern = rf"(?m)^\s*{re.escape(name)}\s*$"
        m = re.search(pattern, text)
        status = "section" if m else ("mention" if re.search(rf"\b{re.escape(name)}\b", text, re.I) else None)
        if status:
            found.append(
                {
                    "nameEn": name,
                    "occurrence": status,
                    "outcome": "discovered",
                    "licenseNote": "Source is Tegora Kanka export; rewrite for UWE/Terra; non-SRD mechanics are owner-supplied notes",
                }
            )
    return found


def extract_subclasses(text: str, class_name: str) -> list[dict]:
    """Heuristic subclass titles: Title Case lines after 'Subclass' markers or known patterns."""
    hits: list[str] = []
    # Lines that look like subclass headers commonly used in these exports
    for m in re.finditer(
        rf"(?im)^\s*((?:Path of|College of|Domain|Circle of|Oath of|Patron|Origin|Tradition|School of|Warrior|Hunter|Way of|Archetype)[^\n]{{0,60}})\s*$",
        text,
    ):
        hits.append(re.sub(r"\s+", " ", m.group(1)).strip())
    # Also "X Artificer" style
    for m in re.finditer(rf"(?im)^\s*([A-Z][A-Za-z' \-]{{2,40}})\s+{re.escape(class_name)}\s*$", text):
        hits.append(re.sub(r"\s+", " ", m.group(0)).strip())

    uniq: list[str] = []
    seen: set[str] = set()
    for h in hits:
        k = h.lower()
        if k in seen or len(h) < 5:
            continue
        seen.add(k)
        uniq.append(h)
    return [
        {
            "nameEn": h,
            "parentClass": class_name,
            "outcome": "discovered",
        }
        for h in uniq[:40]
    ]


def main() -> None:
    files = {
        "backgrounds": EXTRACT / "Background__Background - Notizen.pdf.txt",
        "feats": EXTRACT / "Feats__Feats - Notizen.pdf.txt",
        "species1": EXTRACT / "Spezies__Spezien 1.pdf.txt",
        "species2": EXTRACT / "Spezies__Spezies 2.pdf.txt",
    }
    class_files = sorted(EXTRACT.glob("Klassen__*.txt"))

    bg_text = files["backgrounds"].read_text(encoding="utf-8", errors="replace")
    feat_text = files["feats"].read_text(encoding="utf-8", errors="replace")
    species_text = (
        files["species1"].read_text(encoding="utf-8", errors="replace")
        + "\n"
        + files["species2"].read_text(encoding="utf-8", errors="replace")
    )

    backgrounds = find_named(bg_text, BACKGROUND_ORDER)
    # Feats: Origin list + scan for General/Fighting Style/Epic Boon section titles
    feats = find_named(feat_text, ORIGIN_FEATS)
    feat_sections = split_sections(feat_text)
    for title, _body in feat_sections:
        if any(
            k in title.lower()
            for k in ("feat", "boon", "fighting", "origin", "general")
        ):
            continue
        # short titles that look like feat names
        if 3 <= len(title) <= 40 and title[0].isupper() and "Kanka" not in title:
            if not any(f["nameEn"].lower() == title.lower() for f in feats):
                if re.match(r"^[A-Za-z][A-Za-z' \-]+$", title):
                    feats.append(
                        {
                            "nameEn": title,
                            "occurrence": "section",
                            "outcome": "discovered",
                            "licenseNote": "Owner-supplied Tegora notes",
                        }
                    )

    species = find_named(species_text, SPECIES_CANDIDATES)

    classes = []
    for cf in class_files:
        name = cf.stem.replace("Klassen__", "").replace(" - Notizen.pdf", "")
        text = cf.read_text(encoding="utf-8", errors="replace")
        classes.append(
            {
                "nameEn": name,
                "sourceFile": cf.name,
                "chars": len(text),
                "outcome": "discovered",
                "subclasses": extract_subclasses(text, name),
                "tegoraRefs": len(re.findall(r"tegora", text, re.I)),
                "eberronRefs": len(re.findall(r"eberron", text, re.I)),
            }
        )

    links = [
        {"url": u, "type": "linked-dependency", "outcome": "discovered"}
        for u in [
            "http://dnd2024.wikidot.com/magic-item:all",
            "http://dnd2024.wikidot.com/equipment:armor",
            "http://dnd2024.wikidot.com/equipment:weapon",
            "http://dnd2024.wikidot.com/equipment:adventuring-gear",
            "http://dnd2024.wikidot.com/equipment:mounts-and-vehicles",
            "http://dnd2024.wikidot.com/equipment:poison",
            "http://dnd2024.wikidot.com/spell:all",
        ]
    ]

    inventory = {
        "schemaVersion": 1,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sourceKind": "Kanka HTML-export PDFs from app.kanka.io/w/tegora",
        "summary": {
            "classFiles": len(classes),
            "backgroundsDiscovered": len(backgrounds),
            "featsDiscovered": len(feats),
            "speciesDiscovered": len(species),
            "linkedSources": len(links),
            "subclassHints": sum(len(c["subclasses"]) for c in classes),
        },
        "classes": classes,
        "backgrounds": backgrounds,
        "feats": feats,
        "species": species,
        "links": links,
        "existingUweSrd": {
            "species": 9,
            "classes": 12,
            "backgrounds": 4,
            "feats": 19,
            "note": "Artificer and Bloodhunter are NEW vs current UWE catalog; 12 backgrounds exist in source vs 4 SRD",
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# Character Creator — Source Inventory",
        "",
        f"Stand: {inventory['generatedAt']}",
        "",
        f"Quelle: {inventory['sourceKind']}",
        "",
        "## Summary",
        "",
        f"- Klassen-PDFs: {inventory['summary']['classFiles']}",
        f"- Hintergründe: {inventory['summary']['backgroundsDiscovered']}",
        f"- Talente (Heuristik): {inventory['summary']['featsDiscovered']}",
        f"- Spezies-Treffer: {inventory['summary']['speciesDiscovered']}",
        f"- Unterklassen-Hinweise: {inventory['summary']['subclassHints']}",
        f"- Linked sources: {inventory['summary']['linkedSources']}",
        "",
        "## Klassen",
        "",
    ]
    for c in classes:
        lines.append(
            f"- **{c['nameEn']}** — subclasses~{len(c['subclasses'])}, "
            f"Tegora refs={c['tegoraRefs']}, Eberron refs={c['eberronRefs']}"
        )
    lines += ["", "## Hintergründe", ""]
    for b in backgrounds:
        lines.append(f"- {b['nameEn']} ({b['occurrence']})")
    lines += ["", "## Spezies-Treffer", ""]
    for s in species:
        lines.append(f"- {s['nameEn']} ({s['occurrence']})")
    lines += ["", "## Linked dependencies", ""]
    for link in links:
        lines.append(f"- {link['url']}")
    lines += [
        "",
        "## Outcome tracking",
        "",
        "Jeder Eintrag in `source-entities.json` erhält später eines von:",
        "imported | merged | replaced-by-uwe | excluded | blocked.",
        "",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(inventory["summary"], indent=2))


if __name__ == "__main__":
    main()
