"""Deterministische Tannen-Kandidaten fuer den normalen Terra-Instancing-Pool."""
import math

import bpy
from mathutils import Vector


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.roughness = roughness
    return mat


def tapered_branch(name, start, end, radius_start, radius_end, mat, vertices=7):
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
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = (rotation * .17, rotation * .11, rotation)
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def conifer_spray(name, start, end, width, mat, vertices=7):
    """Geschlossene, facettierte Nadelwolke entlang eines sichtbaren Astes."""
    direction = Vector(end) - Vector(start)
    midpoint = (Vector(start) + Vector(end)) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=width,
        radius2=width * .08,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj
def bough_cluster(name, start, end, width, mat, lift=0.0):
    """Ueberlappende, facettierte Kronenmasse statt einer flachen Nadel-Lanze."""
    direction = Vector(end) - Vector(start)
    length = direction.length
    yaw = math.atan2(direction.y, direction.x)
    for index, position in enumerate((.28, .53, .76, .92)):
        center = Vector(start) + direction * position
        center.z += lift + (.07 if index % 2 else 0)
        taper = 1.0 - index * .12
        canopy_cluster(
            name, center,
            (length * (.26 if index < 2 else .22),
             width * taper,
             width * (.66 if index < 3 else .52)),
            mat,
            yaw + (index % 2 - .5) * .13,
        )


def center_at(points, height):
    for index in range(len(points) - 1):
        a, b = points[index], points[index + 1]
        if a[2] <= height <= b[2]:
            t = (height - a[2]) / max(b[2] - a[2], .001)
            return (a[0] + (b[0] - a[0]) * t,
                    a[1] + (b[1] - a[1]) * t, height)
    return (points[-1][0], points[-1][1], height)


def stylized_conifer(variant):
    """Drei Tannen als Qualitaetskalibrierung fuer den gesamten Assetkatalog."""
    bark = material("TerraBark", (0.18, 0.075, 0.028), .96)
    dark = material("TerraNeedleDark", (0.018, 0.075, 0.042), .98)
    mid = material("TerraNeedleMid", (0.055, 0.205, 0.095), .97)
    light = material("TerraNeedleLight", (0.17, 0.36, 0.13), .95)
    needles = [dark, mid, light]

    configs = {
        "a": {
            "trunk": [(0, 0, 0), (.06, .01, 2.7), (-.08, .02, 5.7), (.10, 0, 8.4)],
            "tiers": [(1.65, 2.45, 6, .15), (2.65, 2.28, 7, .48),
                      (3.75, 2.02, 6, .06), (4.85, 1.72, 6, .36),
                      (5.95, 1.34, 5, .08), (6.85, .92, 5, .42)],
            "wind": .10,
            "crown": (.12, .02, 8.55),
        },
        "b": {
            "trunk": [(0, 0, 0), (.18, .02, 2.5), (.48, .01, 5.2), (.82, -.02, 7.8)],
            "tiers": [(1.55, 2.30, 5, .22), (2.45, 2.55, 6, .52),
                      (3.42, 2.42, 5, .12), (4.38, 2.20, 6, .46),
                      (5.35, 1.88, 5, .18), (6.22, 1.52, 5, .54),
                      (7.02, 1.08, 4, .24)],
            "wind": .62,
            "crown": (1.24, -.02, 8.18),
        },
        "c": {
            "trunk": [(0, 0, 0), (-.12, .02, 2.8), (.10, .04, 5.5), (-.18, .02, 7.45)],
            "tiers": [(1.45, 2.72, 6, .38), (2.45, 2.60, 5, .04),
                      (3.55, 2.25, 6, .46), (4.62, 1.95, 5, .12),
                      (5.55, 1.58, 5, .52), (6.42, 1.18, 4, .20)],
            "wind": -.18,
            "crown": (-.42, .04, 7.92),
        },
    }
    data = configs[variant]
    trunk = data["trunk"]
    radii = ((.58, .42), (.43, .27), (.28, .11))
    for index, pair in enumerate(radii):
        tapered_branch("TerraConiferTrunk", trunk[index], trunk[index + 1],
                       pair[0], pair[1], bark, 8)

    root_count = 8 if variant == "c" else 7
    for index in range(root_count):
        angle = index * math.tau / root_count + (.17 if variant == "b" else 0)
        length = (1.22 if variant == "c" else 1.02) * (1 + (index % 3) * .09)
        tapered_branch(
            "TerraConiferRoot", (0, 0, .18),
            (math.cos(angle) * length, math.sin(angle) * length, .025),
            .25 - index * .008, .028, bark, 6)

    for tier_index, tier in enumerate(data["tiers"]):
        height, base_length, count, offset = tier
        center = center_at(trunk, height)
        for branch_index in range(count):
            angle = offset + branch_index * math.tau / count
            wind_side = max(0, math.cos(angle))
            lee_side = max(0, -math.cos(angle))
            length = base_length * (1 + data["wind"] * wind_side
                                    - abs(data["wind"]) * .38 * lee_side)
            length *= .90 + ((tier_index * 13 + branch_index * 7) % 9) * .025
            lift = .08 + ((tier_index + branch_index) % 3) * .07
            droop = .22 + max(0, 3 - tier_index) * .06
            end = (center[0] + math.cos(angle) * length + data["wind"] * .22,
                   center[1] + math.sin(angle) * length,
                   height - droop + lift)
            woody_end = (center[0] + (end[0] - center[0]) * .88,
                         center[1] + (end[1] - center[1]) * .88,
                         end[2] - .05)
            tapered_branch("TerraConiferBranch", center, woody_end,
                           .12 - tier_index * .008, .025, bark, 6)
            tone = (tier_index + branch_index + (1 if variant == "b" else 0)) % 3
            spray_start = (center[0] + (end[0] - center[0]) * .14,
                           center[1] + (end[1] - center[1]) * .14,
                           center[2] + .02)
            bough_cluster("TerraConiferBough", spray_start, end,
                          .49 - tier_index * .022, needles[tone], .06)
            inner_end = (center[0] + (end[0] - center[0]) * .58,
                         center[1] + (end[1] - center[1]) * .58,
                         center[2] + .12)
            bough_cluster("TerraConiferInnerBough", center, inner_end,
                          .42 - tier_index * .018,
                          needles[(tone + 1) % 3], .04)

    crown = data["crown"]
    tapered_branch("TerraConiferLeader", trunk[-1], crown, .13, .025, bark, 6)
    crown_base = center_at(trunk, trunk[-1][2] - .72)
    canopy_cluster("TerraConiferCrownBase", crown_base, (.58, .48, .44), mid, .1)
    for index in range(6):
        angle = index * math.tau / 6 + .23
        start = crown_base
        end = (crown[0] + math.cos(angle) * (.34 + index % 2 * .10),
               crown[1] + math.sin(angle) * (.34 + index % 2 * .10),
               crown[2] - .12 + (index % 3) * .12)
        bough_cluster("TerraConiferCrown", start, end, .29,
                      needles[1 + index % 2], .03)

    canopy_cluster("TerraConiferCrownCap", crown,
                   (.40, .36, .70), light, .2)

    if variant == "c":
        split_start = center_at(trunk, 5.25)
        split_end = (.68, .12, 7.18)
        tapered_branch("TerraConiferSplit", split_start, split_end,
                       .19, .045, bark, 7)
        bough_cluster("TerraConiferSplitSpray", split_start, split_end,
                      .34, mid, .02)
