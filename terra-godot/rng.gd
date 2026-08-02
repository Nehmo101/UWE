# =============================================================================
# rng.gd — Portierung von terra/src/core/rng.js nach GDScript
#
# WARUM DAS HIER DIE HEIKELSTE DATEI DES SPIKES IST
#
# Seit Format v3 speichert Terra nur das Delta gegen das aus dem Seed
# erzeugte Terrain (terra/src/editor/io.js:115). Die Basis wird nachgerechnet.
# Wer dieselbe Kartendatei in einer zweiten Engine lesen will, muss diesen
# Kern deshalb BIT-GENAU reproduzieren. Eine Abweichung erzeugt keine
# Fehlermeldung und kein leeres Bild — sie erzeugt eine ANDERE WELT, auf die
# dann das Delta einer fremden Karte gerechnet wird.
#
# VIER JS-SEMANTIKEN, DIE GDScript NICHT VON SELBST HAT
#
# 1. `Math.imul(a, b)` ist eine 32-Bit-Multiplikation. GDScript rechnet mit
#    64 Bit. Das Produkt zweier 32-Bit-Zahlen ist bis zu 1,8e19 gross und
#    sprengt den int64-Bereich (9,2e18) — der naive Weg `(a * b) & MASKE`
#    haengt also am Ueberlaufverhalten. Statt darauf zu bauen, wird die
#    Multiplikation unten in zwei 16-Bit-Haelften zerlegt. Kein Ueberlauf,
#    kein Vertrauen in undokumentiertes Verhalten.
#
# 2. `x | 0` ist ToInt32 — Abschneiden auf 32 Bit MIT Vorzeichen. In GDScript
#    liefert `x & 0xFFFFFFFF` auf einer negativen Zahl genau die gesuchten
#    unteren 32 Bit im Zweierkomplement.
#
# 3. `>>>` ist die LOGISCHE Verschiebung. Alle Werte werden hier durchgaengig
#    als vorzeichenlose 32-Bit-Zahlen (0 .. 0xFFFFFFFF) gefuehrt, damit der
#    gewoehnliche `>>` bereits logisch wirkt.
#
# 4. `a + b` auf zwei int32 ergibt in JS einen Double, der erst durch das
#    folgende `^` wieder auf 32 Bit gestutzt wird. Die Summe darf also
#    zwischenzeitlich ueber 32 Bit hinauswachsen — deshalb steht die Maske in
#    mulberry32 GENAU dort, wo JS sie implizit setzt, und keine Zeile frueher.
#
# Geprueft wird das nicht durch Hinsehen, sondern gegen Referenzwerte aus der
# echten rng.js: test/parity.gd gegen test/golden.json.
# =============================================================================
class_name TerraRng

const MASKE := 0xFFFFFFFF
const ZWEI_HOCH_32 := 4294967296.0

## 32-Bit-Multiplikation wie `Math.imul`, ueberlaufsicher ueber 16-Bit-Haelften.
##
## (hi * 2^16 + lo) * b  mod 2^32  =  (lo * b + ((hi * b) mod 2^16) * 2^16) mod 2^32
##
## `lo * b` bleibt bei <= 0xFFFF * 0xFFFFFFFF rund 2,8e14 — weit im sicheren
## Bereich. Der hohe Teil wird VOR dem Verschieben maskiert, weil alles
## jenseits von Bit 31 ohnehin herausfaellt.
static func imul(a: int, b: int) -> int:
	a &= MASKE
	b &= MASKE
	var lo := a & 0xFFFF
	var hi := (a >> 16) & 0xFFFF
	return ((lo * b) + (((hi * b) & 0xFFFF) << 16)) & MASKE

## Integer-Hash -> 0..1. Grundlage fuer alles Zufaellige (rng.js:12-18).
static func hashi(x: int, y: int, s: int) -> float:
	var h := imul(x, 0x27d4eb2d) ^ imul(y, 0x165667b1) ^ imul(s, 0x9e3779b1)
	h ^= h >> 15
	h = imul(h, 0x85ebca6b)
	h ^= h >> 13
	h = imul(h, 0xc2b2ae35)
	h ^= h >> 16
	return float(h & MASKE) / ZWEI_HOCH_32

## Geglaettetes 2D-Value-Noise, bilinear + Smoothstep (rng.js:21-29).
##
## `floor` statt Abschneiden ist hier tragend: JS `Math.floor(-0.5)` ist -1,
## eine Abschneidung nach null waere 0 — die gesamte negative Kartenhaelfte
## laege um eine Zelle daneben.
static func vnoise(x: float, z: float, s: int) -> float:
	var xi := int(floor(x))
	var zi := int(floor(z))
	var fx := x - float(xi)
	var fz := z - float(zi)
	fx = fx * fx * (3.0 - 2.0 * fx)
	fz = fz * fz * (3.0 - 2.0 * fz)
	var a := hashi(xi, zi, s)
	var b := hashi(xi + 1, zi, s)
	var c := hashi(xi, zi + 1, s)
	var d := hashi(xi + 1, zi + 1, s)
	var ab := a + (b - a) * fx
	var cd := c + (d - c) * fx
	return ab + (cd - ab) * fz

## Fraktales Rauschen ueber `oct` Oktaven, Rueckgabe 0..1 (rng.js:36-46).
static func fractal(x: float, z: float, s: int, oct: int = 4) -> float:
	if oct == 0:
		oct = 4
	var sum := 0.0
	var amp := 1.0
	var norm := 0.0
	var f := 1.0
	for i in oct:
		sum += vnoise(x * f, z * f, (s + i * 1013) & MASKE) * amp
		norm += amp
		amp *= 0.5
		f *= 2.0
	var v := sum / norm
	v = v * v * (3.0 - 2.0 * v)
	return clampf((v - 0.5) * 1.4 + 0.5, 0.0, 1.0)

## Smoothstep zwischen zwei Kanten; e1 darf kleiner als e0 sein (rng.js:5-8).
static func sstep(e0: float, e1: float, x: float) -> float:
	var t := clampf((x - e0) / (e1 - e0), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


# =============================================================================
# Deterministischer Zufallsstrom (mulberry32, rng.js:49-57).
#
# Zustandsbehaftet: ein einziger Schritt daneben, und ab da stimmt nichts mehr.
# Deshalb als eigene Instanz statt als statische Funktion — der Zustand soll
# sichtbar irgendwo wohnen und nicht versehentlich geteilt werden.
# =============================================================================
class Strom:
	var _a: int

	func _init(seed_wert: int) -> void:
		_a = seed_wert & MASKE

	## Naechster Wert aus dem Strom, 0..1.
	func naechster() -> float:
		_a = (_a + 0x6d2b79f5) & MASKE
		var t := TerraRng.imul(_a ^ (_a >> 15), 1 | _a)
		# Die Maske steht hier, weil JS die Summe erst durch das folgende `^`
		# auf 32 Bit stutzt — nicht schon bei der Addition.
		t = (((t + TerraRng.imul(t ^ (t >> 7), 61 | t)) & MASKE) ^ t) & MASKE
		return float((t ^ (t >> 14)) & MASKE) / TerraRng.ZWEI_HOCH_32

static func strom_von(seed_wert: int) -> Strom:
	return Strom.new(seed_wert)
