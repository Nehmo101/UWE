"""Deterministischer, headless Blender-Einstieg fuer Terra-Kandidaten."""
import argparse
import json
import math
import os
import sys

import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from conifer_asset import stylized_conifer

from mathutils import Vector


def arguments():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--brief", required=True)
    parser.add_argument("--variant", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(values)


def material(name, color, roughness=0.82):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.roughness = roughness
    return mat


def ellipsoid(name, location, scale, mat, segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=16, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def tapered_branch(name, start, end, radius_start, radius_end, mat, vertices=7):
    """Low-poly Ast zwischen zwei Punkten; reproduzierbar und ohne Modifier."""
    direction = Vector(end) - Vector(start)
    midpoint = (Vector(start) + Vector(end)) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_start,
        radius2=radius_end,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.data.materials.append(mat)
    return obj


def canopy_cluster(name, location, scale, mat, rotation=0.0):
    """Facettierte Blattwolke: malerisch in der Naehe, ruhig in der Ferne."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = (rotation * 0.37, rotation * 0.19, rotation)
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj

def canopy_fan(name, location, scale, mat, rotation=0.0):
    """Flache, gezackte Blattfahne fuer eine klare Wind-Silhouette."""
    segments = 10
    profile = (1.00, .88, 1.08, .82, 1.04, .90, 1.10, .84, 1.03, .89)
    vertices = [(0, -.24, 0), (0, .24, 0)]
    for index in range(segments):
        angle = math.tau * index / segments
        radius = profile[index]
        x = math.cos(angle) * radius
        z = math.sin(angle) * radius * (.78 if math.sin(angle) >= 0 else .58)
        vertices.extend(((x, -.24, z), (x, .24, z)))
    faces = []
    for index in range(segments):
        nxt = (index + 1) % segments
        front, back = 2 + index * 2, 3 + index * 2
        next_front, next_back = 2 + nxt * 2, 3 + nxt * 2
        faces.extend(((0, front, next_front), (1, next_back, back),
                      (front, back, next_back, next_front)))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = (rotation * .12, rotation * -.08, rotation)
    obj.scale = scale
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for polygon in mesh.polygons:
        polygon.use_smooth = False
    return obj



def leaf_blade(name, location, scale, mat, rotation=0.0):
    """Duennes, geschlossenes Blatt mit klarer Spitze statt Alpha-Karte."""
    vertices = [
        (-1, 0, 0), (1, 0, 0), (0, 0, 1), (0, 0, -.72),
        (0, -.24, 0), (0, .24, 0),
    ]
    rim = (0, 2, 1, 3)
    faces = []
    for index in range(4):
        nxt = (index + 1) % 4
        faces.append((4, rim[index], rim[nxt]))
        faces.append((5, rim[nxt], rim[index]))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = (rotation * .08, rotation * -.05, rotation)
    obj.scale = scale
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def stylized_tree(variant):
    """Drei bewusst verschiedene Standardbaum-Silhouetten fuer denselben Pool."""
    bark = material("TerraBark", (0.19, 0.085, 0.032), 0.94)
    leaf_shadow = material("TerraLeafShadow", (0.025, 0.090, 0.035), 0.97)
    leaf_mid = material("TerraLeafMid", (0.09, 0.245, 0.064), 0.95)
    leaf_light = material("TerraLeafLight", (0.24, 0.43, 0.105), 0.94)

    data = {
        "a": {
            "trunk": [(0, 0, 0), (0.10, -0.02, 2.25), (-0.10, 0.04, 4.20)],
            "clusters": [
                (-1.55, .10, 4.25, 1.55, 1.15, 1.10),
                (-.45, -.35, 4.75, 1.65, 1.30, 1.20),
                (.80, .05, 4.55, 1.70, 1.20, 1.18),
                (1.45, .20, 5.15, 1.30, 1.05, 1.00),
                (-1.05, .35, 5.35, 1.45, 1.12, 1.12),
                (.15, .10, 5.75, 1.65, 1.25, 1.22),
                (.95, -.35, 5.75, 1.32, 1.02, 1.00),
                (-.15, .15, 6.45, 1.20, .95, .92),
            ],
        },
        "b": {
            "trunk": [(0, 0, 0), (.30, .02, 1.80), (.88, .04, 3.50), (1.38, .03, 4.62)],
            "clusters": [
                (-1.25, .18, 4.18, 1.05, .72, .78, 0),
                (-.45, -.28, 4.42, 1.15, .78, .82, 1),
                (.45, .22, 4.32, 1.20, .80, .78, 1),
                (1.38, -.18, 4.52, 1.26, .82, .82, 2),
                (2.35, .18, 4.65, 1.20, .78, .76, 1),
                (3.28, -.05, 4.86, 1.10, .72, .70, 2),
                (4.12, .12, 5.10, .88, .60, .61, 3),
                (-.50, .32, 5.22, 1.00, .68, .74, 1),
                (.42, -.12, 5.35, 1.16, .76, .80, 2),
                (1.42, .28, 5.45, 1.22, .78, .80, 1),
                (2.42, -.20, 5.62, 1.12, .74, .74, 2),
                (3.37, .20, 5.72, .94, .63, .66, 3),
                (.72, .15, 6.15, 1.03, .70, .72, 2),
                (1.78, -.04, 6.25, 1.12, .72, .72, 3),
            ],
            "fans": [
                (-1.72, .04, 4.45, .86, .56, .62, -.18, 0),
                (-.92, -.08, 5.02, .92, .58, .65, .12, 1),
                (.18, .06, 5.78, .88, .56, .62, .08, 2),
                (1.05, -.08, 6.68, .78, .50, .55, -.06, 3),
                (2.22, .05, 6.45, .94, .58, .60, -.12, 2),
                (3.15, -.04, 6.10, .90, .55, .58, -.18, 3),
                (4.02, .03, 5.55, .78, .48, .50, -.22, 2),
                (4.72, -.03, 5.12, .64, .42, .43, -.28, 3),
            ],
            "leaves": [
                (-1.82, .02, 4.42, .42, .14, .22, -.28, 0),
                (-1.22, -.04, 5.08, .40, .14, .23, .62, 1),
                (-.60, .03, 5.86, .41, .14, .23, 1.04, 2),
                (-.08, -.02, 6.38, .45, .15, .24, 1.24, 2),
                (.62, .04, 6.60, .48, .15, .25, 1.38, 3),
                (1.46, -.03, 6.64, .48, .15, .25, 1.52, 3),
                (2.26, .02, 6.52, .46, .15, .24, 1.72, 2),
                (3.06, -.04, 6.25, .47, .15, .24, .82, 3),
                (3.90, .03, 5.84, .48, .15, .23, .48, 2),
                (4.52, -.02, 5.48, .50, .15, .24, .20, 3),
                (4.94, .03, 5.16, .50, .15, .23, -.02, 3),
                (-1.22, -.03, 4.10, .39, .13, .21, -.58, 0),
                (-.40, .02, 3.94, .38, .13, .20, -.88, 1),
                (.60, -.04, 4.02, .38, .13, .20, -.52, 1),
                (1.62, .02, 4.16, .40, .13, .21, -.35, 2),
                (2.62, -.03, 4.32, .42, .14, .21, -.22, 1),
                (3.58, .03, 4.56, .43, .14, .22, -.12, 2),
            ],
            "branches": [
                (1, (-1.28, .10, 4.12), .17),
                (1, (.48, -.12, 4.42), .19),
                (2, (2.22, .10, 4.58), .17),
                (2, (3.72, .06, 5.02), .14),
                (2, (.55, .12, 5.92), .13),
                (3, (1.92, -.06, 6.06), .12),
            ],
            "roots": [
                (-1.10, .18, .035, .26),
                (-.64, -.76, .030, .22),
                (.10, -1.02, .025, .20),
                (.82, -.58, .032, .24),
                (1.18, .12, .040, .25),
                (.42, .72, .028, .19),
                (-.50, .62, .030, .21),
            ],
        },
        "c": {
            "trunk": [(0, 0, 0), (-.14, .02, 2.10), (.05, 0, 3.65)],
            "clusters": [
                (-2.35, .15, 4.15, 1.55, 1.10, 1.05),
                (-1.30, -.25, 4.75, 1.70, 1.20, 1.10),
                (-.10, .15, 4.50, 1.45, 1.08, 1.00),
                (1.30, -.10, 4.65, 1.65, 1.18, 1.08),
                (2.35, .20, 4.25, 1.45, 1.02, .98),
                (-1.95, .25, 5.50, 1.45, 1.06, 1.00),
                (-.65, -.20, 5.75, 1.65, 1.16, 1.08),
                (.75, .20, 5.70, 1.55, 1.12, 1.04),
                (1.85, -.15, 5.45, 1.38, 1.00, .94),
                (.05, .05, 6.55, 1.35, .98, .92),
            ],
        },
    }[variant]

    trunk = data["trunk"]
    if variant == "b":
        trunk_radii = ((.56, .41), (.42, .27), (.28, .12))
        for index, radii in enumerate(trunk_radii):
            tapered_branch("TerraTrunk", trunk[index], trunk[index + 1],
                           radii[0], radii[1], bark, 8)
    else:
        tapered_branch("TerraTrunkLower", trunk[0], trunk[1], .52, .36, bark, 8)
        tapered_branch("TerraTrunkUpper", trunk[1], trunk[2], .37, .20, bark, 8)
        if variant == "c":
            tapered_branch("TerraTrunkSplit", trunk[1], (-.78, .10, 4.35), .31, .14, bark, 7)

    if variant == "b":
        for root in data["roots"]:
            tapered_branch("TerraRoot", (.0, .0, .18), root[:3],
                           root[3], .035, bark, 6)
    else:
        root_count = 7 if variant == "c" else 5
        for index in range(root_count):
            angle = index * (math.tau / root_count)
            distance = 1.35 if variant == "c" else 1.02
            tapered_branch(
                "TerraRoot",
                (.0, .0, .18),
                (math.cos(angle) * distance, math.sin(angle) * distance, .03),
                .25,
                .035,
                bark,
                6,
            )

    if variant == "b":
        for start_index, target, radius in data["branches"]:
            tapered_branch("TerraBranch", trunk[start_index], target,
                           radius, .045, bark, 7)
    else:
        branch_targets = data["clusters"][::2]
        for index, cluster in enumerate(branch_targets):
            start = trunk[1] if index % 2 else trunk[2]
            end = (cluster[0] * .78, cluster[1] * .78, cluster[2] - .22)
            tapered_branch("TerraBranch", start, end, .18, .055, bark, 6)

    # Drei Blatttinten plus Rinde halten das Hero-Budget von vier Materialien.
    # Ton 1 und 2 teilen den Mittelton; die facettierten Normalen erhalten
    # trotzdem die malerische Binnenmodulation ohne zusaetzlichen Draw-Slot.
    leaf_materials = [leaf_shadow, leaf_mid, leaf_mid, leaf_light]
    fallback_tones = (0, 2, 2, 3)
    for index, cluster in enumerate(data["clusters"]):
        tone = cluster[6] if len(cluster) > 6 else fallback_tones[index % 4]
        canopy_cluster(
            "TerraCanopy",
            cluster[:3],
            cluster[3:6],
            leaf_materials[tone],
            rotation=.41 * index,
        )
    for index, fan in enumerate(data.get("fans", [])):
        canopy_fan("TerraLeafFan", fan[:3], fan[3:6],
                   leaf_materials[fan[7]], rotation=fan[6])
    for leaf in data.get("leaves", []):
        leaf_blade("TerraLeafBlade", leaf[:3], leaf[3:6],
                   leaf_materials[leaf[7]], rotation=leaf[6])


def turtle_head(variant):
    offset = ord(variant[0]) - ord("a")
    skin = material("TerraSkin", (0.29, 0.30, 0.24))
    eye = material("TerraEye", (0.025, 0.022, 0.015), 0.28)
    iris = material("TerraIris", (0.44, 0.27, 0.10), 0.36)
    # Drei reproduzierbare Proportionsvorschlaege, nicht drei Zufallsergebnisse.
    neck_width = [1.9, 2.15, 2.35][offset % 3]
    head_width = [2.25, 2.4, 2.55][offset % 3]
    ellipsoid("Neck", (0, 0, 2.8), (neck_width, 1.75, 3.7), skin, 40)
    ellipsoid("Skull", (0, -0.15, 6.15), (head_width, 2.65, 1.72), skin, 48)
    ellipsoid("Muzzle", (0, -2.0, 5.85), (1.45, 1.35, 0.88), skin, 40)
    for side in (-1, 1):
        ellipsoid("Eye", (side * head_width * 0.78, -1.48, 6.52), (0.34, 0.2, 0.29), eye, 32)
        ellipsoid("Iris", (side * head_width * 0.8, -1.65, 6.54), (0.16, 0.08, 0.15), iris, 24)
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            for polygon in obj.data.polygons:
                polygon.use_smooth = True


def main():
    args = arguments()
    with open(args.brief, encoding="utf-8") as handle:
        brief = json.load(handle)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    asset_id = brief.get("assetId")
    if asset_id == "weltschildkroete":
        turtle_head(args.variant)
    elif asset_id == "baum":
        stylized_tree(args.variant)
    elif asset_id == "nadelbaum":
        stylized_conifer(args.variant)
    else:
        raise SystemExit("Kein Blender-Adapter fuer " + str(asset_id))
    scene = bpy.context.scene
    scene["terra_asset_id"] = brief["assetId"]
    scene["terra_variant"] = args.variant
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.output), export_format="GLB",
                              export_apply=True, export_yup=True, export_materials="EXPORT")


if __name__ == "__main__":
    main()
