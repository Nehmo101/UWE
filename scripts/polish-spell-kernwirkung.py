#!/usr/bin/env python3
"""Polish Kernwirkung to German; fix Sight / Until dispelled / remaining English meta."""

from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(r"C:\git\uwe")
SCRIPT = ROOT / "scripts" / "regenerate-srd-spells-de.py"


def load_regen():
    spec = importlib.util.spec_from_file_location("regen", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def translate_kern(en: str) -> str:
    """Aggressive phrase-level German paraphrase of first SRD sentence(s)."""
    t = en.strip()
    t = re.sub(r"\b(\d+)\s*feet\b", lambda m: f"{int(round(int(m.group(1))*0.3))} Meter", t, flags=re.I)
    t = re.sub(r"\b(\d+)\s*foot\b", lambda m: f"{int(round(int(m.group(1))*0.3))} Meter", t, flags=re.I)
    # Keep ability names English; normalize save phrasing
    pairs = [
        (r"\bYou touch a willing creature\b", "Du berührst eine willige Kreatur"),
        (r"\bYou touch a creature\b", "Du berührst eine Kreatur"),
        (r"\bYou touch a corpse or other remains\b", "Du berührst eine Leiche oder andere Überreste"),
        (r"\bYou touch\b", "Du berührst"),
        (r"\bYou assume a different form\b", "Du nimmst eine andere Gestalt an"),
        (r"\bYou place an illusion on a creature or an object you touch so that divination spells reveal false information about it\b",
         "Du legst eine Illusion auf eine berührte Kreatur oder einen berührten Gegenstand, sodass Wahrsagezauber falsche Informationen darüber enthüllen"),
        (r"\bYou can blind or deafen a foe\b", "Du kannst einen Gegner blenden oder taub machen"),
        (r"\bYou attempt to suppress strong emotions in a group of people\b",
         "Du versuchst, starke Emotionen in einer Gruppe von Personen zu unterdrücken"),
        (r"\bYou weave a distracting string of words, causing creatures of your choice that you can see within range and that can hear you to make a wisdom saving throw\b",
         "Du webst ablenkende Worte; gewählte Kreaturen in Reichweite, die dich sehen und hören können, müssen einen Wisdom saving throw bestehen"),
        (r"\bYou summon a spirit that assumes the form of an unusually intelligent, strong, and loyal steed, creating a long-lasting bond with it\b",
         "Du rufst einen Geist, der die Gestalt eines ungewöhnlich intelligenten, starken und treuen Rosses annimmt, und bindest euch dauerhaft"),
        (r"\bYou sense the presence of any trap within range that is within line of sight\b",
         "Du spürst jede Falle in Reichweite, die in Sichtlinie liegt"),
        (r"\bYou evoke a fiery blade in your free hand\b", "Du rufst eine flammende Klinge in deine freie Hand"),
        (r"\bA creature you touch becomes invisible until the spell ends\b",
         "Eine von dir berührte Kreatur wird unsichtbar, bis der Zauber endet"),
        (r"\bA shimmering green arrow streaks toward a target within range and bursts in a spray of acid\b",
         "Ein schimmernder grüner Pfeil rast auf ein Ziel in Reichweite zu und zerplatzt in einem Säureschauer"),
        (r"\bA flame, equivalent in brightness to a torch, springs forth from an object that you touch\b",
         "Eine Flamme so hell wie eine Fackel entspringt einem von dir berührten Gegenstand"),
        (r"\bA line of strong wind (\d+) Meter long and (\d+) Meter wide blasts from you in a direction you choose for the spell's duration\b",
         r"Ein Windstoß von \1 Meter Länge und \2 Meter Breite bläst für die Dauer in eine von dir gewählte Richtung"),
        (r"\bA (\d+(?:\.\d+)?) Meter-diameter sphere of fire appears in an unoccupied space of your choice within range and lasts for the duration\b",
         r"Eine Feuerkugel von \1 Meter Durchmesser erscheint in einem freien Raum deiner Wahl in Reichweite und hält für die Dauer"),
        (r"\bYou cause a creature or an object you can see within range to grow larger or smaller for the duration\b",
         "Du lässt eine Kreatur oder einen Gegenstand in Sicht und Reichweite für die Dauer wachsen oder schrumpfen"),
        (r"\bYou touch a willing creature to grant it the ability to see in the dark\b",
         "Du berührst eine willige Kreatur und verleihst ihr die Fähigkeit, im Dunkeln zu sehen"),
        (r"\bYou touch a closed door, window, gate, chest, or other entryway, and it becomes locked for the duration\b",
         "Du berührst eine geschlossene Tür, ein Fenster, Tor, eine Truhe oder einen anderen Zugang — er ist für die Dauer verschlossen"),
        (r"\bYou touch a creature and bestow upon it a magical enhancement\b",
         "Du berührst eine Kreatur und verleihst ihr eine magische Verbesserung"),
        (r"\bMake a ranged spell attack against the target\b", "Mache einen Fernkampf-Zauberangriff gegen das Ziel"),
        (r"\bMake a melee spell attack\b", "Mache einen Nahkampf-Zauberangriff"),
        (r"\bOn a hit,\b", "Bei einem Treffer"),
        (r"\bOn a miss,\b", "Bei einem Fehlschlag"),
        (r"\bthe target takes\b", "nimmt das Ziel"),
        (r"\bimmediately and\b", "sofort und"),
        (r"\bat the end of its next turn\b", "am Ende seines nächsten Zuges"),
        (r"\bthe arrow splashes the target with acid for half as much of the initial damage and no damage at the end of its next turn\b",
         "bespritzt der Pfeil das Ziel mit Säure für die Hälfte des Anfangsschadens und keinen Folgeschaden am Ende seines nächsten Zuges"),
        (r"\bmust make a (\w+) saving throw\b", r"muss einen \1 saving throw bestehen"),
        (r"\bmust succeed on a (\w+) saving throw\b", r"muss einen \1 saving throw bestehen"),
        (r"\bEach creature\b", "Jede Kreatur"),
        (r"\bA creature\b", "Eine Kreatur"),
        (r"\bcreatures\b", "Kreaturen"),
        (r"\bcreature\b", "Kreatur"),
        (r"\bwithin range\b", "in Reichweite"),
        (r"\bfor the duration\b", "für die Dauer"),
        (r"\buntil the spell ends\b", "bis der Zauber endet"),
        (r"\bacid damage\b", "Säureschaden"),
        (r"\bfire damage\b", "Feuerschaden"),
        (r"\bcold damage\b", "Kälteschaden"),
        (r"\blightning damage\b", "Blitzschaden"),
        (r"\bthunder damage\b", "Donnerschaden"),
        (r"\bforce damage\b", "Kraftschaden"),
        (r"\bpoison damage\b", "Giftschaden"),
        (r"\bradiant damage\b", "gleißenden Schaden"),
        (r"\bnecrotic damage\b", "nekrotischen Schaden"),
        (r"\bpsychic damage\b", "psychischen Schaden"),
        (r"\bdamage\b", "Schaden"),
        (r"\bYou\b", "Du"),
        (r"\byour\b", "dein"),
        (r"\bYour\b", "Dein"),
    ]
    for pat, rep in pairs:
        t = re.sub(pat, rep, t)
    t = re.sub(r"\s+", " ", t).strip()
    # If still mostly English (starts with common EN leftovers), wrap as short DE cue
    if re.match(r"^(A |An |The |This |Choose |Choose|When |While |Until )", t):
        t = "Laut SRD: " + t  # last resort marker — still improve below
    return t


def polish_file(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    changed = 0

    def fix_desc(m: re.Match[str]) -> str:
        nonlocal changed
        full = m.group(0)
        # Fix Until dispelled / Sight in the whole description string
        new = full.replace("Until dispelled", "Bis gebannt").replace("until dispelled", "bis gebannt")
        new = new.replace("Sight.", "Sichtweite.").replace("Sight,", "Sichtweite,")
        new = re.sub(r"Reichweite: Sight", "Reichweite: Sichtweite", new)
        new = re.sub(r"Dauer: Until dispelled", "Dauer: Bis gebannt", new)
        # Translate Kernwirkung segment
        def kern_repl(km: re.Match[str]) -> str:
            nonlocal changed
            en = km.group(1)
            de = translate_kern(en)
            if de != en:
                changed += 1
            return f"Kernwirkung: {de}"

        new2 = re.sub(r"Kernwirkung: ([^\"\\]+)", kern_repl, new)
        return new2

    text2 = re.sub(
        r'description: "((?:\\.|[^"\\])*)"',
        lambda m: 'description: "' + fix_desc_inner(m.group(1)) + '"',
        text,
    )
    # Simpler approach: whole-file replacements then kernwirkung
    text2 = text
    text2 = text2.replace("Until dispelled", "Bis gebannt")
    text2 = text2.replace("Reichweite: Sight", "Reichweite: Sichtweite")
    text2 = re.sub(r"Dauer: Special", "Dauer: besonders", text2)

    def kern(m: re.Match[str]) -> str:
        nonlocal changed
        en = m.group(1)
        # Don't double-translate already German
        if re.search(r"\b(Du |Eine |Ein |Jede |Laut SRD)", en):
            return m.group(0)
        de = translate_kern(en)
        changed += 1
        return "Kernwirkung: " + de

    text2 = re.sub(r"Kernwirkung: ([^\"\\]+)", kern, text2)
    if text2 != text:
        path.write_text(text2, encoding="utf-8")
    return changed


def fix_desc_inner(s: str) -> str:
    return s


def main() -> None:
    # Prefer regenerating via improved german_desc in regen module
    mod = load_regen()

    def german_desc(item, name, level, school, ct, rng, dur, lists):
        school_de = mod.SCHOOL_DE.get(school, school)
        lists_de = ", ".join(lists) if lists else "keine Klassenliste"
        en = (item.get("desc") or "").strip()
        # first two sentences for better coverage
        parts = [p.strip() for p in en.split(".") if p.strip()]
        cue = ". ".join(parts[:2])
        if cue and not cue.endswith("."):
            cue += "."
        cue = mod.feet_to_m(cue)
        cue = translate_kern(cue)
        higher = (
            " Bei höherem Zauberplatz steigert sich der Effekt laut SRD."
            if (item.get("higher_level") or "").strip()
            else ""
        )
        return (
            f"{name} ist ein Zauber des {level}. Grades ({school_de}). "
            f"Wirkungszeit: {ct}. Reichweite: {rng}. Dauer: {dur}. "
            f"Komponenten: {mod.comps_de(item)}. Listen: {lists_de}. "
            f"Kernwirkung: {cue}{higher}"
        )

    mod.german_desc = german_desc
    # also harden range_de / duration_de for Sight / Until dispelled
    _old_range = mod.range_de

    def range_de(en: str) -> str:
        low = (en or "").lower().strip()
        if low in {"sight", "special", "varies"}:
            return "Sichtweite" if low == "sight" else "besonders"
        return _old_range(en)

    mod.range_de = range_de
    _old_dur = mod.duration_de

    def duration_de(en: str, conc: bool) -> str:
        raw = (en or "").strip()
        if re.search(r"(?i)until dispelled", raw):
            base = "Bis gebannt"
            return f"Konzentration, {base}" if conc else base
        return _old_dur(en, conc)

    mod.duration_de = duration_de
    mod.main()
    print("regenerated via patched german_desc")


if __name__ == "__main__":
    main()
