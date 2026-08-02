# =============================================================================
# kartenbaum.gd — minimaler Leser fuer Terras Kartendateien
#
# BEWUSST NUR SO VIEL, WIE DIE MESSUNG BRAUCHT
#
# Terras echter Leser (terra/src/world/kartenbaum.js, 1.424 Zeilen) baut den
# vollen Baum: Elternverweise, Zyklenerkennung, Erbfelder, Ausschnitte,
# Massstaebe, Warnungen. Davon braucht ein Messspike nichts. Hier wird nur
# geholt, was fuer EIN Hoehenfeld noetig ist — Seed, Kartengroesse, Biom und
# das Hoehendelta.
#
# Wer daraus einen echten Leser machen will, faengt nicht hier an, sondern bei
# `leseBaumDatei` in der Quelle. Diese Datei ist ausdruecklich kein Anfang
# davon.
#
# ZWEI DATEIFORMEN, EIN ERGEBNIS
#
#   v1..v4  Eine einzelne Karte. Die Felder stehen direkt im Wurzelobjekt.
#   v5      `karten[]` mit Elternverweisen. Seed, Kartengroesse und
#           Hoehendelta sind laut `NICHT_ERBFELDER`
#           (kartenbaum.js:128) je Karte eigen — also am Karteneintrag selbst,
#           nicht geerbt. Genommen wird die Wurzel (elternId == null).
# =============================================================================
class_name TerraKartenbaum

## Was der Spike aus einer Kartendatei braucht.
class Karte:
	var titel := "Karte"
	var seed_wert := 0
	var groesse := 256
	var biom := "wiese"
	## Flaches Paar-Array [Index, Wert, ...] (v3+) — leer bei v1/v2.
	var hoehen_delta: Array = []
	## Vollarray (v1/v2). Leer, wenn die Datei ein Delta traegt.
	var hoehen_voll: Array = []
	var format_version := 0


## Liest eine Kartendatei und liefert die Wurzelkarte. `null` bei Unlesbarem.
static func lies(daten: Variant) -> Karte:
	if typeof(daten) != TYPE_DICTIONARY:
		return null
	var wurzel: Dictionary = daten

	# v5: aus `karten[]` die Wurzel suchen. Faellt keine mit elternId == null
	# an, wird die erste genommen — der echte Leser loest das ueber
	# Zyklenerkennung, hier reicht "irgendeine Karte" fuer eine Messung.
	if daten.has("karten") and typeof(daten["karten"]) == TYPE_ARRAY:
		var karten: Array = daten["karten"]
		if karten.is_empty():
			return null
		wurzel = karten[0]
		for k in karten:
			if typeof(k) == TYPE_DICTIONARY and k.get("elternId", null) == null:
				wurzel = k
				break

	var out := Karte.new()
	out.format_version = int(daten.get("version", 1))
	out.titel = String(wurzel.get("titel", daten.get("titel", "Karte")))
	out.seed_wert = int(wurzel.get("seed", daten.get("seed", 0)))
	# v4 fuehrte `kartenGroesse` ein. Fehlt das Feld, ist die Datei eine 256er —
	# fuer jede solche Datei stimmt das exakt (terra/src/editor/io.js:457-459).
	out.groesse = int(wurzel.get("kartenGroesse", daten.get("kartenGroesse", 256)))
	out.biom = String(wurzel.get("biom", daten.get("biom", "wiese")))

	var delta: Variant = wurzel.get("hoehenDelta", daten.get("hoehenDelta", null))
	if typeof(delta) == TYPE_ARRAY:
		out.hoehen_delta = delta
	var voll: Variant = wurzel.get("hoehen", daten.get("hoehen", null))
	if typeof(voll) == TYPE_ARRAY:
		out.hoehen_voll = voll

	return out


## Kartendatei von einem Pfad lesen (res:// oder user://).
static func lies_datei(pfad: String) -> Karte:
	var datei := FileAccess.open(pfad, FileAccess.READ)
	if datei == null:
		return null
	var roh := datei.get_as_text()
	datei.close()
	return lies(JSON.parse_string(roh))


## Fertiges Hoehenfeld einer Karte: Basisterrain nachrechnen, Delta darauflegen.
##
## Genau hier zahlt sich die Paritaetspruefung aus — ohne sie waere `basis`
## eine ANDERE Welt und das Delta landete daneben, ohne dass es auffiele.
static func hoehenfeld(karte: Karte, profile: Dictionary) -> PackedFloat32Array:
	var profil := TerraHoehen.profil_aus(profile, karte.biom)
	var feld := TerraHoehen.basis(karte.seed_wert, karte.groesse, profil)

	# v1/v2 tragen das volle Feld und ersetzen die Basis komplett.
	if not karte.hoehen_voll.is_empty():
		var n := mini(karte.hoehen_voll.size(), feld.size())
		for i in n:
			feld[i] = float(karte.hoehen_voll[i])
		return feld

	TerraHoehen.delta_anwenden(feld, karte.hoehen_delta)
	return feld
