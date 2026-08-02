# =============================================================================
# bank.gd — Rechenzeit des portierten Generators
#
# Die Paritaetspruefungen sagen, dass GDScript dasselbe RECHNET. Sie sagen
# nichts darueber, wie lange es dafuer braucht — und genau das ist die zweite
# Frage des Spikes.
#
# Gemessen wird `TerraHoehen.basis` allein, ohne Mesh-Aufbau: das ist der Teil,
# den ein zweiter Renderer bei JEDEM Kartenladen ausfuehren muss, weil das
# Format seit v3 nur das Delta speichert. Er ist damit nicht optional und nicht
# in den Hintergrund zu schieben.
#
# Vergleichswert aus Terra (dieselbe Maschine):
#   node -e "genBaseIn(neu Float32Array(257*257), 1337, 256, 'wiese')"
#
# Aufruf:
#   <godot> --headless --path terra-godot --script res://test/bank.gd
# =============================================================================
extends SceneTree

const LAEUFE := 3
const GROESSEN := [64, 128, 256]


func _initialize() -> void:
	var datei := FileAccess.open("res://test/terrain.json", FileAccess.READ)
	var profile := {}
	if datei != null:
		var geparst: Variant = JSON.parse_string(datei.get_as_text())
		datei.close()
		if typeof(geparst) == TYPE_DICTIONARY:
			profile = geparst.get("profile", {})

	var profil := TerraHoehen.profil_aus(profile, "wiese")

	print("Rechenzeit von TerraHoehen.basis (Biom wiese, %d Laeufe je Groesse)" % LAEUFE)
	print("")
	print("  Kante   Zellen      je Lauf")

	for g in GROESSEN:
		var groesse: int = g
		# Einmal warmlaufen — der erste Lauf traegt Aufloesungskosten, die
		# nichts mit der Rechnung zu tun haben.
		TerraHoehen.basis(1337, groesse, profil)

		var start := Time.get_ticks_usec()
		for i in LAEUFE:
			TerraHoehen.basis(1337 + i, groesse, profil)
		var dauer := float(Time.get_ticks_usec() - start) / float(LAEUFE) / 1000.0

		var vw := groesse + 1
		print("  %5d   %7d   %8.1f ms" % [groesse, vw * vw, dauer])

	print("")
	print("Renderer: %s" % RenderingServer.get_video_adapter_name())
	quit(0)
