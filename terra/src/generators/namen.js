// Namens-Generator (J3): Namen aus Bestimmungs- und Grundwort, gewichtet nach
// der LAGE auf der Karte.
//
// Der Unterschied zu einem gewoehnlichen Silbenkompositor steckt in zwei
// Saetzen:
//
//   1. Ein Name besteht aus Bestimmungswort + Grundwort ("Aschen|furt",
//      "Stein|bach", "Nord|mark"). Er ist damit LESBAR MOTIVIERT und nicht nur
//      klangvoll — man kann ihn uebersetzen.
//   2. Das Grundwort waehlt nicht der Zufall allein, sondern die Lage. Der
//      Generator misst am Ort: Wassernaehe, Buchtanteil, Hangneigung, Hoehe,
//      Sattel, Moor, Naehe zu Fluss, Strasse, Bruchkante, Wald, Acker und
//      Arbor-Ranke — und macht daraus Gewichte fuer die Grundwoerter. An einer
//      Flussquerung gewinnt "-furt", am Ufer "-hafen", auf dem Sattel
//      "-scharte", im Moor "-bruch", an der Bruchkante "-riss", unter einer
//      Ranke die altertuemliche Wortgruppe. Ein Fischerdorf heisst deshalb
//      nicht "Steinhalde".
//
// Sechs Sprachfamilien: doerflich, klassisch, zwergisch, elfisch, Arbor-Kult
// und neutral. Jede mit eigener Wortwelt UND eigener Lautstruktur (Fugenregel,
// Endungen, Wortlaenge, Artikelformen) — die Regel steckt als `fuge`/`zier` im
// Familieneintrag, nicht in einer Sonderbehandlung im Ablauf.
//
// Die Karte traegt eine Sprachfamilie (S.sprachfamilie, "auto" = aus dem Biom).
// Orte erben sie; ein langwelliges Rauschen ueber der Karte laesst rund ein
// Achtel der Flaeche in eine NACHBARFAMILIE kippen — dadurch entstehen
// zusammenhaengende Sprachgrenzen statt gleichmaessig verteilter Fremdnamen.
//
// Determinismus: kein Math.random. Jeder Name haengt an
// (Weltseed, Elementseed, Rolle, Index, Versuch) ueber hashi/rngOf. Derselbe
// Seed ergibt denselben Namen — auch nach Neuladen, auch in anderer
// Reihenfolge. "Neu wuerfeln" an einem Element aendert dessen Seed und damit
// nur dessen Namen.
//
// Bewusst NICHT importiert: generators/paths.js (bruchMaskeAt). Die Maske
// zeigt waehrend des Weltgenerators noch die ALTE Karte — genau der Grund,
// aus dem welt.js eine eigene Belegung fuehrt. Die Bruchkanten-Naehe kommt
// deshalb aus der Elementliste (pfad:bruch), die in beiden Faellen stimmt:
// beim Erzeugen aus der wachsenden Liste des Generators, im Editor aus
// S.elements. Nebeneffekt: namen.js haengt nur an rng, store und terrain und
// laesst sich kopflos laden.

import { clamp, sstep, DEG, hashi, fractal, rngOf, ri } from '../core/rng.js';
// KARTE ist ein Laufzeitwert (H1b-Regel: nie beim Modulstart in eine eigene
// Konstante kopieren) — familieAn liest die Kantenlaenge bei jedem Aufruf.
import { S, KARTE, WATER } from '../core/store.js';
import { heightAt, slopeAt, inCorridor } from '../world/terrain.js';

var COS8 = Math.cos(8 * DEG), COS26 = Math.cos(26 * DEG);
var VOKALE = "aeiouäöüy";


/* ==========================================================================
   Wortlisten — Schreibweise

   Ein Eintrag ist ein String "wort|tags|genus":
     wort   Bestimmungswoerter in Fugenform und gross ("Aschen", "Wolfs"),
            Grundwoerter klein ("furt", "halde").
     tags   Komma-Liste der Lagen, zu denen das Wort passt (optional).
     genus  m | f | n | p  — nur bei Grundwoertern noetig, die in einer
            Artikelform auftauchen koennen ("Der Alte Lauf"). Default m.

   Die Kompaktschreibweise ist Absicht: die Listen sind lang, und in Spalten
   gesetzte Objektliterale waeren dreimal so hoch und halb so lesbar.
   ========================================================================== */

var LAGEN = ["furt", "fluss", "wasser", "hafen", "bucht", "pass", "berg", "fels",
  "moor", "bruch", "arbor", "wald", "ebene", "feld", "weg", "hoch", "kalt",
  "heiss", "neutral"];

/* Ausschliessende Lagen: ein Wort, dessen SAEMTLICHE Lagen hier stehen und
   am Ort alle nahe null sind, wird stark gedaempft. Das ist die Regel, die
   "Salzhafen" im Hochgebirge und "Steinhalde" am Strand verhindert. `fluss`,
   `wald`, `ebene`, `feld`, `weg` und `neutral` fehlen bewusst — ein Bach, ein
   Hain oder ein Grund passen ueberall hin. */
var AUSSCHLIESSEND = { furt: 1, hafen: 1, bucht: 1, wasser: 1, moor: 1, bruch: 1,
  pass: 1, arbor: 1, kalt: 1, heiss: 1, berg: 1, fels: 1, hoch: 1 };

function zerlege(eintrag) {
  var t = String(eintrag).split("|");
  var lagen = [];
  if (t[1]) {
    var roh = t[1].split(",");
    for (var i = 0; i < roh.length; i++) {
      var l = roh[i].trim();
      if (l) lagen.push(l);
    }
  }
  return { w: t[0], lagen: lagen, g: t[2] || "m" };
}

function liste(arr) {
  var out = [];
  for (var i = 0; i < arr.length; i++) out.push(zerlege(arr[i]));
  return out;
}


/* ==========================================================================
   Fugen — die Lautstruktur je Familie

   Deutsch: stumpfe Fuge, denn die Bestimmungswoerter stehen bereits in
   Fugenform ("Aschen", "Wolfs", "Königs"). Die einzige Regel greift gegen den
   DREIFACHEN Buchstaben: "Wall"+"loh" wird zu "Walloh", "Reiher"+"rücken"
   bleibt dagegen "Reiherrücken" (zwei r sind im Deutschen richtig, drei
   waeren es nicht). "Weiß"+"schmiede" bleibt "Weißschmiede" — ß und s sind
   verschiedene Buchstaben, hier darf nichts wegfallen.
   ========================================================================== */
function fugeDeutsch(a, b) {
  var ae = a.slice(-1), bs = b.charAt(0);
  if (ae === bs && (a.slice(-2, -1) === ae || b.charAt(1) === bs)) return a + b.slice(1);
  // Fugen-s trifft st/sp: eines faellt weg ("Schäfers"+"stedt" -> Schäferstedt).
  if (ae === "s" && bs === "s" && "tp".indexOf(b.charAt(1)) >= 0) return a + b.slice(1);
  return a + b;
}

/* Klassisch: griechische Kompositionsfuge. Der Stamm endet auf -o; trifft er
   auf einen Vokal, faellt das -o weg (Melano+ormos -> Melanormos). Trifft er
   auf einen Konsonanten, bleibt es (Chryso+limen -> Chrysolimen). */
function fugeKlassisch(a, b) {
  var bs = b.charAt(0).toLowerCase();
  if (a.slice(-1).toLowerCase() === "o" && VOKALE.indexOf(bs) >= 0) return a.slice(0, -1) + b;
  return a + b;
}

/* Elfisch: Vokalharmonie. Stossen drei oder mehr Konsonanten aufeinander,
   traegt der letzte Vokal des Bestimmungsworts den Bindevokal ein
   (a->a, e/i->i, o/u->o, sonst e). Gleicher Konsonant faellt weg. */
function fugeElfisch(a, b) {
  var ae = a.slice(-1).toLowerCase(), bs = b.charAt(0).toLowerCase();
  if (ae === bs && VOKALE.indexOf(ae) < 0) return a + b.slice(1);
  if (VOKALE.indexOf(ae) >= 0 || VOKALE.indexOf(bs) >= 0) return a + b;
  // zwei Konsonanten links, mindestens einer rechts -> Bindevokal
  var vorletzt = a.slice(-2, -1).toLowerCase();
  var zweitRechts = b.charAt(1).toLowerCase();
  if (VOKALE.indexOf(vorletzt) >= 0 && VOKALE.indexOf(zweitRechts) >= 0) return a + b;
  var letzterVokal = "";
  for (var i = a.length - 1; i >= 0; i--) {
    if (VOKALE.indexOf(a.charAt(i).toLowerCase()) >= 0) { letzterVokal = a.charAt(i).toLowerCase(); break; }
  }
  var bind = letzterVokal === "a" ? "a"
    : (letzterVokal === "e" || letzterVokal === "i") ? "i"
    : (letzterVokal === "o" || letzterVokal === "u") ? "o" : "e";
  return a + bind + b;
}

function gross(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Artikel und schwache Adjektivendung nach Genus. "Der Alte Lauf",
 *  "Die Stille Ader", "Das Graue Wasser", "Die Stillen Hoehen". */
function artikel(g) { return g === "f" ? "Die" : g === "n" ? "Das" : g === "p" ? "Die" : "Der"; }
function adjEndung(g) { return g === "p" ? "en" : "e"; }


/* ==========================================================================
   Die sechs Sprachfamilien
   ========================================================================== */

var FAMILIEN = {};

/* --------------------------------------------------------------------------
   1. Doerflich — bodenstaendiges Deutsch. Die Familie, die zum Baustil "dorf"
      gehoert: Bauernland, Fischerdoerfer, Waldhufen, Marken.
   -------------------------------------------------------------------------- */
FAMILIEN.dorf = {
  id: "dorf", label: "Dörflich", deutsch: true, fuge: fugeDeutsch,
  bestimmung: liste([
    // Farbe
    "Rot", "Schwarz", "Weiß", "Grün", "Grau", "Blau", "Braun", "Fahl", "Bleich", "Bunt",
    // Material
    "Stein", "Eisen", "Salz|wasser", "Lehm", "Kalk|fels", "Torf|moor", "Holz|wald",
    "Kupfer", "Sand|wasser", "Kies|fluss", "Aschen|heiss", "Schiefer|fels", "Pech",
    // Himmelsrichtung und Lage
    "Nord", "Süd", "Ost", "West", "Ober|hoch", "Nieder", "Mittel", "Hinter", "Vorder",
    // Tier
    "Krähen", "Wolfs", "Hirsch|wald", "Fuchs", "Reiher|moor", "Otter|fluss", "Biber|fluss",
    "Adler|berg", "Falken|berg", "Raben", "Storchen|moor", "Hasen|feld", "Ziegen|berg",
    "Bären|wald", "Eber|wald", "Kranich|moor", "Lachs|fluss", "Hecht|wasser", "Schwanen|wasser",
    "Möwen|wasser", "Igel", "Dachs",
    // Pflanze
    "Eichen|wald", "Buchen|wald", "Erlen|fluss", "Weiden|fluss", "Birken|wald", "Dorn",
    "Distel|ebene", "Hopfen|feld", "Nessel", "Farn|wald", "Ginster|ebene", "Holunder",
    "Binsen|moor", "Schilf|moor",
    // Person und Stand
    "Königs", "Bauern|feld", "Müllers|fluss", "Schmieds", "Fischers|wasser", "Hirten|ebene",
    "Pfaffen", "Grafen", "Mönchs", "Wächters|hoch", "Ritters", "Witwen", "Schäfers|ebene",
    // Zustand
    "Alt", "Neu", "Wild", "Still", "Kalt|kalt", "Nass|moor", "Dürr|heiss", "Trüb|moor",
    "Klar", "Sanft", "Rauh|berg", "Krumm", "Tief", "Hoch|hoch", "Weit|ebene", "Eng|pass",
    "Öd", "Dunkel", "Hell", "Fern", "Nebel", "Frost|kalt", "Sturm", "Wetter",
    "Winter|kalt", "Sommer", "Morgen", "Abend", "Mond", "Sonnen", "Sternen"
  ]),
  grund: liste([
    // Wasser und Querung
    "furt|furt,fluss|f", "brücke|furt,fluss,weg|f", "steg|wasser,fluss|m",
    "bach|fluss|m", "au|fluss,ebene|f", "werder|fluss,wasser|m", "mühlen|fluss|f",
    "hafen|hafen,wasser|m", "bucht|bucht,wasser|f", "strand|wasser|m",
    "watt|wasser,moor|n", "ufer|wasser|n", "born|wasser|m", "brunn|wasser|m",
    "wehr|fluss,weg|n", "damm|wasser,moor|m",
    // Moor
    "bruch|moor|m", "ried|moor|n", "fenn|moor|n", "lache|moor,wasser|f", "moos|moor|n",
    // Sattel und Berg
    "scharte|pass,berg|f", "pass|pass|m", "joch|pass,berg|n", "sattel|pass|m",
    "steig|pass,weg,berg|m", "klamm|pass,fels|f",
    "halde|berg,fels|f", "fels|fels,berg|m", "horst|berg,fels|m", "klippe|fels,wasser|f",
    "kuppe|berg|f", "grat|berg,hoch|m", "kar|berg,kalt|n", "firn|kalt,hoch|m",
    "warte|hoch,weg|f", "schanze|hoch,weg|f",
    // Bruchkante
    "riss|bruch|m", "abgrund|bruch|m", "kante|bruch|f", "sturz|bruch,fels|m",
    "schrunde|bruch|f",
    // Land, Siedlung, Arbeit
    "feste|neutral,berg|f", "mark|neutral,ebene|f", "grund|ebene,neutral|m",
    "tal|ebene,berg|n", "feld|feld,ebene|n", "acker|feld|m", "hof|feld,neutral|m",
    "weiler|neutral|m", "dorf|neutral|n", "heim|neutral|n", "hausen|neutral|n",
    "stedt|neutral|n", "eck|neutral|n", "rast|weg|f", "kreuz|weg|n",
    "schmiede|weg,neutral|f", "zoll|weg|m",
    // Wald
    "rod|wald|n", "hain|wald,arbor|m", "loh|wald,arbor|n", "forst|wald|m",
    "kamp|feld,wald|m", "brand|heiss,wald|m", "öde|ebene,heiss|f"
  ]),
  adjektive: ["Trüb", "Schnell", "Still", "Klar", "Kalt", "Wild", "Krumm", "Grau",
    "Schwarz", "Weiß", "Tief", "Breit", "Eng", "Rasch", "Sanft", "Träg", "Bitter",
    "Salzig", "Rot", "Braun", "Alt", "Stumm", "Blind", "Fahl", "Lang", "Kurz"],
  natur: {
    fluss: liste(["bach|fluss|m", "ader|fluss|f", "rinne|fluss|f", "lauf|fluss|m",
      "strom|fluss|m", "trift|fluss,ebene|f", "flut|fluss,wasser|f", "quell|fluss|m",
      "graben|fluss,feld|m", "sturz|fluss,berg|m", "klinge|fluss,bruch|f",
      "wasser|fluss|n", "seihe|fluss,moor|f"]),
    wald: liste(["forst|wald|m", "hain|wald|m", "loh|wald|n", "holz|wald|n",
      "hart|wald|m", "busch|wald|m", "dickicht|wald|n", "hag|wald|m",
      "bruch|wald,moor|m", "wald|wald|m", "schlag|wald,feld|m"]),
    gebirge: liste(["grat|berg|m", "kamm|berg|m", "zinnen|berg,hoch|p", "höhen|hoch|p",
      "wand|fels|f", "massiv|berg|n", "rücken|berg|m", "schroffen|fels|p",
      "hörner|hoch|p", "riegel|berg|m", "stock|berg|m"]),
    see: liste(["see|wasser|m", "spiegel|wasser|m", "weiher|wasser|m", "teich|wasser|m",
      "sumpf|moor|m", "pfuhl|moor|m", "moos|moor|n", "auge|wasser|n", "kessel|wasser,berg|m"]),
    region: liste(["mark|neutral|f", "land|neutral|n", "gau|ebene|m", "heide|ebene|f",
      "öde|ebene,heiss|f", "weiten|ebene|p", "höhen|hoch|p", "gründe|ebene|p",
      "bann|neutral|m", "strich|neutral|m", "saum|wasser,wald|m", "wildnis|wald|f",
      "kessel|berg|m", "becken|ebene|n", "moore|moor|p", "riedland|moor|n"]),
    bruch: liste(["riss|bruch|m", "kante|bruch|f", "abgrund|bruch|m", "sturz|bruch|m",
      "schrunde|bruch|f", "wunde|bruch|f", "spalt|bruch|m", "schlund|bruch|m"])
  },
  wirt: ["Hirsch||m", "Eiche||f", "Anker||m", "Pflug||m", "Fass||n", "Krug||m", "Ross||n",
    "Bären||m", "Schwan||m", "Rad||n", "Stern||m", "Mond||m", "Hammer||m", "Sichel||f",
    "Kanne||f", "Ochsen||m", "Ziege||f", "Wolf||m", "Reiher||m", "Karren||m", "Löffel||m"],
  wirtAdj: ["Golden", "Silbern", "Krumm", "Still", "Blau", "Schwarz", "Alt", "Wild",
    "Fett", "Durstig", "Müd", "Lahm", "Blind", "Weiß", "Rot", "Grün", "Bunt", "Trüb",
    "Sanft", "Rauh", "Tief", "Hoh", "Eisern", "Steinern", "Bitter", "Letzt", "Dunkl"],
  vorsilben: ["Ober", "Nieder", "Klein", "Groß", "Alt", "Neu", "Hinter", "Vorder"]
};

/* --------------------------------------------------------------------------
   2. Klassisch — antikisierende Komposita nach griechischem Muster. Passt zum
      Baustil "klassisch" (Saeulen, Tholos, Arkaden). Bestimmungsstaemme enden
      auf -o und tragen ihre Bedeutung mit: Chryso = Gold, Melano = schwarz,
      Thalasso = Meer. Damit bleibt auch hier jeder Name uebersetzbar.
   -------------------------------------------------------------------------- */
FAMILIEN.klassisch = {
  id: "klassisch", label: "Klassisch", deutsch: false, fuge: fugeKlassisch,
  bestimmung: liste([
    "Chryso", "Argyro", "Chalko", "Sidero", "Litho|fels", "Marmaro|fels", "Kerameo",
    "Halo|wasser", "Thalasso|wasser", "Potamo|fluss", "Limno|wasser", "Hydro|wasser",
    "Pyro|heiss", "Anemo", "Nepho", "Chiono|kalt", "Kryo|kalt", "Thermo|heiss",
    "Helio", "Seleno", "Astro", "Melano", "Leuko", "Erythro", "Kyano", "Chloro|wald",
    "Xantho", "Phaio", "Palaio", "Neo", "Mega", "Mikro", "Makro", "Bathy|bruch",
    "Hypso|hoch", "Oxy|fels", "Trachy|fels", "Glyky", "Pikro", "Hiero|arbor",
    "Basileo", "Demo", "Strato|weg", "Nau|wasser", "Hippo|ebene", "Lyko|wald",
    "Arkto|berg", "Aeto|berg", "Korako", "Delphino|wasser", "Ichthyo|wasser",
    "Ampelo|feld", "Elaio|feld", "Dendro|wald", "Rhodo", "Krino", "Kypari|wald",
    "Ammo|ebene", "Konio|heiss", "Skoto|bruch", "Eremo|heiss,ebene", "Phaino"
  ]),
  grund: liste([
    "polis|neutral|f", "kome|neutral|f", "vicos|neutral|m", "chorion|neutral|n",
    "limen|hafen,wasser|m", "ormos|bucht,wasser|m", "akte|wasser|f", "nesos|wasser|f",
    "akra|wasser,fels|f", "kolpos|bucht,wasser|m",
    "pyrgos|neutral,hoch|m", "teichos|neutral|n", "kastron|berg,neutral|n",
    "phrourion|hoch,weg|n", "gephyra|furt,fluss|f", "poros|furt,fluss,pass|m",
    "hodos|weg|f", "stathmos|weg|m",
    "krene|wasser|f", "pege|wasser,fluss|f", "potamia|fluss|f", "helos|moor|n",
    "limne|wasser,moor|f", "tenagos|moor|n",
    "lophos|berg|m", "oros|berg,hoch|n", "petra|fels,berg|f", "kremnos|bruch,fels|m",
    "charadra|bruch,pass|f", "pharanx|bruch,pass|f", "auchen|pass|m", "kleisura|pass|f",
    "pedion|ebene|n", "agros|feld|m", "ampelon|feld,berg|m",
    "alsos|wald,arbor|n", "drymos|wald|m", "hyle|wald|f",
    "hieron|arbor,neutral|n", "bomos|arbor|m", "naos|neutral,arbor|m", "agora|neutral,weg|f",
    "thermai|heiss,wasser|p", "kaminos|heiss|m", "pagos|kalt,fels|m", "chion|kalt|n"
  ]),
  adjektive: ["Palaio", "Neo", "Mega", "Melano", "Leuko", "Erythro", "Kyano", "Chryso",
    "Argyro", "Bathy", "Hypso", "Oxy", "Trachy", "Hiero", "Eremo"],
  natur: {
    fluss: liste(["potamos|fluss|m", "rhoos|fluss|m", "cheimarros|fluss,berg|m",
      "nama|fluss|n", "rheuma|fluss|n", "pege|fluss,wasser|f", "ochetos|fluss,feld|m"]),
    wald: liste(["drymos|wald|m", "hyle|wald|f", "alsos|wald|n", "nape|wald,ebene|f",
      "lochme|wald|f", "temenos|wald,arbor|n"]),
    gebirge: liste(["oros|berg|n", "akrolophia|hoch|f", "rachis|berg|f", "koryphai|hoch|p",
      "skopelos|fels|m", "kremnoi|bruch,fels|p"]),
    see: liste(["limne|wasser|f", "helos|moor|n", "katoptron|wasser|n", "phreatia|wasser|f"]),
    region: liste(["chora|neutral|f", "gaia|neutral|f", "eparchia|neutral|f",
      "pedias|ebene|f", "eremia|heiss,ebene|f", "paralia|wasser|f", "oreine|hoch|f",
      "ampelochora|feld|f"]),
    bruch: liste(["chasma|bruch|n", "rhegma|bruch|n", "kremnos|bruch|m", "barathron|bruch|n",
      "pharanx|bruch|f"])
  },
  wirt: ["Amphore||f", "Delphin||m", "Kranich||m", "Ölbaum||m", "Anker||m", "Dreifuß||m",
    "Lyra||f", "Säule||f", "Stern||m", "Kelch||m", "Widder||m", "Pferd||n", "Kranz||m"],
  wirtAdj: ["Golden", "Silbern", "Marmorn", "Still", "Blau", "Schwarz", "Alt", "Weiß",
    "Rot", "Heilig", "Fern", "Hoh", "Bitter", "Süß", "Letzt"],
  vorsilben: ["Neo", "Palaio", "Mega", "Mikro", "Ano", "Kato"]
};

/* --------------------------------------------------------------------------
   3. Zwergisch — hartes Deutsch aus Erz, Stein und Feuer. Zum Baustil
      "zwergisch" (Hallen, Schmiedetuerme, Tore). Sonderzug: mit rund einem
      Fuenftel Wahrscheinlichkeit steht ein Sippenname im Genitiv davor —
      "Thargungs Erzstollen".
   -------------------------------------------------------------------------- */
FAMILIEN.zwergisch = {
  id: "zwergisch", label: "Zwergisch", deutsch: true, fuge: fugeDeutsch,
  bestimmung: liste([
    "Erz|berg", "Eisen", "Kupfer", "Zinn", "Silber", "Gold", "Blei", "Granit|fels",
    "Basalt|fels", "Marmor|fels", "Schiefer|fels", "Quarz|fels", "Salz|wasser",
    "Schwefel|heiss", "Pech", "Kohlen|heiss", "Ruß|heiss", "Glut|heiss", "Feuer|heiss",
    "Hammer", "Amboss", "Zangen", "Meißel", "Keil", "Niet", "Runen", "Ketten",
    "Bart", "Grimm", "Trotz", "Zorn", "Treu", "Stark", "Tief", "Fest", "Streng",
    "Schwarz", "Rot", "Grau", "Alt", "Ur", "Erst", "Letzt",
    "Fels|fels", "Stein|fels", "Berg|berg", "Wurzel", "Nacht", "Frost|kalt",
    "Donner", "Sturm", "Blut", "Knochen", "Schädel", "Drachen", "Troll|berg",
    "Wurm", "Königs", "Ahnen", "Vater", "Sippen", "Wacht|hoch", "Schild", "Axt",
    "Sporn|berg", "Nebel", "Echo|berg", "Zwielicht"
  ]),
  grund: liste([
    "stollen|berg,fels|m", "schacht|berg,fels|m", "grube|berg|f", "halle|berg,neutral|f",
    "hall|berg,neutral|m", "gard|neutral|m", "burg|berg,neutral|f", "feste|neutral,berg|f",
    "werk|neutral,weg|n", "tor|pass,berg|n", "pforte|pass|f", "klamm|pass,fels|f",
    "scharte|pass,berg|f", "joch|pass|n", "grat|hoch,berg|m", "zinne|hoch,berg|f",
    "horst|berg|m", "warte|hoch|f", "wall|neutral|m", "bollwerk|neutral,weg|n",
    "damm|wasser,moor|m", "mole|hafen,wasser|f", "schleuse|fluss,wasser|f",
    "steg|fluss,wasser|m", "furt|furt,fluss|f", "brücke|furt,fluss|f",
    "born|wasser|m", "brunn|wasser|m", "esse|heiss,neutral|f", "schmelz|heiss|f",
    "ofen|heiss|m", "kessel|berg,moor|m", "kar|berg,kalt|n", "firn|kalt,hoch|m",
    "riss|bruch|m", "kluft|bruch,fels|f", "sturz|bruch|m", "abgrund|bruch|m",
    "schlund|bruch,moor|m", "grund|ebene|m", "tiefe|ebene,bruch|f", "mark|neutral|f",
    "hort|neutral,arbor|m", "mal|arbor,neutral|n", "bruch|moor|m", "hütte|heiss,neutral|f",
    "stufen|berg,ebene|p", "kaverne|berg,bruch|f", "säule|neutral,fels|f"
  ]),
  adjektive: ["Tief", "Alt", "Grimm", "Schwarz", "Grau", "Eisern", "Steinern", "Stumm",
    "Kalt", "Streng", "Blind", "Fest", "Rot", "Glühend", "Rauh", "Letzt", "Krumm"],
  natur: {
    fluss: liste(["ader|fluss|f", "rinne|fluss|f", "seiger|fluss,berg|m", "sturz|fluss,berg|m",
      "graben|fluss|m", "lauf|fluss|m", "schluck|fluss,bruch|m", "trübe|fluss,moor|f"]),
    wald: liste(["holz|wald|n", "hag|wald|m", "schlag|wald|m", "bruch|wald,moor|m",
      "hart|wald|m", "krüppel|wald,kalt|m"]),
    gebirge: liste(["zinnen|hoch|p", "grat|berg|m", "kamm|berg|m", "wand|fels|f",
      "riegel|berg|m", "hörner|hoch|p", "stock|berg|m", "schrofen|fels|p", "massiv|berg|n"]),
    see: liste(["auge|wasser|n", "kessel|wasser|m", "spiegel|wasser|m", "pfuhl|moor|m",
      "tiefe|wasser|f", "trog|wasser|m"]),
    region: liste(["mark|neutral|f", "reich|neutral|n", "tiefen|bruch,hoch|p",
      "höhen|hoch|p", "gründe|ebene|p", "wacht|neutral|f", "bann|neutral|m",
      "kessel|berg|m", "halden|berg|p", "öde|heiss,ebene|f"]),
    bruch: liste(["riss|bruch|m", "kluft|bruch|f", "schlund|bruch|m", "sturz|bruch|m",
      "wunde|bruch|f", "abgrund|bruch|m", "narbe|bruch|f"])
  },
  wirt: ["Amboss||m", "Hammer||m", "Fass||n", "Keil||m", "Bart||m", "Krug||m", "Zange||f",
    "Stollen||m", "Anker||m", "Nagel||m", "Kette||f", "Helm||m", "Kohle||f"],
  wirtAdj: ["Krumm", "Golden", "Eisern", "Steinern", "Glühend", "Schwarz", "Stumm",
    "Alt", "Tief", "Rot", "Grimm", "Blind", "Fett", "Durstig", "Letzt", "Rauh"],
  vorsilben: ["Ober", "Unter", "Tief", "Alt", "Neu", "Groß"],
  sippen: ["Thargun", "Brommir", "Kazrin", "Durmar", "Grimmel", "Orzun", "Baldrun",
    "Hulmar", "Skorvi", "Thrainn", "Belgrim", "Nurrik", "Vardun", "Molgrim"]
};

/* --------------------------------------------------------------------------
   4. Elfisch — erfundene Morpheme mit fester Bedeutung, damit auch hier ein
      Name uebersetzbar bleibt (die Glossen stehen im Kommentar). Zum Baustil
      "elfisch". Lautstruktur: Vokalharmonie an der Fuge, dazu mit einem
      Viertel Wahrscheinlichkeit eine melodische Endung.

      Staemme:  sil = Silber, ael = Licht, nim = weiss, cael = Himmel,
                mor = dunkel, lin = Lied, ith = Mond, anor = Sonne,
                gil = Stern, eryn = Wald, tin = Funke, lor = Traum
      Grund:    nen = Wasser, lond = Hafen, ras = Gipfel, lad = Tal,
                taur = Wald, gond = Fels, sarn = Kiesfurt, aelin = See
   -------------------------------------------------------------------------- */
FAMILIEN.elfisch = {
  id: "elfisch", label: "Elfisch", deutsch: false, fuge: fugeElfisch,
  bestimmung: liste([
    "Sil", "Ael", "Nim|kalt", "Cael", "Mor", "Lin", "Ith", "Anor", "Gil", "Eryn|wald",
    "Tin", "Lor", "Vae", "Thal|ebene", "Fen|moor", "Elu", "Mith", "Rhun", "Aur",
    "Ely", "Nar|heiss", "Ser", "Thae", "Ilm|hoch", "Ondo|fels", "Ere", "Aran",
    "Fael", "Beleg", "Amar", "Tir|hoch", "Luin|wasser", "Calad", "Alph|wasser",
    "Lith|heiss", "Rian", "Nyth", "Vael", "Sael", "Orin", "Undo|bruch", "Mel",
    "Hir", "Tathar|fluss", "Neldor|wald", "Rhosgo|moor", "Glor", "Nell|fluss",
    "Iaur", "Curu", "Maeg|fels", "Naith|wasser", "Hith|moor,kalt", "Bereth|hoch"
  ]),
  grund: liste([
    "nen|wasser,fluss|n", "duin|fluss|m", "lond|hafen,wasser|m", "falas|wasser|f",
    "iant|furt,fluss|f", "athrad|furt,fluss|f", "sarn|furt,fels|m", "brith|fluss,wasser|n",
    "ras|berg,hoch|m", "dol|berg|m", "amon|berg|m", "orod|berg,hoch|m",
    "gond|fels,berg|m", "criss|bruch|m", "cirith|pass,bruch|f", "aglon|pass|m",
    "annon|pass,neutral|n", "rond|neutral,berg|m", "ost|neutral,berg|m",
    "bar|neutral|n", "mar|neutral|n", "minas|neutral,hoch|f", "caras|neutral|f",
    "barad|hoch,neutral|m", "echad|weg,neutral|n", "rath|weg|f",
    "lad|ebene,pass|n", "imlad|pass,ebene|n", "nan|ebene,fluss|n", "talath|ebene|n",
    "parth|ebene,feld|f", "taur|wald|m", "galadh|wald,arbor|m", "loth|wald,arbor,ebene|f",
    "aelin|wasser|f", "eithel|wasser|f", "sirith|fluss|f", "loeg|moor|n",
    "hith|moor,kalt|m", "naith|wasser,ebene|f", "thil|hoch,neutral|n",
    "riel|arbor,neutral|f", "fain|kalt,hoch|n"
  ]),
  adjektive: ["Iaur", "Mor", "Nim", "Sil", "Gil", "Calad", "Fael", "Beleg", "Luin", "Ael"],
  natur: {
    fluss: liste(["duin|fluss|m", "sirith|fluss|f", "nen|fluss|n", "celeth|fluss|f",
      "brith|fluss|n", "lhach|fluss,berg|m"]),
    wald: liste(["taur|wald|m", "eryn|wald|m", "galadh|wald|m", "lothrin|wald|f",
      "neldor|wald|m", "methen|wald|f"]),
    gebirge: liste(["ered|hoch|p", "orod|berg|m", "rasg|hoch|p", "gondras|fels|m",
      "aegais|hoch|p", "thoron|hoch|m"]),
    see: liste(["aelin|wasser|f", "nenui|wasser|n", "lin|wasser|n", "elthil|wasser|n",
      "loeg|moor|n"]),
    region: liste(["dor|neutral|n", "lann|neutral|n", "arth|neutral|n", "talath|ebene|n",
      "faelas|wasser|n", "eredhrim|hoch|n", "loegin|moor|n", "lothlann|ebene|n"]),
    bruch: liste(["criss|bruch|m", "cirith|bruch|f", "fuindol|bruch|n", "undo|bruch|n",
      "rhaw|bruch|n"])
  },
  wirt: ["Weide||f", "Mond||m", "Harfe||f", "Blatt||n", "Quelle||f", "Reiher||m", "Stern||m",
    "Elster||f", "Silberdorn||m", "Nachtfalter||m", "Lied||n", "Schwan||m"],
  wirtAdj: ["Silbern", "Still", "Fern", "Weiß", "Blau", "Grün", "Sanft", "Golden",
    "Schlafend", "Singend", "Trunken", "Wandernd", "Letzt", "Dunkl"],
  endungen: ["iel", "ien", "ath", "eth", "ion", "aer"],
  vorsilben: ["Iaur", "Gwaith", "Ered", "Nan", "Dor"]
};

/* --------------------------------------------------------------------------
   5. Arbor-Kult — altertuemlich. Die Grundwoerter sind echte alte
      Ortsnamenglieder (-loh, -lar, -mar, -wang, -rod, -scheid, -bue-ttel,
      -stedt), erweitert um die Wortwelt der Ranke (-geaest, -krone, -wuchs,
      -schoss, -strang). Sonderzug: Vorsilbe "Ur-" mit Bindestrich und haeufige
      Artikelformen ("Das Stille Geaest").
   -------------------------------------------------------------------------- */
FAMILIEN.arbor = {
  id: "arbor", label: "Arbor-Kult", deutsch: true, fuge: fugeDeutsch,
  bestimmung: liste([
    "Ur|arbor", "Alt", "Erst|arbor", "Letzt", "Wurzel|arbor", "Ranken|arbor",
    "Blatt|arbor", "Knospen|arbor", "Dorn", "Rinden|arbor", "Saft|arbor",
    "Kern|arbor", "Ast|arbor", "Zweig|arbor", "Reis|arbor", "Trieb|arbor",
    "Sproß|arbor", "Laub|wald", "Moos|moor", "Flechten|fels", "Harz|wald",
    "Bast", "Samen|feld", "Frucht|feld", "Apfel|arbor", "Kelter|feld",
    "Grün|wald", "Braun", "Fahl", "Welk", "Dunkel", "Still", "Tief", "Hoch|hoch",
    "Weit|ebene", "Heilig|arbor", "Ewig|arbor", "Stumm", "Blind", "Seher|arbor",
    "Ahnen|arbor", "Mutter|arbor", "Vater", "Sippen", "Wächter|hoch", "Hüter|arbor",
    "Sänger", "Träumer", "Schlaf", "Traum", "Wach", "Nacht", "Mond", "Nebel|moor",
    "Tau", "Regen", "Wind", "Frost|kalt", "Schatten", "Dämmer", "Zwielicht",
    "Wende", "Opfer|arbor", "Bann|arbor"
  ]),
  grund: liste([
    "hain|wald,arbor|m", "loh|wald,arbor|n", "lar|neutral,arbor|n", "mar|neutral|n",
    "wang|ebene,feld|m", "rod|wald,feld|n", "scheid|pass,berg|n", "hag|wald,neutral|m",
    "horst|berg,wald|m", "born|wasser|m", "brunn|wasser|m", "fried|neutral|m",
    "mal|arbor,neutral|n", "thing|arbor,neutral|n", "hort|arbor,neutral|m",
    "wart|hoch,weg|f", "stedt|neutral|n", "büttel|neutral|n", "ingen|neutral|n",
    "heim|neutral|n", "au|fluss,ebene|f", "werd|fluss,wasser|n", "fenn|moor|n",
    "ried|moor|n", "bruch|moor|m", "schlund|bruch|m", "riss|bruch|m",
    "klinge|bruch,fluss|f", "kar|berg|n", "first|hoch,berg|m", "kopf|berg|m",
    "eck|neutral|n", "steig|pass,weg|m", "furt|furt,fluss|f", "steg|fluss,wasser|m",
    "geäst|arbor|n", "krone|arbor,hoch|f", "wuchs|arbor|m", "strang|arbor|m",
    "schoß|arbor|m", "kelch|arbor|m", "ring|arbor,neutral|m", "laube|arbor,wald|f",
    "ranke|arbor|f", "wehr|fluss,weg|n"
  ]),
  adjektive: ["Still", "Alt", "Ewig", "Stumm", "Blind", "Grün", "Fahl", "Welk",
    "Heilig", "Dunkl", "Tief", "Wach", "Schlafend", "Träumend", "Erst", "Letzt",
    "Sanft", "Grau", "Weiß", "Wandernd"],
  natur: {
    fluss: liste(["ader|fluss|f", "seihe|fluss,moor|f", "au|fluss|f", "klinge|fluss,bruch|f",
      "born|fluss,wasser|m", "trift|fluss,ebene|f", "lauf|fluss|m", "quell|fluss|m"]),
    wald: liste(["hain|wald|m", "loh|wald|n", "hag|wald|m", "laube|wald,arbor|f",
      "dickicht|wald|n", "geäst|wald,arbor|n", "bruch|wald,moor|m", "hart|wald|m"]),
    gebirge: liste(["first|hoch|m", "kämme|berg|p", "höhen|hoch|p", "wand|fels|f",
      "köpfe|berg|p", "scheiden|pass|p", "hörner|hoch|p"]),
    see: liste(["auge|wasser|n", "spiegel|wasser|m", "pfuhl|moor|m", "moos|moor|n",
      "born|wasser|m", "lache|moor|f"]),
    region: liste(["mark|neutral|f", "land|neutral|n", "hut|arbor|f", "bann|arbor|m",
      "hain|wald,arbor|m", "wildnis|wald|f", "moore|moor|p", "höhen|hoch|p",
      "gründe|ebene|p", "saum|wald,wasser|m", "weiten|ebene|p"]),
    bruch: liste(["riss|bruch|m", "schlund|bruch|m", "wunde|bruch|f", "narbe|bruch|f",
      "klinge|bruch|f", "sturz|bruch|m", "abgrund|bruch|m"])
  },
  wirt: ["Wurzel||f", "Krone||f", "Blatt||n", "Apfel||m", "Kelch||m", "Ranke||f", "Dorn||m",
    "Mond||m", "Raben||m", "Hirsch||m", "Kelter||f", "Schlaf||m"],
  wirtAdj: ["Still", "Alt", "Grün", "Fahl", "Welk", "Ewig", "Stumm", "Blind", "Golden",
    "Dunkl", "Tief", "Schlafend", "Träumend", "Letzt", "Weiß"],
  vorsilben: ["Ur", "Alt", "Ober", "Nieder", "Erst"],
  urVorsatz: true
};

/* --------------------------------------------------------------------------
   6. Neutral — der schlichte Rueckfall. Ein Wortschatz ohne kulturellen
      Akzent, fuer Karten, die keine Farbe bekennen sollen.
   -------------------------------------------------------------------------- */
FAMILIEN.neutral = {
  id: "neutral", label: "Neutral", deutsch: true, fuge: fugeDeutsch,
  bestimmung: liste([
    "Nord", "Süd", "Ost", "West", "Ober|hoch", "Unter", "Mittel", "Alt", "Neu",
    "Groß", "Klein", "Hoch|hoch", "Tief", "Weit|ebene", "Fern", "Nah",
    "Rot", "Schwarz", "Weiß", "Grün", "Grau", "Blau", "Braun", "Gold", "Silber",
    "Stein|fels", "Sand|wasser", "Kies|fluss", "Salz|wasser", "Eisen", "Holz|wald",
    "Wasser|wasser", "Wind", "Sonnen", "Mond", "Sternen", "Nebel", "Frost|kalt",
    "Sommer", "Winter|kalt", "Morgen", "Abend", "Krähen", "Hirsch|wald", "Fuchs",
    "Adler|berg", "Reiher|moor", "Eichen|wald", "Birken|wald", "Weiden|fluss",
    "Dorn", "Distel|ebene", "Königs", "Bauern|feld", "Fischers|wasser", "Hirten|ebene",
    "Wächters|hoch", "Still", "Wild", "Klar", "Trüb|moor", "Rauh|berg", "Sanft",
    "Lang", "Kurz", "Krumm", "Gerad"
  ]),
  grund: liste([
    "berg|berg,hoch|m", "tal|ebene,berg|n", "bach|fluss|m", "feld|feld,ebene|n",
    "dorf|neutral|n", "stadt|neutral|f", "heim|neutral|n", "hausen|neutral|n",
    "furt|furt,fluss|f", "brücke|furt,fluss|f", "hafen|hafen,wasser|m",
    "bucht|bucht,wasser|f", "ufer|wasser|n", "strand|wasser|m", "moor|moor|n",
    "ried|moor|n", "pass|pass|m", "joch|pass,berg|n", "scharte|pass,berg|f",
    "halde|berg,fels|f", "fels|fels,berg|m", "grat|berg,hoch|m", "riss|bruch|m",
    "kante|bruch|f", "sturz|bruch,fels|m", "grund|ebene,neutral|m", "au|fluss,ebene|f",
    "wald|wald|m", "hain|wald,arbor|m", "hof|feld,neutral|m", "weiler|neutral|m",
    "wehr|fluss,weg|n", "warte|hoch,weg|f", "steg|wasser,fluss|m", "born|wasser|m",
    "mark|neutral|f", "ecke|neutral|f", "rast|weg|f", "kreuz|weg|n", "kar|berg,kalt|n",
    "öde|ebene,heiss|f", "acker|feld|m"
  ]),
  adjektive: ["Alt", "Neu", "Still", "Wild", "Klar", "Trüb", "Grau", "Schwarz", "Weiß",
    "Tief", "Breit", "Eng", "Lang", "Kurz", "Kalt", "Warm", "Sanft", "Rauh"],
  natur: {
    fluss: liste(["bach|fluss|m", "fluss|fluss|m", "ader|fluss|f", "lauf|fluss|m",
      "rinne|fluss|f", "strom|fluss|m", "graben|fluss,feld|m", "quell|fluss|m"]),
    wald: liste(["wald|wald|m", "forst|wald|m", "hain|wald|m", "holz|wald|n",
      "busch|wald|m", "dickicht|wald|n"]),
    gebirge: liste(["berge|berg|p", "grat|berg|m", "kamm|berg|m", "höhen|hoch|p",
      "wand|fels|f", "massiv|berg|n", "rücken|berg|m"]),
    see: liste(["see|wasser|m", "teich|wasser|m", "weiher|wasser|m", "spiegel|wasser|m",
      "sumpf|moor|m"]),
    region: liste(["land|neutral|n", "mark|neutral|f", "gebiet|neutral|n", "heide|ebene|f",
      "weiten|ebene|p", "höhen|hoch|p", "küste|wasser|f", "moore|moor|p", "wildnis|wald|f"]),
    bruch: liste(["riss|bruch|m", "kante|bruch|f", "abgrund|bruch|m", "sturz|bruch|m",
      "spalt|bruch|m"])
  },
  wirt: ["Stern||m", "Krug||m", "Anker||m", "Hirsch||m", "Eiche||f", "Rad||n", "Mond||m",
    "Fass||n", "Ross||n", "Kanne||f"],
  wirtAdj: ["Golden", "Silbern", "Still", "Alt", "Blau", "Rot", "Grün", "Weiß",
    "Krumm", "Müd", "Durstig", "Letzt"],
  vorsilben: ["Ober", "Nieder", "Klein", "Groß", "Alt", "Neu"]
};

var FAMILIEN_IDS = ["dorf", "klassisch", "zwergisch", "elfisch", "arbor", "neutral"];

/* Wortwelt der Arbor-Ranken. Unabhaengig von der Kartenfamilie: eine Ranke ist
   ueberall dasselbe Wesen, und die Namen sollen sich hoerbar von den
   Ortsnamen abheben. */
var RANKE_GRUND = liste([
  "strang|arbor|m", "krone|arbor|f", "geäst|arbor|n", "wuchs|arbor|m", "schoß|arbor|m",
  "mal|arbor|n", "hort|arbor|m", "kelch|arbor|m", "arm|arbor|m", "säule|arbor|f",
  "stiel|arbor|m", "trieb|arbor|m", "wurzel|arbor|f", "first|arbor,hoch|m",
  "ranke|arbor|f", "leiter|arbor|f", "spindel|arbor|f", "wende|arbor|f",
  "stufe|arbor|f", "himmelsweg|arbor|m"
]);
var RANKE_ADJ = ["Still", "Alt", "Ewig", "Erst", "Letzt", "Stumm", "Blind", "Grün",
  "Fahl", "Welk", "Heilig", "Dunkl", "Wach", "Schlafend", "Träumend", "Grau",
  "Weiß", "Wandernd", "Krumm", "Hoch"];


/* ==========================================================================
   Biome -> Lagemerkmale und -> Sprachfamilie

   Die Lagemessung kennt nur Geometrie; das Biom traegt die Stimmung nach.
   Beide werden mit max() verrechnet, nie addiert — ein Wuestenbiom macht die
   Lage nicht "noch mehr Wueste", es setzt eine Untergrenze.
   ========================================================================== */
var BIOM_LAGE = {
  wiese: { ebene: 0.6 }, kueste: { wasser: 0.8, ebene: 0.4 },
  steppe: { ebene: 0.75, heiss: 0.35 }, moor: { moor: 0.9 }, sumpf: { moor: 1 },
  meer: { wasser: 1 }, mangrove: { moor: 0.8, wasser: 0.7 },
  kreide: { fels: 0.5, wasser: 0.45 }, tundra: { kalt: 0.8, ebene: 0.5 },
  schnee: { kalt: 1 }, eis: { kalt: 1, fels: 0.4 },
  hochland: { hoch: 0.65, berg: 0.5 }, karst: { fels: 0.75, berg: 0.4 },
  terrassen: { berg: 0.5, feld: 0.35 },
  regenwald: { wald: 0.9, heiss: 0.3 }, bambuswald: { wald: 0.9 },
  bluetental: { wald: 0.7, ebene: 0.45 }, nebelwald: { wald: 0.9, kalt: 0.3 },
  pilzwald: { wald: 0.9, arbor: 0.35 },
  vulkan: { heiss: 1, fels: 0.55 }, salzwueste: { heiss: 0.9, ebene: 0.7 },
  aschebrache: { heiss: 0.65, bruch: 0.25 }, wueste: { heiss: 0.9, ebene: 0.6 },
  klippenmeer: { wasser: 0.85, fels: 0.65 }, korallenbank: { wasser: 1 }
};

/* Familie je Biom fuer "auto". Bewusst dieselbe Logik wie BIOM_STIL in
   welt.js, aber als EIGENE Tabelle: namen.js darf welt.js nicht importieren
   (welt.js importiert namen.js — das waere ein Zyklus). */
var BIOM_FAMILIE = {
  wiese: "dorf", kueste: "dorf", steppe: "dorf", moor: "dorf", sumpf: "dorf",
  meer: "dorf", mangrove: "dorf", kreide: "dorf", tundra: "dorf", schnee: "dorf",
  klippenmeer: "dorf", korallenbank: "dorf",
  hochland: "zwergisch", karst: "zwergisch", eis: "zwergisch", terrassen: "zwergisch",
  vulkan: "zwergisch", salzwueste: "zwergisch",
  regenwald: "elfisch", bambuswald: "elfisch", bluetental: "elfisch",
  nebelwald: "elfisch", pilzwald: "elfisch",
  aschebrache: "arbor",
  wueste: "klassisch"
};


/* ==========================================================================
   Lage — was der Ort ueber sich verraet

   Alles kommt aus heightAt/slopeAt, der Elementliste und dem Biom. Kosten je
   Aufruf: 12 + 12 + 8 Hoehenabfragen plus ein Durchlauf ueber die Elemente.
   Bei rund neunzig Namen einer 1024er Karte ist das im einstelligen
   Millisekundenbereich.
   ========================================================================== */

function wasserRing(x, z, r) {
  var n = 12, w = 0;
  for (var k = 0; k < n; k++) {
    var a = k / n * Math.PI * 2;
    if (heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) < WATER) w++;
  }
  return w / n;
}

function abstandSegment(x, z, a, b) {
  var dx = b.x - a.x, dz = b.z - a.z;
  var l2 = dx * dx + dz * dz;
  if (l2 < 1e-9) return Math.hypot(x - a.x, z - a.z);
  var t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

/** Liegt der Punkt im (ueberschneidungsfreien) Polygon? Strahlverfahren. */
function inPoly(x, z, p) {
  var drin = false;
  for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i].z > z) !== (p[j].z > z) &&
        x < (p[j].x - p[i].x) * (z - p[i].z) / (p[j].z - p[i].z) + p[i].x) drin = !drin;
  }
  return drin;
}

function abstandZu(el, x, z) {
  var p = el.points;
  if (!p || !p.length) return 1e9;
  if (p.length === 1) return Math.hypot(p[0].x - x, p[0].z - z);
  var best = 1e9;
  for (var i = 1; i < p.length; i++) {
    var d = abstandSegment(x, z, p[i - 1], p[i]);
    if (d < best) best = d;
  }
  if (el.kind === "flaeche") {
    var d2 = abstandSegment(x, z, p[p.length - 1], p[0]);
    if (d2 < best) best = d2;
    if (inPoly(x, z, p)) best = 0;
  }
  return best;
}

/**
 * Misst die Lage an (x, z) und liefert je Lagemerkmal einen Wert 0..1.
 * `opt.elemente` ist die Elementliste, gegen die Fluss-, Strassen-,
 * Bruch-, Wald-, Acker- und Rankennaehe gemessen werden (Default S.elements);
 * der Weltgenerator reicht dort seine EIGENE, wachsende Liste herein, weil
 * S.elements zu dem Zeitpunkt noch die alte Karte zeigt.
 */
function lageAn(x, z, opt) {
  opt = opt || {};
  var els = opt.elemente || S.elements || [];
  var L = {};
  for (var t = 0; t < LAGEN.length; t++) L[LAGEN[t]] = 0;

  var h = heightAt(x, z);
  var ueber = h - WATER;
  var flach = sstep(COS26, COS8, slopeAt(x, z));
  var steil = 1 - flach;

  // --- Wasser: zwei Ringe. Der nahe entscheidet ueber "am Ufer", der weite
  //     ueber die Form der Kueste (halb Wasser = Bucht, ganz = Klippe/Insel).
  var nah = wasserRing(x, z, 9), fern = wasserRing(x, z, 26);
  var ufer = clamp(nah * 2.6, 0, 1);
  var buchtform = clamp(4 * fern * (1 - fern), 0, 1);
  L.wasser = clamp(Math.max(ufer, fern * 1.15), 0, 1);
  L.bucht = clamp(ufer * buchtform * 1.3, 0, 1);
  L.hafen = clamp(ufer * (0.45 + 0.75 * buchtform), 0, 1);

  // --- Relief im Ring: Gipfel, Mulde, Sattel.
  var hoeher = 0, tiefer = 0, wechsel = 0, vor = 0, erst = 0;
  var hLo = 1e9, hHi = -1e9;
  for (var k = 0; k < 8; k++) {
    var a = k / 8 * Math.PI * 2;
    var hn = heightAt(x + Math.cos(a) * 11, z + Math.sin(a) * 11);
    if (hn < hLo) hLo = hn;
    if (hn > hHi) hHi = hn;
    var vz = hn > h ? 1 : -1;
    if (vz > 0) hoeher++; else tiefer++;
    if (k === 0) erst = vz; else if (vz !== vor) wechsel++;
    vor = vz;
  }
  if (vor !== erst) wechsel++;
  var relief = clamp((hHi - hLo) / 7, 0, 1);
  var hoch = sstep(3.5, 17, ueber);
  L.hoch = hoch;
  L.berg = clamp(steil * 0.85 + hoch * 0.75 + (hoeher === 0 && relief > 0.25 ? 0.45 : 0), 0, 1);
  L.fels = clamp(steil * 1.35 - 0.12, 0, 1);
  L.pass = (wechsel >= 4 && hoeher >= 2 && tiefer >= 2) ? clamp(0.35 + relief * 0.8, 0, 1) : 0;
  L.ebene = clamp(flach * (1 - hoch) * (1 - ufer * 0.45) * (1 - relief * 0.5), 0, 1);
  L.moor = clamp(sstep(3.2, 0.3, ueber) * flach * (0.35 + ufer * 0.8), 0, 1);

  // --- Elemente: Fluss, Strasse, Bruchkante, Wald, Acker, Ranke.
  var dFluss = 1e9, dWeg = 1e9, dBruch = 1e9, dWald = 1e9, dFeld = 1e9, dRanke = 1e9;
  for (var i = 0; i < els.length; i++) {
    var e = els[i], d;
    if (e.kind === "pfad") {
      if (e.variant === "fluss") { d = abstandZu(e, x, z); if (d < dFluss) dFluss = d; }
      else if (e.variant === "strasse") { d = abstandZu(e, x, z); if (d < dWeg) dWeg = d; }
      else if (e.variant === "bruch") { d = abstandZu(e, x, z); if (d < dBruch) dBruch = d; }
    } else if (e.kind === "flaeche") {
      if (e.variant === "wald") { d = abstandZu(e, x, z); if (d < dWald) dWald = d; }
      else if (e.variant === "feld") { d = abstandZu(e, x, z); if (d < dFeld) dFeld = d; }
    } else if (e.kind === "ranke") {
      d = abstandZu(e, x, z); if (d < dRanke) dRanke = d;
    }
  }
  var flussNah = sstep(46, 5, dFluss);
  var wegNah = sstep(34, 4, dWeg);
  // Korridormaske nur im Editor: waehrend des Weltgenerators zeigt sie die
  // ALTE Karte (welt.js reicht deshalb korridor:false herein).
  if (opt.korridor !== false && inCorridor(x, z)) wegNah = Math.max(wegNah, 0.7);
  L.fluss = Math.max(flussNah, ufer * 0.25);
  L.weg = wegNah;
  // Furt = Fluss UND Weg. Ohne Weg bleibt ein Rest: auch eine Siedlung
  // unmittelbar am Ufer eines Laufs darf "-furt" heissen.
  L.furt = clamp(sstep(26, 2.5, dFluss) * (0.45 + 0.55 * wegNah), 0, 1);
  L.bruch = sstep(70, 6, dBruch);
  L.arbor = sstep(115, 16, dRanke);
  L.wald = sstep(55, 6, dWald);
  L.feld = sstep(45, 5, dFeld);

  // --- Biom hebt Untergrenzen an.
  var bl = BIOM_LAGE[opt.biom || S.biom];
  if (bl) for (var b in bl) if (L[b] !== undefined && bl[b] > L[b]) L[b] = bl[b];

  // Im Wasser stehende Punkte (Inselchen, Watt) sollen keine Bergnamen tragen.
  if (ueber < 0.2) { L.berg *= 0.2; L.fels *= 0.4; L.hoch *= 0.2; L.wasser = 1; }

  L.neutral = 0.45;
  L._h = h;
  return L;
}

/** Kurzfassung der staerksten Lagemerkmale — fuer Tests, Berichte und Tooltips. */
function beschreibeLage(x, z, opt) {
  var L = opt && opt.lage ? opt.lage : lageAn(x, z, opt);
  var paare = [];
  for (var i = 0; i < LAGEN.length; i++) {
    if (LAGEN[i] === "neutral") continue;
    if (L[LAGEN[i]] > 0.25) paare.push([LAGEN[i], L[LAGEN[i]]]);
  }
  paare.sort(function (a, b) { return b[1] - a[1]; });
  var out = [];
  for (var k = 0; k < paare.length && k < 4; k++) out.push(paare[k][0] + " " + paare[k][1].toFixed(2));
  return out.length ? out.join(", ") : "unauffällig";
}


/* ==========================================================================
   Auswahl — Lage + Dublettenstrafe -> Gewicht

   w = 0.12 + Summe(Lagewert^1.15) * 1.7
   Woerter, deren saemtliche Lagen ausschliessend sind und am Ort alle unter
   0.08 liegen, werden auf 6 % gedaempft. Danach teilt die Dublettenstrafe:
   ein Grundwort, das auf dieser Karte schon zweimal steht, ist nur noch ein
   Fuenftel so wahrscheinlich.
   ========================================================================== */
function gewicht(eintrag, L, benutzt) {
  var lg = eintrag.lagen, w = 0.12, treffer = 0, exkl = 0, exklWert = 0;
  for (var i = 0; i < lg.length; i++) {
    var v = L[lg[i]];
    if (v === undefined) continue;
    w += Math.pow(v, 1.15) * 1.7;
    if (v > treffer) treffer = v;
    if (AUSSCHLIESSEND[lg[i]]) { exkl++; if (v > exklWert) exklWert = v; }
  }
  /* Alle Lagen des Wortes sind ausschliessend und keine trifft zu: stark
     daempfen. Nicht hart abschneiden, sondern gleitend — sonst kippt der Name
     an der Schwelle um, obwohl die Lage sich kaum aendert. */
  if (lg.length && exkl === lg.length) w *= 0.04 + 0.96 * sstep(0.04, 0.34, exklWert);
  var n = benutzt ? (benutzt[eintrag.w] || 0) : 0;
  if (n) w /= (1 + 2.2 * n);
  return w;
}

function waehle(eintraege, L, benutzt, rng) {
  var summe = 0, i, w = [];
  for (i = 0; i < eintraege.length; i++) { w[i] = gewicht(eintraege[i], L, benutzt); summe += w[i]; }
  if (summe <= 0) return eintraege[ri(rng, 0, eintraege.length - 1)];
  var r = rng() * summe;
  for (i = 0; i < eintraege.length; i++) { r -= w[i]; if (r <= 0) return eintraege[i]; }
  return eintraege[eintraege.length - 1];
}

function waehleFlach(arr, rng) { return arr[ri(rng, 0, arr.length - 1)]; }


/* ==========================================================================
   Namensbau
   ========================================================================== */

/** Bestimmungswort + Grundwort in der Lautstruktur der Familie. */
function komposition(F, best, gr, rng) {
  var name = gross(F.fuge(best.w, gr.w));
  // Melodische Endung nur, solange der Name noch handlich ist. Ohne die
  // Laengengrenze entstehen aus zwei langen elfischen Gliedern Woerter wie
  // "Neldorlothlannath" — richtig gebildet, aber unlesbar.
  if (F.endungen && name.length <= 10 && rng() < 0.28) name = F.fuge(name, waehleFlach(F.endungen, rng));
  return gross(name);
}

/* Stamm und Grundwort duerfen nicht denselben Anfang haben ("Eremo"+"eremia",
   "Eryn"+"eryn"). Erst vier gewichtete Neuversuche, dann der erste Eintrag der
   Liste, der nicht anstoesst — so ist das Echo sicher weg und nicht nur
   unwahrscheinlich. Kleine Wortlisten (die Naturlisten haben sechs bis vierzehn
   Eintraege) brauchen genau diesen zweiten Zweig. */
function grundOhneEcho(woerter, best, L, V, rng) {
  var kopf = best.w.slice(0, 3).toLowerCase();
  var gr = waehle(woerter, L, V.grund, rng), v;
  for (v = 0; v < 4 && gr.w.slice(0, 3).toLowerCase() === kopf; v++) gr = waehle(woerter, L, V.grund, rng);
  if (gr.w.slice(0, 3).toLowerCase() === kopf) {
    var start = ri(rng, 0, woerter.length - 1);
    for (v = 0; v < woerter.length; v++) {
      var k = woerter[(start + v) % woerter.length];
      if (k.w.slice(0, 3).toLowerCase() !== kopf) return k;
    }
  }
  return gr;
}

/** Artikelform: "Der Alte Lauf", "Die Stillen Höhen". Nur deutsche Familien. */
function artikelform(F, gr, rng) {
  var adj = waehleFlach(F.adjektive, rng);
  return artikel(gr.g) + " " + gross(adj) + adjEndung(gr.g) + " " + gross(gr.w);
}

/** Substantiviertes Adjektiv: "Die Trübe", "Die Stille". */
function adjektivform(F, rng) {
  return "Die " + gross(waehleFlach(F.adjektive, rng)) + "e";
}

function ortsName(F, L, V, rng) {
  var best = waehle(F.bestimmung, L, V.stamm, rng);
  var gr = grundOhneEcho(F.grund, best, L, V, rng);
  var name = komposition(F, best, gr, rng);
  // Zwergische Sippe im Genitiv — der eine strukturelle Sonderzug der Familie.
  if (F.sippen && rng() < 0.18) name = waehleFlach(F.sippen, rng) + "s " + name;
  // Arbor haengt gern ein "Ur-" davor.
  else if (F.urVorsatz && rng() < 0.14) name = "Ur-" + name;
  V.letzterStamm = best.w;
  V.letzterGrund = gr.w;
  return name;
}

function naturName(F, art, L, V, rng) {
  var woerter = (F.natur && F.natur[art]) || F.grund;
  var gr = waehle(woerter, L, V.grund, rng);
  V.letzterGrund = gr.w;
  if (F.deutsch) {
    var r = rng();
    // Regionen, Gebirge und Bruchkanten leben von der Artikelform; Fluesse und
    // Waelder klingen als Kompositum oft besser ("Krähenbach" vor "Der Trübe
    // Bach"). Die Schwellen sind Gestaltung, nicht Physik.
    var artikelAnteil = (art === "region" || art === "gebirge" || art === "bruch") ? 0.72
      : (art === "see" ? 0.45 : 0.34);
    /* Das substantivierte Adjektiv ("Die Trübe") traegt nur dort, wo das
       Bezugswort selbstverstaendlich ist — bei einem Fluss oder einem See.
       Ein Wald namens "Die Klare" laesst den Leser raten. */
    if ((art === "fluss" || art === "see") && r < 0.14) return adjektivform(F, rng);
    if (r < artikelAnteil) return artikelform(F, gr, rng);
  }
  var best = waehle(F.bestimmung, L, V.stamm, rng);
  V.letzterStamm = best.w;
  gr = grundOhneEcho(woerter, best, L, V, rng);
  V.letzterGrund = gr.w;
  return komposition(F, best, gr, rng);
}

function rankenName(F, L, V, rng) {
  var gr = waehle(RANKE_GRUND, L, V.grund, rng);
  V.letzterGrund = gr.w;
  var r = rng();
  // Lange Grundwoerter ("himmelsweg") tragen nur die Artikelform — als
  // Kompositum wuerden sie zu Bandwurmnamen.
  if (r < 0.45 || gr.w.length > 7) return artikel(gr.g) + " " + gross(waehleFlach(RANKE_ADJ, rng)) + adjEndung(gr.g) + " " + gross(gr.w);
  var best = waehle(FAMILIEN.arbor.bestimmung, L, V.stamm, rng);
  V.letzterStamm = best.w;
  var name = gross(fugeDeutsch(best.w, gr.w));
  if (r < 0.62) name = "Ur-" + name;
  return name;
}

/** Gasthausnamen bleiben immer deutsch — sie stehen im Text des Spielleiters,
 *  nicht auf einem Wegweiser. Die Familie faerbt nur Wort und Beiwort. */
function gasthausName(F, rng) {
  var w = zerlege(waehleFlach(F.wirt, rng));
  var adj = waehleFlach(F.wirtAdj, rng);
  return (w.g === "f" ? "Zur " : "Zum ") + gross(adj) + "en " + gross(w.w);
}


/* ==========================================================================
   Sprachfamilie der Karte und Sprachgrenzen
   ========================================================================== */

/** Auswahlliste fuer die Bedienung. "auto" steht bewusst vorn. */
function sprachfamilien() {
  var out = [["auto", "Aus dem Biom"]];
  for (var i = 0; i < FAMILIEN_IDS.length; i++) {
    out.push([FAMILIEN_IDS[i], FAMILIEN[FAMILIEN_IDS[i]].label]);
  }
  return out;
}

/**
 * Sprachfamilie der Karte. S.sprachfamilie ist ein OPTIONALES Kartenfeld: es
 * steht nicht in der Deklaration von S (core/store.js gehoert dieser Runde
 * nicht) und fehlt deshalb bis zum ersten Setzen — dieser Zweig behandelt das
 * wie "auto".
 */
function familieDerKarte() {
  var f = S.sprachfamilie;
  if (f && FAMILIEN[f]) return f;
  return BIOM_FAMILIE[S.biom] || "dorf";
}

function setzeSprachfamilie(id) {
  S.sprachfamilie = (id && (FAMILIEN[id] || id === "auto")) ? id : "auto";
  return S.sprachfamilie;
}

/**
 * Familie AN EINEM ORT. Ein langwelliges Rauschen (Wellenlaenge rund 280
 * Einheiten) schneidet zusammenhaengende Flecken aus der Karte, in denen eine
 * andere Familie gilt — das ergibt Sprachgrenzen statt gleichverteilter
 * Fremdnamen. Welche Nachbarfamilie es ist, entscheidet eine grobe Zelle, so
 * dass ein ganzer Landstrich dieselbe Fremdsprache spricht.
 */
function familieAn(x, z, basis, worldSeed, fremdAn) {
  if (fremdAn === false) return basis;
  /* Frequenz an der KARTENGROESSE, nicht an einer festen Zahl: ueber jede
     Kante sollen rund drei Wellen laufen. Mit einer festen Frequenz faende
     eine 256er Karte gar keine Grenze (sie laege ganz in einer Welle) und
     eine 1024er zerfiele in ein Dutzend Flicken. */
  var f = 3.2 / Math.max(64, KARTE.map);
  var n = fractal(x * f + 41, z * f + 17, (worldSeed + 0x2f7b) | 0, 3);
  // Schwelle gemessen, nicht geschaetzt: 0.78 ergibt ueber fuenf Weltseeds
  // 0.5 bis 15 % Fremdflaeche — genug fuer sichtbare Sprachgrenzen, zu wenig,
  // um die Kartenfamilie zu verwaessern.
  if (n <= 0.78) return basis;
  var zelle = Math.max(24, KARTE.map * 0.42);
  var ci = Math.floor((x + 4096) / zelle), cj = Math.floor((z + 4096) / zelle);
  var r = hashi(ci, cj, (worldSeed + 0x777) | 0);
  var andere = [];
  for (var i = 0; i < FAMILIEN_IDS.length; i++) if (FAMILIEN_IDS[i] !== basis) andere.push(FAMILIEN_IDS[i]);
  return andere[Math.min(andere.length - 1, Math.floor(r * andere.length))];
}


/* ==========================================================================
   Dublettenregister

   Eine Karte darf keine zwei "Steinfurt" tragen. Das Register merkt sich die
   vergebenen Namen sowie die Haeufigkeit jedes Bestimmungs- und Grundworts;
   letztere gehen als Strafe in die Gewichtung ein (siehe gewicht()) und
   sorgen dafuer, dass eine Karte nicht aus acht "-furt" besteht, obwohl sie
   viele Fluesse hat.
   ========================================================================== */
function neueVergabe() {
  return { namen: Object.create(null), stamm: Object.create(null),
    grund: Object.create(null), anzahl: 0, letzterStamm: "", letzterGrund: "" };
}

function merke(V, name) {
  V.namen[name.toLowerCase()] = true;
  if (V.letzterStamm) V.stamm[V.letzterStamm] = (V.stamm[V.letzterStamm] || 0) + 1;
  if (V.letzterGrund) V.grund[V.letzterGrund] = (V.grund[V.letzterGrund] || 0) + 1;
  V.letzterStamm = ""; V.letzterGrund = "";
  V.anzahl++;
}

/** Strom aus (Weltseed, Elementseed, Rolle, Index, Versuch). */
function textHash(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h | 0;
}
function stromFuer(worldSeed, seed, rolle, index, versuch) {
  var a = (worldSeed ^ Math.imul(seed | 0, 0x9e3779b1)) | 0;
  var b = (textHash(String(rolle || "")) ^ Math.imul((index | 0) + 1, 0xc2b2ae35)
    ^ Math.imul(versuch + 1, 0x27d4eb2f)) | 0;
  return rngOf((hashi(a, b, 0x5bf03635) * 4294967296) | 0);
}


/* ==========================================================================
   Einstieg
   ========================================================================== */

var ARTEN = ["ort", "fluss", "wald", "gebirge", "region", "gasthaus", "ranke", "see", "bruch"];

/**
 * Liefert einen Namen fuer ein Element an (x, z).
 *
 * @param art  ort | fluss | wald | gebirge | region | gasthaus | ranke | see | bruch
 * @param x,z  Position auf der Karte — sie bestimmt das Grundwort mit
 * @param seed Elementseed (bei "Neu wuerfeln" aendert er sich, der Name also auch)
 * @param opt  {
 *   worldSeed  Weltseed, Default S.worldSeed
 *   familie    Sprachfamilie erzwingen; sonst Kartenfamilie (+ Sprachgrenzen)
 *   fremd      false = keine Fremdnamen, die Kartenfamilie gilt ueberall
 *   index      laufende Nummer der Rolle (geht in den Schluessel)
 *   rolle      freier Bezeichner, trennt gleichseedige Rollen voneinander
 *   vergabe    Dublettenregister aus neueVergabe()
 *   elemente   Elementliste fuer die Lagemessung, Default S.elements
 *   lage       vorberechnete Lage (spart die Messung)
 *   korridor   false = Korridormaske nicht befragen (Weltgenerator)
 *   biom       Biom erzwingen, Default S.biom
 * }
 * @returns String
 */
function nameFuer(art, x, z, seed, opt) {
  opt = opt || {};
  if (ARTEN.indexOf(art) < 0) art = "ort";
  var worldSeed = (opt.worldSeed !== undefined ? opt.worldSeed : S.worldSeed) | 0;
  var V = opt.vergabe || neueVergabe();
  var L = opt.lage || lageAn(x, z, opt);

  var basis = opt.familie && FAMILIEN[opt.familie] ? opt.familie : familieDerKarte();
  var famId = art === "ranke" ? "arbor" : familieAn(x, z, basis, worldSeed, opt.fremd);
  var F = FAMILIEN[famId] || FAMILIEN.dorf;

  // Bis zu zehn Versuche gegen Dubletten. Jeder Versuch ist ein eigener,
  // deterministischer Strom — das Ergebnis haengt also nicht an der
  // Reihenfolge der Aufrufe, sondern nur daran, WELCHE Namen schon vergeben
  // sind. Genau das soll es auch: eine Karte ist als Ganzes reproduzierbar.
  var name = "";
  for (var versuch = 0; versuch < 10; versuch++) {
    var rng = stromFuer(worldSeed, seed, opt.rolle || art, opt.index, versuch);
    V.letzterStamm = ""; V.letzterGrund = "";
    if (art === "ort") name = ortsName(F, L, V, rng);
    else if (art === "ranke") name = rankenName(F, L, V, rng);
    else if (art === "gasthaus") name = gasthausName(F, rng);
    else name = naturName(F, art, L, V, rng);
    if (!V.namen[name.toLowerCase()]) { merke(V, name); return name; }
  }
  // Letzter Ausweg: Vorsilbe der Familie, dann Zaehlnachsatz. Beides ist in
  // echten Ortsnamen die uebliche Loesung fuer denselben Fall ("Ober-",
  // "Nieder-") und faellt deshalb nicht auf.
  var rngX = stromFuer(worldSeed, seed, opt.rolle || art, opt.index, 99);
  var vs = F.vorsilben ? waehleFlach(F.vorsilben, rngX) : "Alt";
  var kandidat = F.deutsch ? vs + "-" + name : vs + name;
  if (!V.namen[kandidat.toLowerCase()]) { merke(V, kandidat); return kandidat; }
  var ROEM = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  for (var r = 0; r < ROEM.length; r++) {
    var k2 = name + " " + ROEM[r];
    if (!V.namen[k2.toLowerCase()]) { merke(V, k2); return k2; }
  }
  merke(V, name);
  return name;
}

/**
 * Alle auf der Karte vergebenen Namen, in Reihenfolge, mit Dublettenmarke.
 * Quelle sind `el.params.name` und die Markertexte — beides Felder, die
 * ohnehin gespeichert werden.
 * @returns [{ name, was, ziel, art, dublette }]
 */
function sammleNamen(opt) {
  opt = opt || {};
  var els = opt.elemente || S.elements || [];
  var mk = opt.marker || S.marker || [];
  var out = [], zaehler = Object.create(null), i, n;
  for (i = 0; i < els.length; i++) {
    n = els[i].params && els[i].params.name;
    if (typeof n !== "string" || !n) continue;
    out.push({ name: n, was: els[i].kind + " · " + els[i].variant, ziel: els[i], art: "element" });
  }
  for (i = 0; i < mk.length; i++) {
    n = mk[i].text;
    if (typeof n !== "string" || !n) continue;
    out.push({ name: n, was: "Marker · " + mk[i].art, ziel: mk[i], art: "marker" });
  }
  for (i = 0; i < out.length; i++) {
    var k = out[i].name.toLowerCase();
    zaehler[k] = (zaehler[k] || 0) + 1;
  }
  for (i = 0; i < out.length; i++) out[i].dublette = zaehler[out[i].name.toLowerCase()] > 1;
  return out;
}

/** Zaehlt die Wortlisten durch — fuer Tests und den Bericht. */
function wortStatistik() {
  var out = {};
  for (var i = 0; i < FAMILIEN_IDS.length; i++) {
    var F = FAMILIEN[FAMILIEN_IDS[i]], natur = 0;
    for (var a in F.natur) natur += F.natur[a].length;
    out[F.id] = { bestimmung: F.bestimmung.length, grund: F.grund.length,
      natur: natur, adjektive: F.adjektive.length, wirt: F.wirt.length };
  }
  out.ranke = { grund: RANKE_GRUND.length, adjektive: RANKE_ADJ.length };
  return out;
}

export { nameFuer, sprachfamilien, familieDerKarte, setzeSprachfamilie, familieAn,
  neueVergabe, lageAn, beschreibeLage, sammleNamen, wortStatistik,
  FAMILIEN, FAMILIEN_IDS, ARTEN as NAMENS_ARTEN, LAGEN };
