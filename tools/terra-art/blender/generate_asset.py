"""Deterministischer, headless Blender-Einstieg fuer Terra-Kandidaten."""
import argparse
import json
import os
import sys

import bpy


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
    if brief.get("assetId") != "weltschildkroete":
        raise SystemExit("Der erste Adapter unterstuetzt bewusst nur weltschildkroete")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    turtle_head(args.variant)
    scene = bpy.context.scene
    scene["terra_asset_id"] = brief["assetId"]
    scene["terra_variant"] = args.variant
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.output), export_format="GLB",
                              export_apply=True, export_yup=True, export_materials="EXPORT")


if __name__ == "__main__":
    main()
