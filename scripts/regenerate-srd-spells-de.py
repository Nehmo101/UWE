#!/usr/bin/env python3
"""Regenerate L2–9 spells with clean German structural summaries."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"C:\git\uwe")
SRC = ROOT / "tmp" / "srd-spells-by-level"
OUT = ROOT / "packages" / "character-creator" / "src" / "content"
PROGRESS = ROOT / "packages" / "character-creator" / "dev-progress"

CLASS_MAP = {
    "bard": "barde",
    "cleric": "kleriker",
    "druid": "druide",
    "paladin": "paladin",
    "ranger": "waldlaeufer",
    "sorcerer": "hexenmeister",
    "warlock": "hexenpakt_magier",
    "wizard": "zauberer",
    "artificer": "erfinder",
}
SCHOOL_MAP = {
    "abjuration": "abjuration",
    "conjuration": "conjuration",
    "divination": "divination",
    "enchantment": "enchantment",
    "evocation": "evocation",
    "illusion": "illusion",
    "necromancy": "necromancy",
    "transmutation": "transmutation",
}
SCHOOL_DE = {
    "abjuration": "Abwehr",
    "conjuration": "Beschwörung",
    "divination": "Erkenntnis",
    "enchantment": "Verzauberung",
    "evocation": "Hervorrufung",
    "illusion": "Illusion",
    "necromancy": "Nekromantie",
    "transmutation": "Verwandlung",
}

# Load NAME_DE from generator module text
ns: dict = {}
exec(
    (ROOT / "scripts" / "generate-srd-spells-l2-l9.py")
    .read_text(encoding="utf-8")
    .split("def slug_to_key")[0]
    + "\n",
    ns,
)
NAME_DE: dict[str, str] = dict(ns["NAME_DE"])
NAME_DE.update(
    {
        "suggestion": "Eingebung",
        "geas": "Banngebot",
        "simulacrum": "Trugbild",
        "gate": "Tor",
        "mass-heal": "Massenheilung",
        "antimagic-field": "Antimagiefeld",
        "branding-smite": "Brandmal-Bannschlag",
        "find-steed": "Streitross finden",
        "arcanists-magic-aura": "Arkane Aura",
        "locate-animals-or-plants": "Tiere oder Pflanzen orten",
        "animal-shapes": "Tiergestalten",
        "astral-projection": "Astrale Projektion",
        "demiplane": "Halbebene",
        "dominate-monster": "Monster beherrschen",
        "earthquake": "Erdbeben",
        "imprisonment": "Einkerkerung",
        "power-word-heal": "Machtwort Heilen",
        "storm-of-vengeance": "Sturm der Rache",
        "weird": "Schrecken",
        "blade-barrier": "Klingenbarriere",
        "control-weather": "Wetter kontrollieren",
        "divine-word": "Göttliches Wort",
        "fire-storm": "Feuersturm",
        "incendiary-cloud": "Brandwolke",
        "regenerate": "Regenerieren",
        "resurrection": "Auferstehung",
        "reverse-gravity": "Schwerkraft umkehren",
        "sequester": "Absondern",
        "symbol": "Runensymbol",
        "project-image": "Bildprojektion",
        "simulacrum": "Trugbild",
        "clone": "Klon",
        "create-undead": "Untote erschaffen",
        "magic-jar": "Magischer Krug",
        "programmed-illusion": "Programmierte Illusion",
        "reincarnate": "Wiedergeburt",
        "foresight": "Voraussicht",
        "animate-dead": "Untote beleben",
        "animate-objects": "Gegenstände beleben",
        "arcane-eye": "Arkanes Auge",
        "arcane-sword": "Arkanes Schwert",
    }
)

# Full DE display names for remaining titles
_names_file = PROGRESS / "spell-names-de.json"
if _names_file.exists():
    _by_en = json.loads(_names_file.read_text(encoding="utf-8")).get("byNameEn", {})
else:
    _by_en = {}


def slug_key(slug: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", slug.lower().replace("'", "")).strip("_")


def feet_to_m(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        feet = int(match.group(1))
        meters = round(feet * 0.3, 1)
        if meters == int(meters):
            meters = int(meters)
        return f"{meters} Meter"

    text = re.sub(r"\b(\d+)\s*-\s*foot\b", repl, text, flags=re.I)
    text = re.sub(r"\b(\d+)\s*foot\b", repl, text, flags=re.I)
    return re.sub(r"\b(\d+)\s*feet\b", repl, text, flags=re.I)


def casting_de(en: str) -> str:
    return {
        "1 action": "Aktion",
        "1 bonus action": "Bonusaktion",
        "1 reaction": "Reaktion",
        "1 minute": "1 Minute",
        "10 minutes": "10 Minuten",
        "1 hour": "1 Stunde",
        "8 hours": "8 Stunden",
        "12 hours": "12 Stunden",
        "24 hours": "24 Stunden",
    }.get(en.lower().strip(), en)


def range_de(en: str) -> str:
    low = (en or "").lower().strip()
    if low == "self":
        return "Selbst"
    if low == "touch":
        return "Berührung"
    if low in {"special", "varies"}:
        return "besonders"
    return feet_to_m(en or "Selbst")


def duration_de(en: str, conc: bool) -> str:
    raw = (en or "Augenblicklich").strip()
    if raw.lower() in {"special", "varies"}:
        base = "besonders"
    else:
        base = feet_to_m(raw)
        base = re.sub(r"(?i)instantaneous", "Augenblicklich", base)
        base = re.sub(r"(?i)concentration,\s*", "", base).strip()
        base = re.sub(r"(?i)\bup to\b", "bis zu", base)
        for eng, deu in [
            ("hours", "Stunden"),
            ("hour", "Stunde"),
            ("minutes", "Minuten"),
            ("minute", "Minute"),
            ("rounds", "Runden"),
            ("round", "Runde"),
            ("days", "Tage"),
            ("day", "Tag"),
        ]:
            base = re.sub(rf"\b{eng}\b", deu, base, flags=re.I)
    if conc:
        return f"Konzentration, {base}"
    return base or "Augenblicklich"


def lists_for(item: dict) -> list[str]:
    out: list[str] = []
    for name in item.get("spell_lists") or []:
        key = CLASS_MAP.get(str(name).lower().strip())
        if key and key not in out:
            out.append(key)
    if not out and item.get("dnd_class"):
        for part in re.split(r"[,/]", item["dnd_class"]):
            key = CLASS_MAP.get(part.strip().lower())
            if key and key not in out:
                out.append(key)
    return out


def comps_de(item: dict) -> str:
    parts: list[str] = []
    if item.get("requires_verbal_components"):
        parts.append("V")
    if item.get("requires_somatic_components"):
        parts.append("G")
    if item.get("requires_material_components"):
        parts.append("M")
    label = ", ".join(parts) or "—"
    mat = item.get("material")
    if mat:
        return f"{label} (Material: {feet_to_m(str(mat))})"
    return label


def german_desc(
    item: dict,
    name: str,
    level: int,
    school: str,
    ct: str,
    rng: str,
    dur: str,
    lists: list[str],
) -> str:
    school_de = SCHOOL_DE.get(school, school)
    lists_de = ", ".join(lists) if lists else "keine Klassenliste"
    cue = (item.get("desc") or "").strip().split(".")[0].strip()
    cue = feet_to_m(cue)
    if len(cue) > 240:
        cue = cue[:237] + "…"
    higher = (
        " Bei höherem Zauberplatz steigert sich der Effekt laut SRD."
        if (item.get("higher_level") or "").strip()
        else ""
    )
    return (
        f"{name} ist ein Zauber des {level}. Grades ({school_de}). "
        f"Wirkungszeit: {ct}. Reichweite: {rng}. Dauer: {dur}. "
        f"Komponenten: {comps_de(item)}. Listen: {lists_de}. "
        f"Kernwirkung: {cue}.{higher}"
    )


def emit(level: int, entries: list[dict], const: str) -> str:
    lines = [
        "/**",
        f" * SRD-Zauber Grad {level} — Open5e wotc-srd (CC-BY-4.0), deutsche UWE-Fassungen.",
        " * Ability score names bleiben Englisch (Strength, Dexterity, …).",
        " */",
        "",
        'import { SRD_SOURCE, type Spell } from "../types";',
        "",
        f"export const {const}: Spell[] = [",
    ]
    for entry in entries:
        material = entry["components"]["material"]
        mat = "null" if material is None else json.dumps(material, ensure_ascii=False)
        lines.extend(
            [
                "  {",
                f'    key: {json.dumps(entry["key"])},',
                f'    name: {json.dumps(entry["name"], ensure_ascii=False)},',
                f'    nameEn: {json.dumps(entry["nameEn"], ensure_ascii=False)},',
                f'    hook: {json.dumps(entry["hook"], ensure_ascii=False)},',
                f'    description: {json.dumps(entry["description"], ensure_ascii=False)},',
                "    source: SRD_SOURCE,",
                f"    level: {entry['level']},",
                f'    school: {json.dumps(entry["school"])},',
                f'    castingTime: {json.dumps(entry["castingTime"], ensure_ascii=False)},',
                f'    range: {json.dumps(entry["range"], ensure_ascii=False)},',
                "    components: {"
                f' verbal: {str(entry["components"]["verbal"]).lower()},'
                f' somatic: {str(entry["components"]["somatic"]).lower()},'
                f" material: {mat} "
                "},",
                f'    duration: {json.dumps(entry["duration"], ensure_ascii=False)},',
                f"    concentration: {str(entry['concentration']).lower()},",
                f"    ritual: {str(entry['ritual']).lower()},",
                f"    lists: {json.dumps(entry['lists'])},",
                "  },",
            ]
        )
    lines.extend(["];", ""])
    return "\n".join(lines)


def main() -> None:
    total = 0
    for level in range(2, 10):
        raw = json.loads((SRC / f"level-{level}.json").read_text(encoding="utf-8"))
        entries: list[dict] = []
        for item in raw:
            slug = item["slug"]
            key = slug_key(slug)
            name_en = item["name"]
            name = NAME_DE.get(slug) or _by_en.get(name_en) or name_en
            school = SCHOOL_MAP.get(str(item.get("school", "")).lower(), "evocation")
            conc = bool(item.get("requires_concentration")) or str(
                item.get("concentration", "")
            ).lower() in {"yes", "true", "1"}
            ritual = bool(item.get("can_be_cast_as_ritual")) or str(
                item.get("ritual", "")
            ).lower() in {"yes", "true", "1"}
            material = item.get("material") or None
            if material == "":
                material = None
            ct = casting_de(item.get("casting_time") or "1 action")
            rng = range_de(item.get("range") or "Selbst")
            dur = duration_de(item.get("duration") or "Augenblicklich", conc)
            lists = lists_for(item)
            hook = f"{name}: Grad {level}, {SCHOOL_DE.get(school, school)} — {ct}, {rng}."
            desc = german_desc(item, name, level, school, ct, rng, dur, lists)
            entries.append(
                {
                    "key": key,
                    "name": name,
                    "nameEn": name_en,
                    "hook": hook,
                    "description": desc,
                    "level": level,
                    "school": school,
                    "castingTime": ct,
                    "range": rng,
                    "components": {
                        "verbal": bool(item.get("requires_verbal_components")),
                        "somatic": bool(item.get("requires_somatic_components")),
                        "material": material,
                    },
                    "duration": dur,
                    "concentration": conc,
                    "ritual": ritual,
                    "lists": lists,
                }
            )

        chunk = 28
        if len(entries) <= chunk:
            (OUT / f"spells-level{level}.ts").write_text(
                emit(level, entries, f"LEVEL{level}_SPELLS"), encoding="utf-8"
            )
        else:
            parts: list[str] = []
            for i in range(0, len(entries), chunk):
                chunk_entries = entries[i : i + chunk]
                suffix = chr(ord("a") + i // chunk)
                const = f"LEVEL{level}_SPELLS_{suffix.upper()}"
                (OUT / f"spells-level{level}-{suffix}.ts").write_text(
                    emit(level, chunk_entries, const), encoding="utf-8"
                )
                parts.append(const)
            imports = "\n".join(
                f'import {{ {name} }} from "./spells-level{level}-{chr(ord("a") + idx)}";'
                for idx, name in enumerate(parts)
            )
            spread = ", ".join(f"...{name}" for name in parts)
            (OUT / f"spells-level{level}.ts").write_text(
                f"/** SRD-Zauber Grad {level} — zusammengesetzt. */\n"
                f'import type {{ Spell }} from "../types";\n'
                f"{imports}\n\n"
                f"export const LEVEL{level}_SPELLS: Spell[] = [{spread}];\n",
                encoding="utf-8",
            )
        total += len(entries)
        print(level, len(entries), entries[0]["range"], entries[0]["hook"][:90])

    meta = {
        "total": total,
        "style": "German structural summary + first-sentence SRD cue",
        "source": "Open5e v1 wotc-srd CC-BY-4.0",
        "note": "2014-era SRD spell corpus; meters in range/duration; DE polish of Kernwirkung still incremental",
        "levels": {
            str(i): len(json.loads((SRC / f"level-{i}.json").read_text(encoding="utf-8")))
            for i in range(2, 10)
        },
    }
    PROGRESS.mkdir(parents=True, exist_ok=True)
    (PROGRESS / "spells-l2-l9-import.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("TOTAL", total)


if __name__ == "__main__":
    main()
