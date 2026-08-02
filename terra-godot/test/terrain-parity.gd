# =============================================================================
# terrain-parity.gd — Paritaet des BASISTERRAINS
#
# parity.gd beweist, dass die Zufallsprimitive bitweise stimmen. Das ist die
# Voraussetzung, nicht die Zusage. Hier wird die Zusage selbst geprueft: kommt
# aus `hoehen.gd` dasselbe Hoehenfeld heraus wie aus Terras `genBaseIn`?
#
# Nur wenn ja, kann Godot eine Terra-Kartendatei ueberhaupt oeffnen — denn seit
# Format v3 steht in der Datei ausschliesslich das Delta gegen dieses Feld.
# Weicht die Basis ab, ergibt das Delta eine andere Welt, ohne dass irgendwo
# ein Fehler auftaucht.
#
# Verglichen wird bitweise ueber die Rohbytes des Float32-Feldes.
#
# Aufruf:
#   <godot> --headless --path terra-godot --script res://test/terrain-parity.gd
# =============================================================================
extends SceneTree

const REFERENZ := "res://test/terrain.json"

var _faelle := 0
var _fehler := 0


func _initialize() -> void:
	var datei := FileAccess.open(REFERENZ, FileAccess.READ)
	if datei == null:
		printerr("Referenz nicht lesbar: %s" % REFERENZ)
		printerr("Erst erzeugen: node terra-godot/werkzeug/terrain-dump.mjs > terra-godot/test/terrain.json")
		quit(2)
		return
	var roh := datei.get_as_text()
	datei.close()

	var ref: Variant = JSON.parse_string(roh)
	if typeof(ref) != TYPE_DICTIONARY:
		printerr("Referenz ist kein Objekt — beschaedigt?")
		quit(2)
		return

	var profile: Dictionary = ref["profile"]
	print("Terrain-Paritaet gegen %s" % ref.get("quelle", "?"))
	print("%d Biomprofile geladen, Vergleich bitweise ueber die Float32-Rohbytes." % profile.size())
	print("")

	for fall in ref["faelle"]:
		_pruefe(fall, profile)

	print("")
	if _fehler == 0:
		print("TERRAIN-PARITAET BESTAETIGT — %d Faelle, alle Felder bitweise gleich." % _faelle)
		print("Godot rechnet Terras Basisterrain exakt nach; v3-Deltas landen richtig.")
		quit(0)
	else:
		print("TERRAIN-PARITAET VERFEHLT — %d von %d Faellen weichen ab." % [_fehler, _faelle])
		quit(1)


func _pruefe(fall: Dictionary, profile: Dictionary) -> void:
	_faelle += 1
	var biom := String(fall["biom"])
	var seed_wert := int(fall["seed"])
	var groesse := int(fall["groesse"])
	var kennung := "%s seed=%d groesse=%d" % [biom, seed_wert, groesse]

	var erwartet_bytes := Marshalls.base64_to_raw(String(fall["f32"]))
	var erwartet := erwartet_bytes.to_float32_array()

	var profil := TerraHoehen.profil_aus(profile, biom)
	var bekommen := TerraHoehen.basis(seed_wert, groesse, profil)

	if erwartet.size() != bekommen.size():
		_fehler += 1
		print("  FEHLER  %s — Feldgroesse %d statt %d" % [kennung, bekommen.size(), erwartet.size()])
		return

	# Bitweise: die Rohbytes vergleichen, nicht die Zahlen. Ein NaN waere sich
	# selbst ungleich, und ein Vorzeichen-Null-Unterschied faellt sonst durch.
	var abweichungen := 0
	var erste := -1
	for i in erwartet.size():
		if erwartet[i] != bekommen[i]:
			abweichungen += 1
			if erste < 0:
				erste = i

	if abweichungen == 0:
		print("  ok      %s — %d Werte" % [kennung, erwartet.size()])
	else:
		_fehler += 1
		print(
			"  FEHLER  %s — %d von %d Werten weichen ab, erste bei Index %d (%.10f statt %.10f)"
			% [kennung, abweichungen, erwartet.size(), erste, bekommen[erste], erwartet[erste]]
		)
