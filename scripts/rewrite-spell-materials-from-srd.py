#!/usr/bin/env python3
"""Rewrite spell material components to German from Open5e English source.

Uses tmp/srd-spells-by-level for L2–9 and does not apply aggressive word-level
rewrites (those mangled mixed strings). Exact phrase map + curated leftovers.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "packages" / "character-creator" / "src" / "content"
SRC = ROOT / "tmp" / "srd-spells-by-level"

# Longest phrases first. Applied to original English materials only.
PHRASES: list[tuple[str, str]] = [
    (r"^a diamond worth at least (\d[\d,]*)\s*gp\.?$", r"ein Diamant im Wert von mindestens \1 KM"),
    (r"^a diamond worth (\d[\d,]*)\s*gp\.?$", r"ein Diamant im Wert von \1 KM"),
    (r"^diamonds worth (\d[\d,]*)\s*gp,? which the spell consumes\.?$",
     r"Diamanten im Wert von \1 KM, die der Zauber verbraucht"),
    (r"^diamonds worth at least (\d[\d,]*)\s*gp,? which the spell consumes\.?$",
     r"Diamanten im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"^a powdered diamond worth at least (\d[\d,]*)\s*gp\.?$",
     r"Diamantpulver im Wert von mindestens \1 KM"),
    (r"^diamond dust worth at least (\d[\d,]*)\s*gp,? which the spell consumes\.?$",
     r"Diamantstaub im Wert von mindestens \1 KM, den der Zauber verbraucht"),
    (r"^ruby dust worth at least (\d[\d,]*)\s*gp\.?$", r"Rubinpulver im Wert von mindestens \1 KM"),
    (r"^a pearl worth at least (\d[\d,]*)\s*gp\.?$", r"eine Perle im Wert von mindestens \1 KM"),
    (r"^a pearl worth (\d[\d,]*)\s*gp\.?$", r"eine Perle im Wert von \1 KM"),
    (r"^a black pearl worth at least (\d[\d,]*)\s*gp\.?$",
     r"eine schwarze Perle im Wert von mindestens \1 KM"),
    (r"^a jacinth worth at least (\d[\d,]*)\s*gp\.?$", r"ein Hyazinth im Wert von mindestens \1 KM"),
    (r"^a star ruby worth (\d[\d,]*)\s*gp\.?$", r"ein Sternrubin im Wert von \1 KM"),
    (r"^jewelry worth at least (\d[\d,]*)\s*gp\.?$", r"Schmuck im Wert von mindestens \1 KM"),
    (r"^a jewel worth at least (\d[\d,]*)\s*gp,? which the spell consumes\.?$",
     r"ein Juwel im Wert von mindestens \1 KM, das der Zauber verbraucht"),
    (r"^a gem-encrusted bowl worth at least ([\d,]+)\s*gp,? which the spell consumes\.?$",
     r"eine juwelenbesetzte Schale im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"^a jade circlet worth at least ([\d,]+)\s*gp,? which you must place on your head before you cast the spell\.?$",
     r"ein Jadering im Wert von mindestens \1 KM, den du vor dem Wirken auf den Kopf setzen musst"),
    (r"^a forked, metal rod worth at least ([\d,]+)\s*gp,? attuned to a particular plane of existence\.?$",
     r"eine gegabelte Metallstange im Wert von mindestens \1 KM, auf eine bestimmte Existenzebene eingestimmt"),
    (r"^a platinum ring worth at least (\d[\d,]*)\s*gp,? which you must wear for the duration\.?$",
     r"ein Platinring im Wert von mindestens \1 KM, den du für die Dauer tragen musst"),
    (r"^a pair of platinum rings worth at least (\d[\d,]*)\s*gp each,? which you and the target must wear for the duration\.?$",
     r"ein Paar Platinringe im Wert von mindestens \1 KM je Stück, die du und das Ziel für die Dauer tragen müsst"),
    (r"^a powder composed of diamond, emerald, ruby, and sapphire dust worth at least ([\d,]+)\s*gp,? which the spell consumes\.?$",
     r"ein Pulver aus Diamant-, Smaragd-, Rubin- und Saphirstaub im Wert von mindestens \1 KM, das der Zauber verbraucht"),
    (r"^incense and a sacrificial offering appropriate to your religion,? worth at least ([\d,]+)\s*gp,? which the spell consumes\.?$",
     r"Weihrauch und eine Opfergabe passend zu deiner Religion im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"^rare incense and powdered diamond worth at least ([\d,]+)\s*gp,? which the spell consumes\.?$",
     r"seltener Weihrauch und Diamantpulver im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"^incense and powdered diamond worth at least ([\d,]+)\s*gp,? which the spell consumes\.?$",
     r"Weihrauch und Diamantpulver im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"^honey and powdered silver worth at least (\d[\d,]*)\s*gp,? which the spell consumes\.?$",
     r"Honig und Silberpulver im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"^gold dust worth at least (\d[\d,]*)\s*gp,? which the spell consumes\.?$",
     r"Goldstaub im Wert von mindestens \1 KM, den der Zauber verbraucht"),
    (r"^a lead-based ink worth at least (\d[\d,]*)\s*gp,? which the spell consumes\.?$",
     r"bleihaltige Tinte im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"^a focus worth at least ([\d,]+)\s*gp,? either a jeweled horn for summoning elementals of air or earth or an incense burner for summoning elementals of fire or water\.?$",
     r"ein Fokus im Wert von mindestens \1 KM — juwelenbesetztes Horn (Luft/Erde) oder Räuchergefäß (Feuer/Wasser)"),
    (r"^a focus worth at least ([\d,]+)\s*gp,? either a jeweled horn for hearing or a glass eye for seeing\.?$",
     r"ein Fokus im Wert von mindestens \1 KM — juwelenbesetztes Horn (Hören) oder Glasauge (Sehen)"),
    (r"^a focus worth at least ([\d,]+)\s*gp,? such as a crystal ball, a silver mirror, or a font filled with holy water\.?$",
     r"ein Fokus im Wert von mindestens \1 KM, z. B. Kristallkugel, Silberspiegel oder Weihwasserbecken"),
    (r"^a gem, crystal, reliquary, or some other ornamental container worth at least ([\d,]+)\s*gp\.?$",
     r"ein Edelstein, Kristall, Reliquiar oder ein anderer Zierbehälter im Wert von mindestens \1 KM"),
    (r"^a miniature portal carved from ivory, a small piece of polished marble, and a tiny silver spoon,? each item worth at least (\d[\d,]*)\s*gp\.?$",
     r"ein Miniaturportal aus Elfenbein, ein kleines Stück polierten Marmors und ein winziger Silberlöffel, jedes mindestens \1 KM wert"),
    (r"^a writing quill crafted from a gold feather worth at least (\d[\d,]*)\s*gp\.?$",
     r"eine Schreibfeder aus einer Goldfeder im Wert von mindestens \1 KM"),
    (r"^a jewel-encrusted egg worth at least ([\d,]+)\s*gp\.?$",
     r"ein juwelenbesetztes Ei im Wert von mindestens \1 KM"),
    (r"^an ornate stone,? gem,? or crystal staff worth at least ([\d,]+)\s*gp\.?$",
     r"ein verzierter Stab aus Stein, Edelstein oder Kristall im Wert von mindestens \1 KM"),
    (r"^specially marked sticks, bones, or similar tokens worth at least (\d[\d,]*)\s*gp\.?$",
     r"besonders markierte Stäbe, Knochen oder ähnliche Token im Wert von mindestens \1 KM"),
    (r"^a small bit of honeycomb and jade dust worth at least (\d[\d,]*)\s*gp,? which the spell consumes\.?$",
     r"etwas Honigwabe und Jadestaub im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"^a powdered or crushed gemstone worth at least (\d[\d,]*)\s*gp\.?$",
     r"ein pulverisierter oder zerkleinerter Edelstein im Wert von mindestens \1 KM"),
    (r"^either a small leather loop or a piece of golden wire bent into a cup shape with a long shank on one end\.?$",
     r"entweder eine kleine Lederschlaufe oder ein Stück Golddraht, zu einer Becherform mit langem Schaft gebogen"),
    (r"^powdered rhubarb leaf and an adder's stomach\.?$",
     r"pulverisiertes Rhabarberblatt und ein Ottermagen"),
    (r"^a morsel of food\.?$", r"ein Happen Nahrung"),
    (r"^bat fur and a drop of pitch or piece of coal\.?$",
     r"Fledermausfell und ein Tropfen Pech oder ein Stück Kohle"),
    (r"^a copper coin\.?$", r"eine Kupfermünze"),
    (r"^fur or a feather from a beast\.?$", r"Fell oder eine Feder eines Biests"),
    (r"^a pinch of iron powder\.?$", r"eine Prise Eisenpulver"),
    (r"^a leaf of sumac\.?$", r"ein Sumachblatt"),
    (r"^a bit of tallow,? a pinch of brimstone,? and a dusting of iron powder\.?$",
     r"etwas Talg, eine Prise Schwefel und etwas Eisenpulver"),
    (r"^a legume seed\.?$", r"ein Hülsenfruchtsamen"),
    (r"^a piece of iron and a flame\.?$", r"ein Eisenstück und eine Flamme"),
    (r"^a forked twig\.?$", r"ein gegabelter Zweig"),
    (r"^ashes from a burned leaf of mistletoe and a sprig of spruce\.?$",
     r"Asche eines verbrannten Mistelblatts und ein Fichtenzweig"),
    (r"^powdered corn extract and a twisted loop of parchment\.?$",
     r"pulverisiertes Maisextrakt und eine verdrehte Pergamentschlaufe"),
    (r"^a dash of talc and a small amount of silver powder\.?$",
     r"eine Prise Talkum und etwas Silberpulver"),
    (r"^a burst of mica\.?$", r"etwas Glimmer"),
    (r"^a drop of bitumen and a spider\.?$", r"ein Tropfen Bitumen und eine Spinne"),
    (r"^a white feather or the heart of a hen\.?$", r"eine weiße Feder oder ein Hühnerherz"),
    (r"^a wing feather from any bird\.?$", r"eine Schwungfeder eines beliebigen Vogels"),
    (r"^a shaving of licorice root\.?$", r"eine Raspel Süßholzwurzel"),
    (r"^a glowing stick of incense or a crystal vial filled with phosphorescent material\.?$",
     r"ein glühendes Räucherstäbchen oder eine Kristallphiole mit phosphoreszierendem Material"),
    (r"^a bit of fur and a rod of amber,? crystal,? or glass\.?$",
     r"etwas Fell und ein Stab aus Bernstein, Kristall oder Glas"),
    (r"^a short piece of fine copper wire\.?$", r"ein kurzes Stück feiner Kupferdraht"),
    (r"^a pinch of dust and a few drops of water\.?$", r"eine Prise Staub und ein paar Tropfen Wasser"),
    (r"^a rotten egg or several skunk cabbage leaves\.?$",
     r"ein faules Ei oder mehrere Stinkkohlblätter"),
    (r"^a short piece of reed or straw\.?$", r"ein kurzes Stück Schilf oder Stroh"),
    (r"^a bit of bat fur\.?$", r"etwas Fledermausfell"),
    (r"^a leather strap,? bound around the arm or a similar appendage\.?$",
     r"ein Lederriemen, um den Arm oder ein ähnliches Glied gebunden"),
    (r"^a lodestone and a pinch of dust\.?$", r"ein Magnetstein und eine Prise Staub"),
    (r"^a little phosphorus or a firefly\.?$", r"etwas Phosphor oder ein Glühwürmchen"),
    (r"^a few grains of sugar,? some kernels of grain,? and a smear of fat\.?$",
     r"einige Zuckerkörner, einige Getreidekörner und ein Fettfleck"),
    (r"^a hemispherical piece of clear crystal and a matching hemispherical piece of gum arabic\.?$",
     r"ein halbkugelförmiges Stück klaren Kristalls und ein passendes Stück Gummiarabikum"),
    (r"^holy water or powdered silver and iron,? which the spell consumes\.?$",
     r"Weihwasser oder pulverisiertes Silber und Eisen, die der Zauber verbraucht"),
    (r"^a tiny ball of bat guano and sulfur\.?$",
     r"eine winzige Kugel aus Fledermausguano und Schwefel"),
    (r"^a bit of gauze and a wisp of smoke\.?$", r"ein Stück Gaze und ein Rauchwölkchen"),
    (r"^a bit of fleece\.?$", r"ein Stück Vlies"),
    (r"^a bit of phosphorus\.?$", r"etwas Phosphor"),
    (r"^a bit of spiderweb\.?$", r"etwas Spinnwebe"),
    (r"^a bit of pork rind or butter\.?$", r"etwas Schweineschwarte oder Butter"),
    (r"^a bit of fur from a bloodhound\.?$", r"etwas Fell eines Bluthundes"),
    (r"^a bit of fur wrapped in cloth\.?$", r"etwas in Tuch gewickeltes Fell"),
    (r"^a pinch of powdered iron or iron filings\.?$", r"eine Prise Eisenpulver oder Eisenspäne"),
    (r"^a pinch of dirt\.?$", r"eine Prise Erde"),
    (r"^a drop of blood\.?$", r"ein Tropfen Blut"),
    (r"^a drop of water\.?$", r"ein Tropfen Wasser"),
    (r"^a drop of molasses\.?$", r"ein Tropfen Melasse"),
    (r"^a firefly or phosphorescent moss\.?$", r"ein Glühwürmchen oder phosphoreszierendes Moos"),
    (r"^a short,? straight piece of iron\.?$", r"ein kurzes, gerades Eisenstück"),
    (r"^a lodestone and iron filings\.?$", r"ein Magnetstein und Eisenspäne"),
    (r"^two lodestones\.?$", r"zwei Magnetsteine"),
    (r"^a copper wire\.?$", r"ein Kupferdraht"),
    (r"^a tiny bell and a piece of very fine silver wire\.?$",
     r"eine winzige Glocke und ein sehr feiner Silberdraht"),
    (r"^a small crystal sphere\.?$", r"eine kleine Kristallkugel"),
    (r"^a small silver mirror\.?$", r"ein kleiner Silberspiegel"),
    (r"^a small clay model of a ziggurat\.?$", r"ein kleines Lehmmodell einer Ziggurat"),
    (r"^a handful of oak bark\.?$", r"eine Handvoll Eichenrinde"),
    (r"^a handful of clay,? rock,? sand,? or dirt\.?$",
     r"eine Handvoll Lehm, Gestein, Sand oder Erde"),
    (r"^a mistletoe sprig\.?$", r"ein Mistelzweig"),
    (r"^mistletoe\.?$", r"Mistelzweig"),
    (r"^a holy symbol\.?$", r"ein heiliges Symbol"),
    (r"^holy water\.?$", r"Weihwasser"),
    (r"^honeycomb\.?$", r"Honigwabe"),
    (r"^a crystal or glass cone\.?$", r"ein Kristall- oder Glaskegel"),
    (r"^a piece of cured leather\.?$", r"ein Stück gegerbtes Leder"),
    (r"^a piece of iron\.?$", r"ein Eisenstück"),
    (r"^a piece of string and a bit of wood\.?$", r"ein Stück Schnur und ein Stück Holz"),
    (r"^a piece of ice or a small white rock chip\.?$",
     r"ein Stück Eis oder ein kleiner weißer Steinsplitter"),
    (r"^a burning incense\.?$", r"brennender Weihrauch"),
    (r"^an owl or hawk feather\.?$", r"eine Eulen- oder Habichtfeder"),
    (r"^a feather\.?$", r"eine Feder"),
    (r"^a white feather\.?$", r"eine weiße Feder"),
    (r"^a snake's tongue and either a bit of honeycomb or a drop of sweet oil\.?$",
     r"eine Schlangenzunge und entweder etwas Honigwabe oder ein Tropfen süßes Öl"),
    (r"^a sesame seed\.?$", r"ein Sesamsamen"),
    (r"^a rose petal\.?$", r"ein Rosenblatt"),
    (r"^a sprig of mistletoe\.?$", r"ein Mistelzweig"),
    (r"^a sprig of holly\.?$", r"ein Stechpalmenzweig"),
    (r"^a yew leaf\.?$", r"ein Eibenblatt"),
    (r"^a caterpillar cocoon\.?$", r"ein Raupenkokon"),
    (r"^a diamond\.?$", r"ein Diamant"),
    (r"^a ruby\.?$", r"ein Rubin"),
    (r"^a pearl\.?$", r"eine Perle"),
    (r"^an agate\.?$", r"ein Achat"),
    (r"^a moonstone\.?$", r"ein Mondstein"),
    (r"^a tiny strip of white cloth\.?$", r"ein winziger Streifen weißes Tuch"),
    (r"^a tiny tart and a feather that is waved in the air\.?$",
     r"eine winzige Torte und eine in der Luft geschwenkte Feder"),
    (r"^a miniature cloak\.?$", r"ein Miniaturumhang"),
    (r"^a miniature platinum sword with a grip and pommel of copper and zinc,? worth (\d[\d,]*)\s*gp\.?$",
     r"ein Miniatur-Platinschwert mit Griff und Knauf aus Kupfer und Zink im Wert von \1 KM"),
    (r"^a vial of blood from a humanoid killed within the past 24 hours\.?$",
     r"eine Phiole Blut eines Humanoiden, der in den letzten 24 Stunden getötet wurde"),
    (r"^a vial of holy water\.?$", r"eine Phiole Weihwasser"),
    (r"^a heart of a hen\.?$", r"ein Hühnerherz"),
    (r"^a chicken egg\.?$", r"ein Hühnerei"),
    (r"^an eggshell and a snakeskin glove\.?$", r"eine Eierschale und ein Schlangenhaut-Handschuh"),
    (r"^a clay pot filled with grave dirt\.?$", r"ein Tontopf mit Friedhofserde"),
    (r"^a clay model of a skull\.?$", r"ein Lehmmodell eines Schädels"),
    (r"^a glass eye\.?$", r"ein Glasauge"),
    (r"^a glass or crystal bead\.?$", r"eine Glas- oder Kristallperle"),
    (r"^a magnifying glass\.?$", r"eine Lupe"),
    (r"^a pair of dice\.?$", r"ein Würfelpaar"),
    (r"^a musical instrument\.?$", r"ein Musikinstrument"),
    (r"^a wooden flute\.?$", r"eine Holzflöte"),
    (r"^a silver whistle\.?$", r"eine Silberpfeife"),
    (r"^a brass key\.?$", r"ein Messingschlüssel"),
    (r"^a tiny silver spoon\.?$", r"ein winziger Silberlöffel"),
    (r"^a tiny silver bell\.?$", r"eine winzige Silberglocke"),
    (r"^a tiny bag and a candle\.?$", r"ein winziger Beutel und eine Kerze"),
    (r"^a soft clay sculpture of the target\.?$", r"eine weiche Lehmskulptur des Ziels"),
    (r"^a soft clay doll\.?$", r"eine weiche Lehmpuppe"),
    (r"^a small leather or cloth doll\.?$", r"eine kleine Leder- oder Stoffpuppe"),
    (r"^a small knife\.?$", r"ein kleines Messer"),
    (r"^a small wax figurine\.?$", r"eine kleine Wachsfigur"),
    (r"^a small amount of manure\.?$", r"eine kleine Menge Mist"),
    (r"^a small piece of phosphorus\.?$", r"ein kleines Stück Phosphor"),
    (r"^a small crystal or glass cone\.?$", r"ein kleiner Kristall- oder Glaskegel"),
    (r"^a small iron rod\.?$", r"eine kleine Eisenstange"),
    (r"^a small mirror\.?$", r"ein kleiner Spiegel"),
    (r"^a drop of blood,? a piece of flesh,? and a pinch of bone dust\.?$",
     r"ein Tropfen Blut, ein Stück Fleisch und eine Prise Knochenstaub"),
    (r"^a pinch of salt and one copper piece placed on each of the corpse's eyes,? which must remain there for the duration\.?$",
     r"eine Prise Salz und je ein Kupferstück auf den Augen der Leiche, die für die Dauer dort bleiben müssen"),
    (r"^a weapon with which you are proficient that costs at least 1 gp\.?$",
     r"eine Waffe, mit der du geübt bist und die mindestens 1 KM wert ist"),
    (r"^worth at least ([\d,]+)\s*gp$", r"im Wert von mindestens \1 KM"),
]


def slug_to_key(slug: str) -> str:
    return slug.replace("-", "_")


def translate_en(material: str) -> str:
    s = material.strip()
    if not s:
        return s
    # Normalize whitespace / trailing period variants for matching
    for pat, repl in PHRASES:
        m = re.fullmatch(pat, s, flags=re.I)
        if m:
            out = m.expand(repl)
            out = out.replace(",", "") if False else out
            # keep thousand commas as in SRD numbers → strip commas in numbers
            out = re.sub(r"(\d),(\d{3})", r"\1\2", out)
            return out
    # Generic fallbacks (still full-string oriented)
    out = s
    out = re.sub(r"\bwhich the spell consumes\b", "die der Zauber verbraucht", out, flags=re.I)
    out = re.sub(r"\bworth at least ([\d,]+)\s*gp\b", r"im Wert von mindestens \1 KM", out, flags=re.I)
    out = re.sub(r"\bworth ([\d,]+)\s*gp\b", r"im Wert von \1 KM", out, flags=re.I)
    out = re.sub(r"(\d),(\d{3})", r"\1\2", out)
    return out


def load_materials_by_key() -> dict[str, str]:
    by_key: dict[str, str] = {}
    for path in sorted(SRC.glob("level-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data:
            mat = item.get("material") or ""
            if not mat:
                continue
            key = slug_to_key(item["slug"])
            by_key[key] = translate_en(mat)
    return by_key


def looks_english(s: str) -> bool:
    return bool(
        re.search(
            r"\b(a|an|the|of|worth|gp|which|spell|consumes|from|with|piece|powder|"
            r"dust|feather|fur|bit|pinch|drop|small|tiny|holy|water|focus|crystal|"
            r"diamond|ruby|pearl|incense|bat|guano|sulfur|leather|wire|ring)\b",
            s,
            re.I,
        )
    )


def patch_file(path: Path, by_key: dict[str, str]) -> tuple[int, list[str]]:
    text = path.read_text(encoding="utf-8")
    updated = 0
    remaining: list[str] = []

    def repl(match: re.Match[str]) -> str:
        nonlocal updated
        key = match.group(1)
        block = match.group(0)
        if key not in by_key:
            # keep; check material still English
            m = re.search(r'material: "([^"]*)"', block)
            if m and m.group(1) and looks_english(m.group(1)):
                remaining.append(f"{path.name}:{key}: {m.group(1)}")
            return block
        de = by_key[key]
        new_block, n = re.subn(
            r'material: (?:"[^"]*"|null)',
            f"material: {json.dumps(de, ensure_ascii=False)}",
            block,
            count=1,
        )
        if n:
            updated += 1
        if looks_english(de):
            remaining.append(f"{path.name}:{key}: {de}")
        return new_block

    # Match each spell object starting at key:
    pattern = re.compile(
        r"\{\s*\n\s*key: \"([^\"]+)\",[^\]]*?\n\s*\},",
        re.S,
    )
    # The above may fail on nested braces. Use simpler key-then-material within ~800 chars.
    pattern = re.compile(
        r'(key: "([^"]+)",(?:(?!key: ).){0,1200}?material: (?:null|"[^"]*"))',
        re.S,
    )

    def repl2(match: re.Match[str]) -> str:
        nonlocal updated
        full = match.group(1)
        key = match.group(2)
        if key not in by_key:
            m = re.search(r'material: "([^"]*)"', full)
            if m and m.group(1) and looks_english(m.group(1)):
                remaining.append(f"{path.name}:{key}: {m.group(1)}")
            return full
        de = by_key[key]
        new_full, n = re.subn(
            r'material: (?:null|"[^"]*")',
            f"material: {json.dumps(de, ensure_ascii=False)}",
            full,
            count=1,
        )
        if n:
            updated += 1
        if looks_english(de):
            remaining.append(f"{path.name}:{key}: {de}")
        return new_full

    new_text, _ = pattern.subn(repl2, text)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
    return updated, remaining


def main() -> None:
    by_key = load_materials_by_key()
    print(f"materials_from_json={len(by_key)}")
    total = 0
    remain: list[str] = []
    for path in sorted(CONTENT.glob("spells*.ts")):
        # Only patch L2+ from JSON; L0/L1 already curated DE in repo
        if path.name in {"spells-cantrips.ts", "spells-level1-a-f.ts", "spells-level1-g-z.ts"}:
            continue
        if path.name in {"spells-level2.ts", "spells-level3.ts", "spells-level4.ts",
                         "spells-level5.ts", "spells-level6.ts"}:
            # barrel re-exports only
            continue
        n, rem = patch_file(path, by_key)
        total += n
        remain.extend(rem)
        print(f"  {path.name}: {n}")
    print(f"updated={total} remaining_englishish={len(remain)}")
    for line in remain[:50]:
        print(" -", line)


if __name__ == "__main__":
    main()
