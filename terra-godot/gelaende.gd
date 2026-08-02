# =============================================================================
# gelaende.gd — Hoehenfeld zu einem ArrayMesh
#
# Absichtlich schmucklos. Der Spike misst Ladegroesse, Bildrate und ob der
# Web-Export unter der Produktions-CSP ueberhaupt startet — dafuer braucht es
# ein Mesh in realistischer Groessenordnung, keinen Ghibli-Look. Terras
# Bildsprache (Godrays, Papierkante, Multiplane-Baender, gemalte Wasser-
# streifen) ist ausdruecklich NICHT Gegenstand dieses Spikes; sie liesse sich
# nicht portieren, sondern muesste neu hergeleitet werden.
#
# Ein Mesh statt Patches: Terra teilt das Terrain seit Runde H in 64er-Patches
# mit eigenen Detailstufen. Das ist eine Optimierung, die den VERGLEICH
# verfaelschen wuerde — gemessen werden soll, was die Engine mit derselben
# Dreieckslast tut, nicht wessen Culling besser ist.
# =============================================================================
class_name TerraGelaende

## Vertexfarbe nach Hoehe. Keine Textur, kein Shader — eine Farbrampe reicht,
## um zu sehen, ob das Feld ueberhaupt richtig ankommt (eine falsche Basis
## faellt als Rauschen statt als Landschaft sofort auf).
const FARBEN: Array[Color] = [
	Color(0.15, 0.28, 0.42),  # unter Wasser
	Color(0.76, 0.70, 0.52),  # Strand
	Color(0.35, 0.52, 0.28),  # Wiese
	Color(0.42, 0.38, 0.30),  # Fels
	Color(0.92, 0.93, 0.95),  # Schnee
]
const WASSER := 0.0


static func _farbe_bei(h: float, hoch: float) -> Color:
	if h < WASSER:
		return FARBEN[0]
	var t := clampf(h / maxf(hoch, 0.001), 0.0, 1.0)
	if t < 0.08:
		return FARBEN[1]
	if t < 0.45:
		return FARBEN[2].lerp(FARBEN[3], t / 0.45 * 0.35)
	if t < 0.8:
		return FARBEN[3]
	return FARBEN[3].lerp(FARBEN[4], (t - 0.8) / 0.2)


## Baut das Mesh. `feld` ist (groesse+1)^2 gross, zeilenweise.
static func baue(feld: PackedFloat32Array, groesse: int) -> ArrayMesh:
	var vw := groesse + 1
	var half := float(groesse) / 2.0

	var punkte := PackedVector3Array()
	var normalen := PackedVector3Array()
	var farben := PackedColorArray()
	punkte.resize(vw * vw)
	normalen.resize(vw * vw)
	farben.resize(vw * vw)

	var hoch := 0.0
	for h in feld:
		if h > hoch:
			hoch = h

	for j in vw:
		for i in vw:
			var idx := j * vw + i
			var h := feld[idx]
			punkte[idx] = Vector3(float(i) - half, h, float(j) - half)
			farben[idx] = _farbe_bei(h, hoch)

	# Normalen aus den Nachbarhoehen (zentrale Differenz, am Rand einseitig).
	# Billiger und ruhiger als Flaechennormalen zu mitteln.
	for j in vw:
		for i in vw:
			var links := feld[j * vw + maxi(i - 1, 0)]
			var rechts := feld[j * vw + mini(i + 1, vw - 1)]
			var vorne := feld[maxi(j - 1, 0) * vw + i]
			var hinten := feld[mini(j + 1, vw - 1) * vw + i]
			var dx := (rechts - links) / (2.0 if i > 0 and i < vw - 1 else 1.0)
			var dz := (hinten - vorne) / (2.0 if j > 0 and j < vw - 1 else 1.0)
			normalen[j * vw + i] = Vector3(-dx, 1.0, -dz).normalized()

	var indizes := PackedInt32Array()
	indizes.resize(groesse * groesse * 6)
	var n := 0
	for j in groesse:
		for i in groesse:
			var a := j * vw + i
			var b := a + 1
			var c := a + vw
			var d := c + 1
			indizes[n] = a; indizes[n + 1] = c; indizes[n + 2] = b
			indizes[n + 3] = b; indizes[n + 4] = c; indizes[n + 5] = d
			n += 6

	var flaechen := []
	flaechen.resize(Mesh.ARRAY_MAX)
	flaechen[Mesh.ARRAY_VERTEX] = punkte
	flaechen[Mesh.ARRAY_NORMAL] = normalen
	flaechen[Mesh.ARRAY_COLOR] = farben
	flaechen[Mesh.ARRAY_INDEX] = indizes

	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, flaechen)
	return mesh


## Wie viele Dreiecke das Mesh traegt — die Vergleichsgroesse gegen Terra.
static func dreiecke(groesse: int) -> int:
	return groesse * groesse * 2
