# =============================================================================
# parity.gd — Determinismus-Paritaet gegen Terras echten RNG
#
# Das Abbruchkriterium des Spikes. Reproduziert die GDScript-Portierung
# (rng.gd) die Werte aus terra/src/core/rng.js nicht exakt, dann kann Godot
# Terras Kartenformat nicht lesen — denn seit v3 steht in der Datei nur das
# Delta gegen ein nachgerechnetes Terrain. Dann endet der Spike hier, und das
# ist ein gutes Ergebnis: die teure Erkenntnis kommt billig.
#
# WARUM BITMUSTER STATT ZAHLEN
#
# Der erste Anlauf verglich die Dezimaldarstellungen aus dem JSON und meldete
# 199 Abweichungen — bei einer groessten Abweichung von 1,1e-16, also exakt
# einem ULP. Nicht der Zufallskern lag daneben, sondern Godots JSON-Leser gibt
# das letzte Bit eines Double nicht zurueck. Der Test mass den Parser.
#
# Deshalb traegt jeder Referenzwert im Golden-Dump zusaetzlich sein
# IEEE-754-Bitmuster (Feld `b`, 16 Hex-Zeichen, little endian). Das wird hier
# ueber `PackedByteArray.decode_double()` zurueckgelesen — Byte fuer Byte
# dasselbe Double, das Node erzeugt hat. Erst damit prueft dieser Test das,
# was er behauptet: bitweise Gleichheit, ohne Toleranz.
#
# Aufruf (aus dem Repo-Wurzelverzeichnis):
#   <godot> --headless --path terra-godot --script res://test/parity.gd
# =============================================================================
extends SceneTree

const GOLDEN := "res://test/golden.json"

var _geprueft := 0
var _fehler := 0
var _max_abw := 0.0
var _erste_fehler: Array[String] = []


## Ein Double aus seinem IEEE-754-Bitmuster (little endian, 16 Hex-Zeichen).
static func double_von_bits(hex: String) -> float:
	var rohe := PackedByteArray()
	rohe.resize(8)
	for i in 8:
		rohe[i] = hex.substr(i * 2, 2).hex_to_int()
	return rohe.decode_double(0)


func _melde(gruppe: String, beschreibung: String, erwartet: float, bekommen: float) -> void:
	_geprueft += 1
	# NaN ist sich selbst ungleich (IEEE 754). Beide Seiten NaN heisst aber:
	# beide rechnen dieselbe entartete Eingabe gleich falsch, und genau das
	# ist hier die gesuchte Uebereinstimmung. Der Fall tritt real auf —
	# `sstep(5, 5, 5)` teilt durch null, in JS wie in GDScript.
	if is_nan(erwartet) and is_nan(bekommen):
		return
	var abw := absf(erwartet - bekommen)
	if abw > _max_abw:
		_max_abw = abw
	if erwartet != bekommen:
		_fehler += 1
		if _erste_fehler.size() < 10:
			_erste_fehler.append(
				"  %s  %s\n      erwartet %.20f\n      bekommen %.20f" % [gruppe, beschreibung, erwartet, bekommen]
			)


func _initialize() -> void:
	var datei := FileAccess.open(GOLDEN, FileAccess.READ)
	if datei == null:
		printerr("Golden-Dump nicht lesbar: %s" % GOLDEN)
		printerr("Erst erzeugen: node terra-godot/werkzeug/golden-dump.mjs > terra-godot/test/golden.json")
		quit(2)
		return
	var roh := datei.get_as_text()
	datei.close()

	var golden: Variant = JSON.parse_string(roh)
	if typeof(golden) != TYPE_DICTIONARY:
		printerr("Golden-Dump ist kein Objekt — beschaedigt?")
		quit(2)
		return

	print("Paritaetspruefung gegen %s" % golden.get("quelle", "?"))
	print("Vergleich bitweise ueber IEEE-754-Muster, keine Toleranz.")
	print("")

	_pruefe_hashi(golden["hashi"])
	_pruefe_vnoise(golden["vnoise"])
	_pruefe_fractal(golden["fractal"])
	_pruefe_rng(golden["rng"])
	_pruefe_hilfen(golden["hilfen"])

	print("")
	if _fehler == 0:
		print("PARITAET BESTAETIGT — %d Werte, alle bitweise gleich." % _geprueft)
		print("Godot kann Terras Basis-Terrain bit-genau nachrechnen.")
		quit(0)
	else:
		print("PARITAET VERFEHLT — %d von %d Werten weichen ab." % [_fehler, _geprueft])
		print("Groesste Abweichung: %.20f" % _max_abw)
		print("")
		print("Erste Faelle:")
		for z in _erste_fehler:
			print(z)
		quit(1)


func _pruefe_hashi(werte: Array) -> void:
	for e in werte:
		var x := int(e["x"])
		var y := int(e["y"])
		var s := int(e["s"])
		_melde("hashi", "x=%d y=%d s=%d" % [x, y, s], double_von_bits(e["b"]), TerraRng.hashi(x, y, s))
	print("hashi     %d Werte" % werte.size())


func _pruefe_vnoise(werte: Array) -> void:
	for e in werte:
		var x := double_von_bits_oder_zahl(e, "x")
		var z := double_von_bits_oder_zahl(e, "z")
		var s := int(e["s"])
		_melde("vnoise", "x=%f z=%f s=%d" % [x, z, s], double_von_bits(e["b"]), TerraRng.vnoise(x, z, s))
	print("vnoise    %d Werte" % werte.size())


func _pruefe_fractal(werte: Array) -> void:
	for e in werte:
		var x := double_von_bits_oder_zahl(e, "x")
		var z := double_von_bits_oder_zahl(e, "z")
		var s := int(e["s"])
		var okt := int(e["okt"])
		_melde(
			"fractal",
			"x=%f z=%f s=%d okt=%d" % [x, z, s, okt],
			double_von_bits(e["b"]),
			TerraRng.fractal(x, z, s, okt)
		)
	print("fractal   %d Werte" % werte.size())


func _pruefe_rng(stroeme: Array) -> void:
	var anzahl := 0
	for strom_daten in stroeme:
		var seed_wert := int(strom_daten["seed"])
		var strom := TerraRng.strom_von(seed_wert)
		var werte: Array = strom_daten["werte"]
		for i in werte.size():
			_melde(
				"rngOf",
				"seed=%d schritt=%d" % [seed_wert, i],
				double_von_bits(werte[i]["b"]),
				strom.naechster()
			)
			anzahl += 1
	print("rngOf     %d Werte in %d Stroemen" % [anzahl, stroeme.size()])


func _pruefe_hilfen(werte: Array) -> void:
	for e in werte:
		var art := String(e["art"])
		var a: float = e["a"]
		var e1: float = e["e1"]
		var x: float = e["x"]
		var bekommen := 0.0
		match art:
			"sstep":
				bekommen = TerraRng.sstep(a, e1, x)
			"clamp":
				bekommen = clampf(x, a, e1)
			"lerp":
				bekommen = a + (e1 - a) * x
			_:
				continue
		_melde(art, "a=%f b=%f x=%f" % [a, e1, x], double_von_bits(e["b"]), bekommen)
	print("hilfen    %d Werte" % werte.size())


## Die Eingabekoordinaten stehen als gewoehnliche JSON-Zahlen im Dump. Sie sind
## bewusst so gewaehlt, dass sie in einem Double exakt darstellbar sind
## (Zweierpotenz-Brueche wie 7.3125) — bis auf zwei Ausreisser (63.4, -0.0001),
## die Terras Generator so aber auch nie erzeugt. Ein eigener Bit-Kanal fuer die
## EINGABEN waere Aufwand ohne Ertrag: weicht die Eingabe ab, faellt es an der
## Ausgabe sofort auf.
func double_von_bits_oder_zahl(eintrag: Dictionary, feld: String) -> float:
	return float(eintrag[feld])
