# =============================================================================
# hoehen.gd — Portierung von `genBaseIn` (terra/src/world/terrain.js:169)
#
# Das ist das Feld, gegen das Terra seit Format v3 sein Delta rechnet. Wer
# eine Terra-Kartendatei in einer zweiten Engine oeffnen will, braucht genau
# dieses Feld — nicht ein aehnliches.
#
# DIE RUNDUNG IST TRAGEND
#
# Gerechnet wird in Double, GESPEICHERT wird in 32 Bit: Terras Zielfeld ist
# ein `Float32Array` (terra/src/editor/io.js:454). Wer in GDScript mit
# `PackedFloat64Array` arbeitet, bekommt ein Feld, das dem Original nur
# aehnelt — und ein Delta, das daneben liegt. Deshalb `PackedFloat32Array`,
# und zwar erst GANZ AM ENDE der Rechnung, nicht zwischendurch.
#
# DIE PROFILE KOMMEN AUS DER QUELLE, NICHT AUS DER HAND
#
# Die 26 Biom-Hoehenprofile werden nicht hier abgeschrieben, sondern aus
# `core/store.js` ausgelesen und als `test/terrain.json` mitgeliefert
# (terra-godot/werkzeug/terrain-dump.mjs). Abgeschriebene Tabellen laufen
# auseinander; ausgelesene nicht.
# =============================================================================
class_name TerraHoehen

## Standardprofil aus core/store.js (HOEHEN_STANDARD). Dient nur als Rueckfall,
## wenn keine Profiltabelle geladen wurde — der Normalweg ist `profil_aus`.
const STANDARD := {
	"amp": 26.0, "fein": 4.0, "sockel": -6.0,
	"randTiefe": -22.0, "randBreite": 55.0,
	"grat": 0.0, "stufe": 0.0, "stufeKante": 0.8, "senken": 0.0,
}


## Ein Profil aus einer geladenen Tabelle holen, fehlende Felder aus STANDARD.
static func profil_aus(tabelle: Dictionary, biom: String) -> Dictionary:
	var roh: Dictionary = tabelle.get(biom, {})
	var out := {}
	for k in STANDARD:
		out[k] = float(roh.get(k, STANDARD[k]))
	return out


## Basisterrain wie `genBaseIn`. Rueckgabe ist (groesse+1)^2 gross, zeilenweise.
##
## Die Reihenfolge der Rechenschritte ist die aus terrain.js — jede Umstellung,
## und sei sie mathematisch gleichwertig, kann in Fliesskomma ein anderes
## letztes Bit ergeben. Deshalb steht hier nichts "aufgeraeumt".
static func basis(seed_wert: int, groesse: int, profil: Dictionary) -> PackedFloat32Array:
	var map_l := groesse
	var vw_l := map_l + 1
	var half_l := float(map_l) / 2.0

	var amp: float = profil["amp"]
	var fein: float = profil["fein"]
	var sockel: float = profil["sockel"]
	var rand_tiefe: float = profil["randTiefe"]
	var grat: float = profil["grat"]
	var stufe: float = profil["stufe"]
	var stufe_kante: float = profil["stufeKante"]
	var senken: float = profil["senken"]

	# randBreite 0 hiesse "Abrisskante ohne Uebergang"; sstep teilt durch
	# (e1 - e0). Terra setzt deshalb einen Winzigwert statt einer
	# Fallunterscheidung in der inneren Schleife — Zeile fuer Zeile uebernommen,
	# damit auch dieser Grenzfall dasselbe Ergebnis hat.
	var rand_breite: float = profil["randBreite"]
	if rand_breite <= 0.0:
		rand_breite = 1e-6

	var ziel := PackedFloat32Array()
	ziel.resize(vw_l * vw_l)

	for j in vw_l:
		for i in vw_l:
			var x := float(i) - half_l
			var z := float(j) - half_l
			var h := (
				TerraRng.fractal(x * 0.006, z * 0.006, seed_wert) * amp
				+ TerraRng.fractal(x * 0.03, z * 0.03, seed_wert + 77) * fein
				+ sockel
			)
			# Grate: invertiertes Rauschen schaerft Kaemme statt Kuppen.
			# `grat` ist RELATIV zu amp — der Biomkatalog nennt Bruchteile.
			if grat != 0.0:
				var rg := TerraRng.fractal(x * 0.011, z * 0.011, seed_wert + 211)
				h += (1.0 - absf(rg * 2.0 - 1.0)) * grat * amp
			# Terrassen: Hoehe aufs Raster ziehen, `stufeKante` haertet die Wange.
			if stufe != 0.0:
				h = lerpf(h, roundf(h / stufe) * stufe, stufe_kante)
			# Senken/Dolinen: nur die obersten Rauschwerte reissen ein Loch.
			if senken != 0.0:
				h -= TerraRng.sstep(0.62, 1.0, TerraRng.fractal(x * 0.045, z * 0.045, seed_wert + 311)) * senken
			# Rand auf randTiefe ziehen.
			var d := float(mini(mini(i, j), mini(map_l - i, map_l - j)))
			h = lerpf(rand_tiefe, h, TerraRng.sstep(0.0, rand_breite, d))
			ziel[j * vw_l + i] = h

	return ziel


## v3-Hoehendelta auf ein Basisfeld legen (terra/src/editor/io.js:140).
##
## Flaches Paar-Array [Index, Wert, Index, Wert, ...]. Indizes ausserhalb des
## Feldes werden uebersprungen statt zu werfen: eine Karte, die fuer eine
## groessere Kantenlaenge gespeichert wurde, soll lesbar bleiben.
static func delta_anwenden(feld: PackedFloat32Array, delta: Array) -> void:
	var k := 0
	while k + 1 < delta.size():
		var idx := int(delta[k])
		if idx >= 0 and idx < feld.size():
			feld[idx] = float(delta[k + 1])
		k += 2
