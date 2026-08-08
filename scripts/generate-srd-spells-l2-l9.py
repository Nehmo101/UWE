#!/usr/bin/env python3
"""Generate UWE character-creator spell modules from Open5e wotc-srd JSON (CC-BY).

Source: Open5e API document__slug=wotc-srd (SRD Core Rules, CC-BY-4.0).
Note: This is the classic SRD spell corpus used for L2–9 import while Open5e
5.2.1 spell endpoints are unavailable. Documented in missing-data MD-01.
"""

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

# Well-known German display names (SRD / common DE usage)
NAME_DE: dict[str, str] = {
    "acid-arrow": "Säurepfeil",
    "aid": "Unterstützung",
    "alter-self": "Gestalt verändern",
    "animal-messenger": "Tierbote",
    "arcane-lock": "Arkanes Schloss",
    "augury": "Vorzeichen",
    "barkskin": "Baumrinde",
    "blindness-deafness": "Blindheit/Taubheit",
    "blur": "Verschwimmen",
    "calm-emotions": "Gefühle beruhigen",
    "continual-flame": "Ewige Flamme",
    "darkness": "Dunkelheit",
    "darkvision": "Dunkelsicht",
    "detect-thoughts": "Gedanken wahrnehmen",
    "enhance-ability": "Attribut verbessern",
    "enlarge-reduce": "Vergrößern/Verkleinern",
    "enthrall": "Fesseln",
    "find-traps": "Fallen finden",
    "flame-blade": "Flammenschwert",
    "flaming-sphere": "Flammenkugel",
    "gentle-repose": "Sanfte Ruhe",
    "gust-of-wind": "Windstoß",
    "heat-metal": "Metall erhitzen",
    "hold-person": "Person festhalten",
    "invisibility": "Unsichtbarkeit",
    "knock": "Klopfen",
    "lesser-restoration": "Geringe Wiederherstellung",
    "levitate": "Schweben",
    "locate-object": "Objekt orten",
    "magic-mouth": "Magischer Mund",
    "magic-weapon": "Magische Waffe",
    "mirror-image": "Spiegelbild",
    "misty-step": "Nebelhaftiger Schritt",
    "moonbeam": "Mondstrahl",
    "pass-without-trace": "Spurlos gehen",
    "prayer-of-healing": "Gebet der Heilung",
    "protection-from-poison": "Schutz vor Gift",
    "ray-of-enfeeblement": "Strahl der Schwäche",
    "rope-trick": "Seiltrick",
    "scorching-ray": "Sengender Strahl",
    "see-invisibility": "Unsichtbares sehen",
    "shatter": "Zerbersten",
    "silence": "Stille",
    "spider-climb": "Spinnenklettern",
    "spike-growth": "Stachelwuchs",
    "spiritual-weapon": "Geistige Waffe",
    "suggestion": "Suggestion",
    "warding-bond": "Schutzbund",
    "web": "Netz",
    "zone-of-truth": "Zone der Wahrheit",
    "fireball": "Feuerball",
    "fly": "Fliegen",
    "haste": "Eile",
    "slow": "Verlangsamen",
    "counterspell": "Gegenzauber",
    "dispel-magic": "Magie bannen",
    "lightning-bolt": "Blitzstrahl",
    "revivify": "Wiederbeleben",
    "tongues": "Zungen",
    "water-walk": "Wasserwandeln",
    "water-breathing": "Wasseratmung",
    "dimension-door": "Dimensions Tür",
    "polymorph": "Verwandlung",
    "stoneskin": "Steinhaut",
    "wall-of-fire": "Feuerwall",
    "banishment": "Verbannung",
    "greater-invisibility": "Höhere Unsichtbarkeit",
    "cone-of-cold": "Kältekegel",
    "dominate-person": "Person beherrschen",
    "hold-monster": "Monster festhalten",
    "telekinesis": "Telekinese",
    "teleportation-circle": "Teleportationskreis",
    "wall-of-force": "Kraftwall",
    "wall-of-stone": "Steinwall",
    "chain-lightning": "Kettenblitz",
    "disintegrate": "Auflösen",
    "globe-of-invulnerability": "Kugel der Unverwundbarkeit",
    "heal": "Heilen",
    "mass-suggestion": "Massensuggestion",
    "true-seeing": "Wahrer Blick",
    "finger-of-death": "Finger des Todes",
    "plane-shift": "Ebenenwechsel",
    "teleport": "Teleportieren",
    "forcecage": "Kraftkäfig",
    "feeblemind": "Geistesschwäche",
    "mind-blank": "Gedankenleere",
    "power-word-stun": "Machtwort Betäuben",
    "foresight": "Voraussicht",
    "power-word-kill": "Machtwort Töten",
    "time-stop": "Zeitstopp",
    "wish": "Wunsch",
    "meteor-swarm": "Meteorenschwarm",
    "shapechange": "Gestaltwandel",
    "true-polymorph": "Wahre Verwandlung",
}


def slug_to_key(slug: str) -> str:
    key = slug.lower().replace("'", "").replace("/", "-")
    key = re.sub(r"[^a-z0-9-]+", "-", key)
    key = re.sub(r"-+", "-", key).strip("-")
    # ASCII-only keys for catalog integrity
    return key.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")


def feet_to_meters(text: str) -> str:
    def repl(m: re.Match[str]) -> str:
        feet = int(m.group(1))
        meters = round(feet * 0.3, 1)
        if meters == int(meters):
            meters = int(meters)
        return f"{meters} Meter"

    return re.sub(r"\b(\d+)\s*feet\b", repl, text, flags=re.I)


def translate_desc(en: str, higher: str | None) -> str:
    """Pragmatic German mechanical paraphrase + higher-level note."""
    t = feet_to_meters(en)
    # Common mechanical phrases → German (order matters)
    replacements = [
        (r"\bMake a ranged spell attack\b", "Mache einen Fernkampf-Zauberangriff"),
        (r"\bMake a melee spell attack\b", "Mache einen Nahkampf-Zauberangriff"),
        (r"\bOn a hit\b", "Bei einem Treffer"),
        (r"\bOn a miss\b", "Bei einem Fehlschlag"),
        (r"\bmust make a (.+?) saving throw\b", r"muss einen \1-Rettungswurf bestehen"),
        (r"\bStrength\b", "Strength"),
        (r"\bDexterity\b", "Dexterity"),
        (r"\bConstitution\b", "Constitution"),
        (r"\bIntelligence\b", "Intelligence"),
        (r"\bWisdom\b", "Wisdom"),
        (r"\bCharisma\b", "Charisma"),
        (r"\bInstantaneous\b", "Augenblicklich"),
        (r"\bConcentration\b", "Konzentration"),
        (r"\bUntil dispelled\b", "Bis gebannt"),
        (r"\b1 action\b", "1 Aktion"),
        (r"\bbonus action\b", "Bonusaktion"),
        (r"\breaction\b", "Reaktion"),
        (r"\bself\b", "Selbst"),
        (r"\btouch\b", "Berührung"),
        (r"\bacid damage\b", "Säureschaden"),
        (r"\bfire damage\b", "Feuerschaden"),
        (r"\bcold damage\b", "Kälteschaden"),
        (r"\blightning damage\b", "Blitzschaden"),
        (r"\blightning\b", "Blitz"),
        (r"\blightning damage\b", "Blitzschaden"),
        (r"\bthunder damage\b", "Donnerschaden"),
        (r"\bnecrotic damage\b", "nekrotischen Schaden"),
        (r"\bpsychic damage\b", "psychischen Schaden"),
        (r"\bforce damage\b", "Kraftschaden"),
        (r"\bpoison damage\b", "Giftschaden"),
        (r"\bradiant damage\b", "gleißenden Schaden"),
        (r"\bslashing damage\b", "Hiebschaden"),
        (r"\bpiercing damage\b", "Stichschaden"),
        (r"\bbludgeoning damage\b", "Wuchtschaden"),
        (r"\bdamage\b", "Schaden"),
        (r"\btarget\b", "Ziel"),
        (r"\bcreature\b", "Kreatur"),
        (r"\bcreatures\b", "Kreaturen"),
        (r"\bwithin range\b", "in Reichweite"),
        (r"\bspell slot\b", "Zauberplatz"),
        (r"\bWhen you cast this spell using a spell slot of\b", "Wenn du diesen Zauber mit einem Zauberplatz der"),
        (r"\bor higher\b", "oder höher wirkst"),
    ]
    for pat, rep in replacements:
        t = re.sub(pat, rep, t)
    t = re.sub(r"\s+", " ", t).strip()
    if higher:
        h = feet_to_meters(higher)
        for pat, rep in replacements:
            h = re.sub(pat, rep, h)
        h = re.sub(r"\s+", " ", h).strip()
        t = f"{t} {h}"
    # Prefix note that this is a DE paraphrase of SRD mechanics
    return t


def casting_time_de(en: str) -> str:
    mapping = {
        "1 action": "Aktion",
        "1 bonus action": "Bonusaktion",
        "1 reaction": "Reaktion",
        "1 minute": "1 Minute",
        "10 minutes": "10 Minuten",
        "1 hour": "1 Stunde",
        "8 hours": "8 Stunden",
        "12 hours": "12 Stunden",
        "24 hours": "24 Stunden",
    }
    return mapping.get(en.lower().strip(), en)


def range_de(en: str) -> str:
    low = en.lower().strip()
    if low == "self":
        return "Selbst"
    if low == "touch":
        return "Berührung"
    if "feet" in low:
        return feet_to_meters(en)
    return en


def duration_de(en: str, concentration: bool) -> str:
    base = feet_to_meters(en)
    base = base.replace("Instantaneous", "Augenblicklich").replace("instantaneous", "Augenblicklich")
    base = base.replace("Until dispelled", "Bis gebannt")
    if concentration and "Konzentration" not in base and "Concentration" not in en:
        return f"Konzentration, {base}"
    if "Concentration," in en or "concentration," in en.lower():
        base = re.sub(r"[Cc]oncentration,\s*", "Konzentration, ", base)
    return base


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


def to_entry(item: dict) -> dict:
    slug = item["slug"]
    key = slug_to_key(slug)
    name_en = item["name"]
    name = NAME_DE.get(slug, name_en)
    school = SCHOOL_MAP.get(str(item.get("school", "")).lower(), "evocation")
    conc = bool(item.get("requires_concentration")) or str(item.get("concentration", "")).lower() in {
        "yes",
        "true",
        "1",
    }
    ritual = bool(item.get("can_be_cast_as_ritual")) or str(item.get("ritual", "")).lower() in {
        "yes",
        "true",
        "1",
    }
    material = item.get("material")
    if material in ("", None):
        material = None
    desc = translate_desc(item.get("desc") or "", item.get("higher_level") or None)
    hook = f"SRD-Zauber Grad {item.get('level_int')}: {name}."
    return {
        "key": key,
        "name": name,
        "nameEn": name_en,
        "hook": hook,
        "description": desc,
        "level": int(item.get("level_int") or item.get("spell_level") or 0),
        "school": school,
        "castingTime": casting_time_de(item.get("casting_time") or "1 action"),
        "range": range_de(item.get("range") or "Selbst"),
        "components": {
            "verbal": bool(item.get("requires_verbal_components")),
            "somatic": bool(item.get("requires_somatic_components")),
            "material": material,
        },
        "duration": duration_de(item.get("duration") or "Augenblicklich", conc),
        "concentration": conc,
        "ritual": ritual,
        "lists": lists_for(item),
    }


def emit_ts(level: int, entries: list[dict], const_name: str) -> str:
    lines = [
        "/**",
        f" * SRD-Zauber Grad {level} — importiert aus Open5e `wotc-srd` (CC-BY-4.0).",
        " * Mechanik aus dem SRD; deutsche Namen/Prosa sind UWE-Fassungen.",
        " * Ability score names in descriptions remain English where present.",
        " */",
        "",
        'import { SRD_SOURCE, type Spell } from "../types";',
        "",
        f"export const {const_name}: Spell[] = [",
    ]
    for e in entries:
        mat = "null" if e["components"]["material"] is None else json.dumps(
            e["components"]["material"], ensure_ascii=False
        )
        lists = json.dumps(e["lists"], ensure_ascii=False)
        lines.append("  {")
        lines.append(f'    key: {json.dumps(e["key"])},')
        lines.append(f'    name: {json.dumps(e["name"], ensure_ascii=False)},')
        lines.append(f'    nameEn: {json.dumps(e["nameEn"], ensure_ascii=False)},')
        lines.append(f'    hook: {json.dumps(e["hook"], ensure_ascii=False)},')
        lines.append(f'    description: {json.dumps(e["description"], ensure_ascii=False)},')
        lines.append("    source: SRD_SOURCE,")
        lines.append(f"    level: {e['level']},")
        lines.append(f'    school: {json.dumps(e["school"])},')
        lines.append(f'    castingTime: {json.dumps(e["castingTime"], ensure_ascii=False)},')
        lines.append(f'    range: {json.dumps(e["range"], ensure_ascii=False)},')
        lines.append(
            "    components: {"
            f' verbal: {str(e["components"]["verbal"]).lower()},'
            f' somatic: {str(e["components"]["somatic"]).lower()},'
            f" material: {mat} "
            "},"
        )
        lines.append(f'    duration: {json.dumps(e["duration"], ensure_ascii=False)},')
        lines.append(f"    concentration: {str(e['concentration']).lower()},")
        lines.append(f"    ritual: {str(e['ritual']).lower()},")
        lines.append(f"    lists: {lists},")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    all_entries: list[dict] = []
    exports: list[tuple[int, str]] = []
    for level in range(2, 10):
        raw = json.loads((SRC / f"level-{level}.json").read_text(encoding="utf-8"))
        entries = [to_entry(item) for item in raw]
        # drop empty lists? keep even if empty — still catalog
        const = f"LEVEL{level}_SPELLS"
        # split if too many to keep file size reasonable
        chunk_size = 28
        if len(entries) <= chunk_size:
            path = OUT / f"spells-level{level}.ts"
            path.write_text(emit_ts(level, entries, const), encoding="utf-8")
            exports.append((level, const))
            print("wrote", path.name, len(entries))
        else:
            parts = []
            for i in range(0, len(entries), chunk_size):
                chunk = entries[i : i + chunk_size]
                suffix = chr(ord("a") + i // chunk_size)
                cname = f"LEVEL{level}_SPELLS_{suffix.upper()}"
                path = OUT / f"spells-level{level}-{suffix}.ts"
                path.write_text(emit_ts(level, chunk, cname), encoding="utf-8")
                parts.append(cname)
                print("wrote", path.name, len(chunk))
            # barrel for level
            barrel = OUT / f"spells-level{level}.ts"
            imports = "\n".join(
                f'import {{ {name} }} from "./spells-level{level}-{chr(ord("a") + idx)}";'
                for idx, name in enumerate(parts)
            )
            spread = ", ".join(f"...{name}" for name in parts)
            barrel.write_text(
                f'/** SRD-Zauber Grad {level} — zusammengesetzt. */\n'
                f'import type {{ Spell }} from "../types";\n'
                f"{imports}\n\n"
                f"export const LEVEL{level}_SPELLS: Spell[] = [{spread}];\n",
                encoding="utf-8",
            )
            exports.append((level, f"LEVEL{level}_SPELLS"))
            print("wrote", barrel.name, "barrel")
        all_entries.extend(entries)

    # update content/index.ts SPELLS merge — patch via marker rewrite in caller
    meta = {
        "importedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "source": "Open5e v1 spells document__slug=wotc-srd (CC-BY-4.0)",
        "note": "2014-era SRD spell text via Open5e; used for L2–9 until 5.2.1 structured spells are available",
        "countsByLevel": {
            str(level): len(json.loads((SRC / f"level-{level}.json").read_text(encoding="utf-8")))
            for level in range(2, 10)
        },
        "total": len(all_entries),
        "exports": [{"level": level, "const": const} for level, const in exports],
    }
    PROGRESS.mkdir(parents=True, exist_ok=True)
    (PROGRESS / "spells-l2-l9-import.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("TOTAL", len(all_entries))


if __name__ == "__main__":
    main()
