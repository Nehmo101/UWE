#!/usr/bin/env python3
"""Translate English SRD material components in spell TS files to German."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "packages" / "character-creator" / "src" / "content"

# Phrase-level replacements (longest first). Keep gp as KM (already used in DE catalog).
PHRASE_MAP: list[tuple[str, str]] = [
    (r"\ba diamond worth at least (\d+) gp\b", r"ein Diamant im Wert von mindestens \1 KM"),
    (r"\ba diamond worth (\d+) gp\b", r"ein Diamant im Wert von \1 KM"),
    (r"\bjewelry worth at least (\d+) gp\b", r"Schmuck im Wert von mindestens \1 KM"),
    (r"\bjewelry worth (\d+) gp\b", r"Schmuck im Wert von \1 KM"),
    (r"\bruby dust worth at least (\d+) gp\b", r"Rubinpulver im Wert von mindestens \1 KM"),
    (r"\bruby dust worth (\d+) gp\b", r"Rubinpulver im Wert von \1 KM"),
    (r"\ba powdered diamond worth at least (\d+) gp\b", r"Diamantpulver im Wert von mindestens \1 KM"),
    (r"\ba powdered diamond worth (\d+) gp\b", r"Diamantpulver im Wert von \1 KM"),
    (r"\bdiamond dust worth at least (\d+) gp\b", r"Diamantstaub im Wert von mindestens \1 KM"),
    (r"\bdiamond dust worth (\d+) gp\b", r"Diamantstaub im Wert von \1 KM"),
    (r"\ba pearl worth at least (\d+) gp\b", r"eine Perle im Wert von mindestens \1 KM"),
    (r"\ba pearl worth (\d+) gp\b", r"eine Perle im Wert von \1 KM"),
    (r"\ban ornate stone worth at least (\d+) gp\b", r"ein verzierter Stein im Wert von mindestens \1 KM"),
    (r"\ba jade circlet worth at least (\d+) gp\b", r"ein Jadering im Wert von mindestens \1 KM"),
    (r"\ba jewel-encrusted egg worth at least (\d+) gp\b", r"ein juwelenbesetztes Ei im Wert von mindestens \1 KM"),
    (r"\ba forked metal rod worth at least (\d+) gp\b", r"eine gegabelte Metallstange im Wert von mindestens \1 KM"),
    (r"\ba platinum ring worth at least (\d+) gp\b", r"ein Platinring im Wert von mindestens \1 KM"),
    (r"\ba silver rod worth at least (\d+) gp\b", r"eine Silberstange im Wert von mindestens \1 KM"),
    (r"\ba ruby of the spell's level worth at least (\d+) gp\b", r"ein Rubin der Zauberstufe im Wert von mindestens \1 KM"),
    (r"\bhoney and powdered silver worth at least (\d+) gp,? which the spell consumes\b",
     r"Honig und Silberpulver im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"\bincense and a sacrificial offering appropriate to your religion,? worth at least (\d+) gp,? which the spell consumes\b",
     r"Weihrauch und ein Opfergabe passend zu deiner Religion im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"\brare incense and powdered diamond worth at least (\d+) gp,? which the spell consumes\b",
     r"seltener Weihrauch und Diamantpulver im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"\ba bit of gauze and a wisp of smoke\b", "ein Stück Gaze und ein Rauchwölkchen"),
    (r"\ba bit of bat fur and a piece of amber, crystal, or glass\b",
     "etwas Fledermausfell und ein Stück Bernstein, Kristall oder Glas"),
    (r"\ba bit of fleece\b", "ein Stück Vlies"),
    (r"\ba bit of phosphorus\b", "etwas Phosphor"),
    (r"\ba bit of spiderweb\b", "etwas Spinnwebe"),
    (r"\ba bit of pork rind or butter\b", "etwas Schweineschwarte oder Butter"),
    (r"\ba bit of fur from a bloodhound\b", "etwas Fell eines Bluthundes"),
    (r"\ba bit of fur wrapped in cloth\b", "etwas in Tuch gewickeltes Fell"),
    (r"\ba pinch of powdered iron or iron filings\b", "eine Prise Eisenpulver oder Eisenspäne"),
    (r"\ba pinch of dirt\b", "eine Prise Erde"),
    (r"\ba pinch of salt and one copper piece placed on each of the corpse's eyes,? which must remain there for the duration\b",
     "eine Prise Salz und je ein Kupferstück auf den Augen der Leiche, die für die Dauer dort bleiben müssen"),
    (r"\ba drop of blood,? a piece of flesh,? and a pinch of bone dust\b",
     "ein Tropfen Blut, ein Stück Fleisch und eine Prise Knochenstaub"),
    (r"\ba drop of blood\b", "ein Tropfen Blut"),
    (r"\ba drop of water\b", "ein Tropfen Wasser"),
    (r"\ba drop of molasses\b", "ein Tropfen Melasse"),
    (r"\ba firefly or phosphorescent moss\b", "ein Glühwürmchen oder phosphoreszierendes Moos"),
    (r"\ba short,? straight piece of iron\b", "ein kurzes, gerades Eisenstück"),
    (r"\ba lodestone and iron filings\b", "ein Magnetstein und Eisenspäne"),
    (r"\btwo lodestones\b", "zwei Magnetsteine"),
    (r"\ba copper wire\b", "ein Kupferdraht"),
    (r"\ba tiny bell and a piece of very fine silver wire\b", "eine winzige Glocke und ein sehr feiner Silberdraht"),
    (r"\ba small crystal sphere\b", "eine kleine Kristallkugel"),
    (r"\ba small silver mirror\b", "ein kleiner Silberspiegel"),
    (r"\ba small clay model of a ziggurat\b", "ein kleines Lehmmodell einer Ziggurat"),
    (r"\ba small,? straight piece of iron\b", "ein kleines, gerades Eisenstück"),
    (r"\ba handful of oak bark\b", "eine Handvoll Eichenrinde"),
    (r"\ba handful of clay,? rock,? sand,? or dirt\b", "eine Handvoll Lehm, Gestein, Sand oder Erde"),
    (r"\ba mistletoe sprig\b", "ein Mistelzweig"),
    (r"\bmistletoe\b", "Mistelzweig"),
    (r"\ba holy symbol\b", "ein heiliges Symbol"),
    (r"\ba holy water\b", "Weihwasser"),
    (r"\bholy water or powdered silver and iron,? which the spell consumes\b",
     "Weihwasser oder pulverisiertes Silber und Eisen, die der Zauber verbraucht"),
    (r"\bholy water or powdered silver and iron\b", "Weihwasser oder pulverisiertes Silber und Eisen"),
    (r"\bhoneycomb\b", "Honigwabe"),
    (r"\ba crystal or glass cone\b", "ein Kristall- oder Glaskegel"),
    (r"\ba crystal vial filled with phosphorescent material\b", "eine Kristallphiole mit phosphoreszierendem Material"),
    (r"\ba piece of cured leather\b", "ein Stück gegerbtes Leder"),
    (r"\ba piece of iron\b", "ein Eisenstück"),
    (r"\ba piece of string and a bit of wood\b", "ein Stück Schnur und ein Stück Holz"),
    (r"\ba piece of ice or a small white rock chip\b", "ein Stück Eis oder ein kleiner weißer Steinsplitter"),
    (r"\ba burning incense\b", "brennender Weihrauch"),
    (r"\ba burning piece of incense\b", "ein brennendes Stück Weihrauch"),
    (r"\ban incense stick that must have a value of at least (\d+) gp\b",
     r"ein Räucherstäbchen im Wert von mindestens \1 KM"),
    (r"\ban owl or hawk feather\b", "eine Eulen- oder Habichtfeder"),
    (r"\ba feather\b", "eine Feder"),
    (r"\ba white feather\b", "eine weiße Feder"),
    (r"\ba hawk's feather\b", "eine Habichtfeder"),
    (r"\ba hummingbird feather\b", "eine Kolibrifeder"),
    (r"\ba cricket\b", "eine Grille"),
    (r"\ba grasshopper's hind leg\b", "ein Grashüpfer-Hinterbein"),
    (r"\ba live spider\b", "eine lebende Spinne"),
    (r"\ba snake's tongue and either a bit of honeycomb or a drop of sweet oil\b",
     "eine Schlangenzunge und entweder etwas Honigwabe oder ein Tropfen süßes Öl"),
    (r"\ba snake's tongue\b", "eine Schlangenzunge"),
    (r"\ba sesame seed\b", "ein Sesamsamen"),
    (r"\ba kernel of corn\b", "ein Maiskorn"),
    (r"\ba sunflower seed\b", "ein Sonnenblumenkern"),
    (r"\ba leaf of sumac\b", "ein Sumachblatt"),
    (r"\ba rose petal\b", "ein Rosenblatt"),
    (r"\ba sprig of mistletoe\b", "ein Mistelzweig"),
    (r"\ba sprig of holly\b", "ein Stechpalmenzweig"),
    (r"\ba yew leaf\b", "ein Eibenblatt"),
    (r"\ba caterpillar cocoon\b", "ein Raupenkokon"),
    (r"\ba powdered corn extract and a twisted loop of parchment\b",
     "ein pulverisiertes Maisextrakt und eine verdrehte Pergamentschlaufe"),
    (r"\ba powdered or crushed gemstone worth at least (\d+) gp\b",
     r"ein pulverisierter oder zerkleinerter Edelstein im Wert von mindestens \1 KM"),
    (r"\ba powdered diamond\b", "Diamantpulver"),
    (r"\ba diamond\b", "ein Diamant"),
    (r"\ba ruby\b", "ein Rubin"),
    (r"\ba pearl\b", "eine Perle"),
    (r"\ba black pearl worth at least (\d+) gp\b", r"eine schwarze Perle im Wert von mindestens \1 KM"),
    (r"\ban agate\b", "ein Achat"),
    (r"\ba citrine\b", "ein Citrin"),
    (r"\ba jacinth worth at least (\d+) gp\b", r"ein Hyazinth im Wert von mindestens \1 KM"),
    (r"\ba moonstone\b", "ein Mondstein"),
    (r"\ba star ruby worth (\d+) gp\b", r"ein Sternrubin im Wert von \1 KM"),
    (r"\ba tiny strip of white cloth\b", "ein winziger Streifen weißes Tuch"),
    (r"\ba tiny ball of bat guano and sulfur\b", "eine winzige Kugel aus Fledermausguano und Schwefel"),
    (r"\ba tiny tart and a feather that is waved in the air\b", "eine winzige Torte und eine in der Luft geschwenkte Feder"),
    (r"\ba miniature cloak\b", "ein Miniaturumhang"),
    (r"\ba miniature platinum sword with a grip and pommel of copper and zinc,? worth (\d+) gp\b",
     r"ein Miniatur-Platinschwert mit Griff und Knauf aus Kupfer und Zink im Wert von \1 KM"),
    (r"\ba miniature clay ziggurat\b", "eine Miniatur-Lehm-Ziggurat"),
    (r"\ba small bag containing a mixture of bat guano,? sulfur,? and powdered iron\b",
     "ein kleiner Beutel mit einer Mischung aus Fledermausguano, Schwefel und Eisenpulver"),
    (r"\ba vial of blood from a humanoid killed within the past 24 hours\b",
     "eine Phiole Blut eines Humanoiden, der in den letzten 24 Stunden getötet wurde"),
    (r"\ba vial of holy water\b", "eine Phiole Weihwasser"),
    (r"\ba vial containing blood of a humanoid killed within the past 24 hours\b",
     "eine Phiole mit Blut eines Humanoiden, der in den letzten 24 Stunden getötet wurde"),
    (r"\ba heart of a hen\b", "ein Hühnerherz"),
    (r"\ba chicken egg\b", "ein Hühnerei"),
    (r"\ban eggshell and a snakeskin glove\b", "eine Eierschale und ein Schlangenhaut-Handschuh"),
    (r"\ba snakeskin glove\b", "ein Schlangenhaut-Handschuh"),
    (r"\ban eggshell\b", "eine Eierschale"),
    (r"\ba clay pot filled with grave dirt\b", "ein Tontopf mit Friedhofserde"),
    (r"\ba clay model of a skull\b", "ein Lehmmodell eines Schädels"),
    (r"\ba clay pot of grave dirt\b", "ein Tontopf mit Friedhofserde"),
    (r"\ba glass eye\b", "ein Glasauge"),
    (r"\ba glass or crystal bead\b", "eine Glas- oder Kristallperle"),
    (r"\ba glass eye or a gum arabic\b", "ein Glasauge oder Gummiarabikum"),
    (r"\bgum arabic\b", "Gummiarabikum"),
    (r"\ba magnifying glass\b", "eine Lupe"),
    (r"\ba pair of dice\b", "ein Würfelpaar"),
    (r"\ba set of tailor's tools\b", "ein Schneiderwerkzeug-Set"),
    (r"\ba writing quill crafted from a gold feather worth at least (\d+) gp\b",
     r"eine Schreibfeder aus einer Goldfeder im Wert von mindestens \1 KM"),
    (r"\ba platinum ring worth at least (\d+) gp,? which you must wear for the duration\b",
     r"ein Platinring im Wert von mindestens \1 KM, den du für die Dauer tragen musst"),
    (r"\ba lead-based ink worth at least (\d+) gp,? which the spell consumes\b",
     r"eine bleihaltige Tinte im Wert von mindestens \1 KM, die der Zauber verbraucht"),
    (r"\ba lead lining worth at least (\d+) gp\b", r"eine Bleiauskleidung im Wert von mindestens \1 KM"),
    (r"\ba focus worth at least (\d+) gp,? either a jeweled horn for summoning elementals of air or earth or an incense burner for summoning elementals of fire or water\b",
     r"ein Fokus im Wert von mindestens \1 KM — entweder ein juwelenbesetztes Horn (Luft/Erde) oder ein Räuchergefäß (Feuer/Wasser)"),
    (r"\ba focus,? either a jeweled horn for summoning elemental air or earth or incense for summoning elemental fire or water,? worth at least (\d+) gp\b",
     r"ein Fokus — juwelenbesetztes Horn (Luft/Erde) oder Weihrauch (Feuer/Wasser) — im Wert von mindestens \1 KM"),
    (r"\ban ornate stone,? gem,? or crystal staff worth at least (\d+) gp\b",
     r"ein verzierter Stab aus Stein, Edelstein oder Kristall im Wert von mindestens \1 KM"),
    (r"\ba spellcasting focus of the appropriate type\b", "ein Zauberfokus des passenden Typs"),
    (r"\ba spellcasting focus\b", "ein Zauberfokus"),
    (r"\ba musical instrument\b", "ein Musikinstrument"),
    (r"\ba wooden flute\b", "eine Holzflöte"),
    (r"\ba silver whistle\b", "eine Silberpfeife"),
    (r"\ba brass key\b", "ein Messingschlüssel"),
    (r"\ba tiny silver spoon\b", "ein winziger Silberlöffel"),
    (r"\ba tiny silver bell\b", "eine winzige Silberglocke"),
    (r"\ba tiny silver cage\b", "ein winziger Silberkäfig"),
    (r"\ba tiny silver mirror\b", "ein winziger Silberspiegel"),
    (r"\ba tiny bag and a candle\b", "ein winziger Beutel und eine Kerze"),
    (r"\ba tiny replica of a humanoid skull\b", "eine winzige Nachbildung eines Humanoidenschädels"),
    (r"\ba lump of alum impregnated with soot\b", "ein Stück mit Ruß getränktes Alaun"),
    (r"\ba lump of iron\b", "ein Eisenklumpen"),
    (r"\ba soft,? black lump of clay\b", "ein weicher, schwarzer Lehmklumpen"),
    (r"\ba soft clay sculpture of the target\b", "eine weiche Lehmskulptur des Ziels"),
    (r"\ba soft clay replica of the target\b", "eine weiche Lehmnachbildung des Ziels"),
    (r"\ba soft clay doll\b", "eine weiche Lehmpuppe"),
    (r"\ba small leather or cloth doll\b", "eine kleine Leder- oder Stoffpuppe"),
    (r"\ba small leather loop\b", "eine kleine Lederschlaufe"),
    (r"\ba small knife\b", "ein kleines Messer"),
    (r"\ba small silver spoon\b", "ein kleiner Silberlöffel"),
    (r"\ba small wax figurine\b", "eine kleine Wachsfigur"),
    (r"\ba small clay pot\b", "ein kleiner Tontopf"),
    (r"\ba small amount of manure\b", "eine kleine Menge Mist"),
    (r"\ba small piece of phosphorus\b", "ein kleines Stück Phosphor"),
    (r"\ba small crystal or glass cone\b", "ein kleiner Kristall- oder Glaskegel"),
    (r"\ba small piece of cork\b", "ein kleines Stück Kork"),
    (r"\ba small iron rod\b", "eine kleine Eisenstange"),
    (r"\ba small iron bar\b", "ein kleiner Eisenstab"),
    (r"\ba small, straight piece of iron\b", "ein kleines, gerades Eisenstück"),
    (r"\ba small cloth and a bit of wood\b", "ein kleines Tuch und ein Stück Holz"),
    (r"\ba small bag of bat guano\b", "ein kleiner Beutel Fledermausguano"),
    (r"\ba small clay figurine\b", "eine kleine Lehmfigur"),
    (r"\ba small mirror\b", "ein kleiner Spiegel"),
    (r"\ba small parchment\b", "ein kleines Pergament"),
    (r"\ba small ceramic or stone disc\b", "eine kleine Keramik- oder Steinscheibe"),
    (r"\ba small piece of flesh\b", "ein kleines Stück Fleisch"),
    (r"\ba small piece of wood\b", "ein kleines Stück Holz"),
    (r"\ba small lump of clay\b", "ein kleiner Lehmklumpen"),
    (r"\ba small piece of bone\b", "ein kleines Stück Knochen"),
    (r"\ba small piece of quartz\b", "ein kleines Stück Quarz"),
    (r"\ba small piece of amber\b", "ein kleines Stück Bernstein"),
    (r"\ba small piece of sulfur\b", "ein kleines Stück Schwefel"),
    (r"\ba small piece of ice\b", "ein kleines Stück Eis"),
    (r"\ba small piece of rubber\b", "ein kleines Stück Gummi"),
    (r"\ba small piece of chalk\b", "ein kleines Stück Kreide"),
    (r"\ba small piece of glass\b", "ein kleines Stück Glas"),
    (r"\ba small piece of fur\b", "ein kleines Stück Fell"),
    (r"\ba small piece of silk\b", "ein kleines Stück Seide"),
    (r"\ba small piece of cotton\b", "ein kleines Stück Baumwolle"),
    (r"\ba small piece of parchment\b", "ein kleines Stück Pergament"),
    (r"\ba small piece of metal\b", "ein kleines Stück Metall"),
    (r"\ba small piece of leather\b", "ein kleines Stück Leder"),
    (r"\ba small piece of cloth\b", "ein kleines Stück Stoff"),
    (r"\ba small piece of paper\b", "ein kleines Stück Papier"),
    (r"\ba small piece of stone\b", "ein kleines Stück Stein"),
    (r"\ba small piece of dirt\b", "ein kleines Stück Erde"),
    (r"\ba small piece of coal\b", "ein kleines Stück Kohle"),
    (r"\ba small piece of charcoal\b", "ein kleines Stück Holzkohle"),
    (r"\ba small piece of ash\b", "ein kleines Stück Asche"),
    (r"\ba small piece of dust\b", "ein kleines Stück Staub"),
    (r"\ba small piece of powder\b", "ein kleines Stück Pulver"),
    (r"\ba small piece of salt\b", "ein kleines Stück Salz"),
    (r"\ba small piece of sugar\b", "ein kleines Stück Zucker"),
    (r"\ba small piece of honey\b", "ein kleines Stück Honig"),
    (r"\ba small piece of wax\b", "ein kleines Stück Wachs"),
    (r"\ba small piece of resin\b", "ein kleines Stück Harz"),
    (r"\ba small piece of gum\b", "ein kleines Stück Gummi"),
    (r"\ba small piece of tar\b", "ein kleines Stück Teer"),
    (r"\ba small piece of pitch\b", "ein kleines Stück Pech"),
    (r"\ba small piece of oil\b", "ein kleines Stück Öl"),
    (r"\ba small piece of grease\b", "ein kleines Stück Fett"),
    (r"\ba small piece of fat\b", "ein kleines Stück Fett"),
    (r"\ba small piece of tallow\b", "ein kleines Stück Talg"),
    (r"\ba small piece of soap\b", "ein kleines Stück Seife"),
    (r"\ba small piece of perfume\b", "ein kleines Stück Parfüm"),
    (r"\ba small piece of incense\b", "ein kleines Stück Weihrauch"),
    (r"\ba small piece of myrrh\b", "ein kleines Stück Myrrhe"),
    (r"\ba small piece of frankincense\b", "ein kleines Stück Weihrauch"),
    (r"\ba small piece of balsam\b", "ein kleines Stück Balsam"),
    (r"\ba small piece of ambergris\b", "ein kleines Stück Ambra"),
    (r"\ba small piece of musk\b", "ein kleines Stück Moschus"),
    (r"\ba small piece of civet\b", "ein kleines Stück Zibet"),
    (r"\ba small piece of castoreum\b", "ein kleines Stück Castoreum"),
    (r"\ba weapon with which you are proficient that costs at least 1 gp\b",
     "eine Waffe, mit der du geübt bist und die mindestens 1 KM wert ist"),
    (r"\ba melee weapon worth at least 1 sp\b", "eine Nahkampfwaffe im Wert von mindestens 1 SM"),
    (r"\ba ranged weapon worth at least 1 sp\b", "eine Fernkampfwaffe im Wert von mindestens 1 SM"),
    (r"\ban arrow or crossbow bolt\b", "ein Pfeil oder eine Armbrustbolzen"),
    (r"\ban arrow\b", "ein Pfeil"),
    (r"\ba crossbow bolt\b", "eine Armbrustbolzen"),
    (r"\bwhich the spell consumes\b", "die der Zauber verbraucht"),
    (r"\bwhich are consumed by the spell\b", "die der Zauber verbraucht"),
    (r"\bconsumed by the spell\b", "vom Zauber verbraucht"),
    (r"\bworth at least (\d+) gp\b", r"im Wert von mindestens \1 KM"),
    (r"\bworth (\d+) gp\b", r"im Wert von \1 KM"),
    (r"\bgold pieces?\b", "Goldstücke"),
    (r"\bsilver pieces?\b", "Silberstücke"),
    (r"\bcopper pieces?\b", "Kupferstücke"),
    (r"\b\bgp\b", "KM"),
]


WORD_MAP: list[tuple[str, str]] = [
    (r"\bbat guano\b", "Fledermausguano"),
    (r"\bsulfur\b", "Schwefel"),
    (r"\bsulphur\b", "Schwefel"),
    (r"\bincense\b", "Weihrauch"),
    (r"\bpowdered silver\b", "Silberpulver"),
    (r"\bpowdered iron\b", "Eisenpulver"),
    (r"\biron filings\b", "Eisenspäne"),
    (r"\blodestone\b", "Magnetstein"),
    (r"\bholy water\b", "Weihwasser"),
    (r"\bholy symbol\b", "heiliges Symbol"),
    (r"\bcrystal\b", "Kristall"),
    (r"\bamber\b", "Bernstein"),
    (r"\bglass\b", "Glas"),
    (r"\bfeather\b", "Feder"),
    (r"\bfleece\b", "Vlies"),
    (r"\bphosphorus\b", "Phosphor"),
    (r"\bmirror\b", "Spiegel"),
    (r"\bclay\b", "Lehm"),
    (r"\bdirt\b", "Erde"),
    (r"\bsand\b", "Sand"),
    (r"\bstone\b", "Stein"),
    (r"\bwood\b", "Holz"),
    (r"\bbone\b", "Knochen"),
    (r"\bblood\b", "Blut"),
    (r"\bhair\b", "Haar"),
    (r"\bfur\b", "Fell"),
    (r"\bleather\b", "Leder"),
    (r"\bsilk\b", "Seide"),
    (r"\bcloth\b", "Stoff"),
    (r"\bwire\b", "Draht"),
    (r"\bneedle\b", "Nadel"),
    (r"\bring\b", "Ring"),
    (r"\bcoin\b", "Münze"),
    (r"\bgem\b", "Edelstein"),
    (r"\bjewel\b", "Juwel"),
    (r"\bbell\b", "Glocke"),
    (r"\bflute\b", "Flöte"),
    (r"\bwine\b", "Wein"),
    (r"\bhoney\b", "Honig"),
    (r"\bsalt\b", "Salz"),
    (r"\boil\b", "Öl"),
    (r"\bash\b", "Asche"),
    (r"\bember\b", "Glut"),
    (r"\bcoal\b", "Kohle"),
    (r"\bflame\b", "Flamme"),
    (r"\bperfume\b", "Parfüm"),
    (r"\bherb\b", "Kraut"),
    (r"\broot\b", "Wurzel"),
    (r"\bseed\b", "Samen"),
    (r"\bflower\b", "Blume"),
    (r"\bpetal\b", "Blütenblatt"),
    (r"\bwing\b", "Flügel"),
    (r"\bscale\b", "Schuppe"),
    (r"\btooth\b", "Zahn"),
    (r"\bfang\b", "Fangzahn"),
    (r"\bclaw\b", "Klaue"),
    (r"\bhide\b", "Haut"),
    (r"\bstring\b", "Schnur"),
    (r"\bkey\b", "Schlüssel"),
    (r"\block\b", "Schloss"),
    (r"\bchain\b", "Kette"),
    (r"\borb\b", "Kugel"),
    (r"\brod\b", "Stab"),
    (r"\bwand\b", "Zauberstab"),
    (r"\bstaff\b", "Stab"),
    (r"\bfood\b", "Nahrung"),
    (r"\ba bit of\b", "etwas"),
    (r"\ba pinch of\b", "eine Prise"),
    (r"\ba drop of\b", "ein Tropfen"),
    (r"\ba handful of\b", "eine Handvoll"),
    (r"\ba piece of\b", "ein Stück"),
    (r"\ba small\b", "ein kleines"),
    (r"\ba tiny\b", "ein winziges"),
    (r"\ban\b", "ein"),
    (r"\bthe\b", "der"),
    (r"\bof\b", "von"),
    (r"\band\b", "und"),
    (r"\bor\b", "oder"),
]


def looks_english(s: str) -> bool:
    if re.search(r"[äöüÄÖÜß]", s):
        # Still may have English leftovers
        pass
    return bool(
        re.search(
            r"\b(a|an|the|of|worth|gp|piece|diamond|ruby|pearl|powder|bit|small|drop|"
            r"leaf|feather|crystal|holy|water|focus|consumes|copper|silver|gold|"
            r"bat|guano|sulfur|incense|cloth|silk|egg|shell|bone|hair|blood|iron|"
            r"lodestone|amber|jade|ivory|glass|mirror|bell|flute|food|wine|honey|"
            r"salt|dirt|earth|clay|sand|stone|twig|wood|ash|oil|herb|seed|flower|"
            r"wing|scale|tooth|fang|claw|fur|hide|leather|string|wire|needle|key|"
            r"chain|ring|coin|gem|jewel|orb|rod|wand|staff|which|spell|consumes)\b",
            s,
            re.I,
        )
    )


def translate_material(s: str) -> str:
    out = s
    for pat, repl in PHRASE_MAP:
        out = re.sub(pat, repl, out, flags=re.I)
    # Only apply word map if still English-looking
    if looks_english(out):
        for pat, repl in WORD_MAP:
            out = re.sub(pat, repl, out, flags=re.I)
    # Cleanup double spaces / leftover articles
    out = re.sub(r"\s+", " ", out).strip()
    out = out.replace("ein ein ", "ein ").replace("eine eine ", "eine ")
    return out


def main() -> None:
    changed_files = 0
    changed_mats = 0
    remaining: list[str] = []
    for path in sorted(CONTENT.glob("spells*.ts")):
        text = path.read_text(encoding="utf-8")
        new_parts: list[str] = []
        last = 0
        file_changed = False
        for m in re.finditer(r'material: "([^"]*)"', text):
            original = m.group(1)
            if not original:
                continue
            translated = translate_material(original)
            if translated != original:
                changed_mats += 1
                file_changed = True
                new_parts.append(text[last : m.start(1)])
                new_parts.append(translated)
                last = m.end(1)
            if looks_english(translated):
                remaining.append(f"{path.name}: {translated}")
        if file_changed:
            new_parts.append(text[last:])
            path.write_text("".join(new_parts), encoding="utf-8")
            changed_files += 1
        else:
            # still collect remaining from untouched
            for m in re.finditer(r'material: "([^"]+)"', text):
                if looks_english(m.group(1)):
                    remaining.append(f"{path.name}: {m.group(1)}")

    print(f"files={changed_files} materials_updated={changed_mats}")
    print(f"remaining_englishish={len(remaining)}")
    for line in remaining[:40]:
        print(" -", line)


if __name__ == "__main__":
    main()
