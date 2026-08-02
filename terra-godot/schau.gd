# =============================================================================
# schau.gd — die Messbuehne
#
# Laedt eine Terra-Kartendatei, rechnet das Hoehenfeld nach, baut das Mesh und
# dreht die Kamera darum. Mehr nicht: das hier ist ein Messgeraet, kein Editor.
#
# DIE BRUECKE ZUM MESSSKRIPT
#
# Der Web-Export legt seine Kennzahlen unter `window.__terraGodot` ab, damit
# das Playwright-Skript sie auslesen kann, ohne Pixel zu deuten:
#
#   bereit      true, sobald das Mesh steht (vorher ist jede fps-Zahl wertlos)
#   fps         gleitender Mittelwert
#   dreiecke    Dreieckslast, die Vergleichsgroesse gegen Terra
#   vertices    Eckpunkte
#   aufbauMs    wie lange Nachrechnen + Mesh gedauert haben
#   renderer    was die Engine tatsaechlich benutzt
#
# Ausserhalb des Browsers (Desktop, headless) faellt der Zweig still weg —
# `JavaScriptBridge` ist dort schlicht nicht verfuegbar.
# =============================================================================
extends Node3D

## Welche Karte gezeigt wird. `res://test/karte.json` wird beim Export
## mitgenommen; fehlt sie, entsteht eine Karte aus Seed und Biom unten.
const KARTE_PFAD := "res://test/karte.json"
const PROFILE_PFAD := "res://test/terrain.json"

## Rueckfall, wenn keine Kartendatei dabei ist. 256 ist Terras kleinste
## echte Kartengroesse — kleiner zu messen waere geschoent.
@export var seed_wert := 1337
@export var groesse := 256
@export var biom := "wiese"

var _fps := 0.0
var _dreiecke := 0
var _vertices := 0
var _aufbau_ms := 0
var _bereit := false
var _winkel := 0.0

@onready var _kamera: Camera3D = $Kamera
@onready var _anzeige: Label = $Schicht/Anzeige


func _ready() -> void:
	var start := Time.get_ticks_msec()

	var profile := _lies_profile()
	var karte := TerraKartenbaum.lies_datei(KARTE_PFAD)
	if karte == null:
		# Keine Datei dabei: eine Karte aus den Exportwerten bauen. Fuer die
		# Messung gleichwertig — der Rechenweg ist derselbe, nur das Delta fehlt.
		karte = TerraKartenbaum.Karte.new()
		karte.seed_wert = seed_wert
		karte.groesse = groesse
		karte.biom = biom
		karte.titel = "aus Seed %d (%s)" % [seed_wert, biom]

	var feld := TerraKartenbaum.hoehenfeld(karte, profile)
	var mesh := TerraGelaende.baue(feld, karte.groesse)

	var sicht := MeshInstance3D.new()
	sicht.mesh = mesh
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 0.9
	sicht.material_override = material
	add_child(sicht)

	_dreiecke = TerraGelaende.dreiecke(karte.groesse)
	_vertices = (karte.groesse + 1) * (karte.groesse + 1)
	_aufbau_ms = Time.get_ticks_msec() - start
	_bereit = true

	_kamera.position = Vector3(0, float(karte.groesse) * 0.45, float(karte.groesse) * 0.75)
	_kamera.look_at(Vector3.ZERO, Vector3.UP)

	print("Karte: %s | %d Dreiecke | Aufbau %d ms" % [karte.titel, _dreiecke, _aufbau_ms])
	_melde_an_js()


func _lies_profile() -> Dictionary:
	var datei := FileAccess.open(PROFILE_PFAD, FileAccess.READ)
	if datei == null:
		return {}
	var roh := datei.get_as_text()
	datei.close()
	var geparst: Variant = JSON.parse_string(roh)
	if typeof(geparst) != TYPE_DICTIONARY:
		return {}
	return geparst.get("profile", {})


func _process(delta: float) -> void:
	# Die Kamera dreht bewusst: eine stehende Szene misst nur das Neuzeichnen
	# eines unveraenderten Bildes und schmeichelt jeder Engine.
	_winkel += delta * 0.25
	var r := float(groesse) * 0.75
	_kamera.position = Vector3(sin(_winkel) * r, float(groesse) * 0.45, cos(_winkel) * r)
	_kamera.look_at(Vector3.ZERO, Vector3.UP)

	# Gleitender Mittelwert statt Momentanwert — der Momentanwert springt zu
	# stark, um zwei Engines damit zu vergleichen.
	var jetzt := Engine.get_frames_per_second()
	_fps = jetzt if _fps == 0.0 else _fps * 0.9 + float(jetzt) * 0.1

	_anzeige.text = "%d fps | %d Dreiecke | Aufbau %d ms" % [int(round(_fps)), _dreiecke, _aufbau_ms]
	_melde_an_js()


## Kennzahlen an die umgebende Seite melden.
##
## ZWEI WEGE, UND DER UNTERSCHIED IST SICHERHEITSRELEVANT
##
## Godot kennt zwei Arten, aus dem Web-Export heraus mit der Seite zu reden:
##
##   JavaScriptBridge.eval()           fuehrt einen String als JavaScript aus.
##                                     Braucht `'unsafe-eval'` in der CSP —
##                                     also die breite, gefaehrliche Freigabe.
##   JavaScriptBridge.get_interface()  greift ueber die Emscripten-Bruecke auf
##                                     ein bestehendes Objekt zu, ohne einen
##                                     String zu uebersetzen.
##
## Welcher Weg unter `'wasm-unsafe-eval'` allein traegt, entscheidet, ob eine
## Godot-Fassung von Terra mit einer SCHMALEN CSP-Aenderung auskaeme oder eine
## BREITE braeuchte. Deshalb wird hier zuerst der Objektweg versucht und nur
## vermerkt, ob er funktioniert hat — nicht auf eval zurueckgefallen.
func _melde_an_js() -> void:
	if not OS.has_feature("web"):
		return
	var fenster := JavaScriptBridge.get_interface("window")
	if fenster == null:
		return
	fenster.__terraGodotBereit = _bereit
	fenster.__terraGodotFps = _fps
	fenster.__terraGodotDreiecke = _dreiecke
	fenster.__terraGodotVertices = _vertices
	fenster.__terraGodotAufbauMs = _aufbau_ms
	fenster.__terraGodotRenderer = RenderingServer.get_video_adapter_name()
