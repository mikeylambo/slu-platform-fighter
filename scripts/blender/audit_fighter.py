"""Headless Blender audit for an SLU 3D fighter pack.

Usage:
  blender --background --python scripts/blender/audit_fighter.py -- fighters/<id>/render.json

This does not render sprites. It verifies that the runtime GLB can satisfy the
pack's rig, semantic material, socket, and animation contracts.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import bpy


def die(message: str) -> None:
    raise RuntimeError(message)


def args_after_double_dash() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    args = args_after_double_dash()
    if len(args) != 1:
        die("Expected render.json path after --")

    render_path = Path(args[0]).resolve()
    project_root = Path(__file__).resolve().parents[2]
    contract = load_json(project_root / "content" / "animation-contract.json")
    render = load_json(render_path)
    fighter_dir = render_path.parent
    model_path = (fighter_dir / render["model"]).resolve()

    if not model_path.exists():
        die(f"Model does not exist: {model_path}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    suffix = model_path.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(model_path))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(model_path))
    else:
        die(f"Unsupported model format: {suffix}")

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not armatures:
        die("No armature found")
    armature = next((a for a in armatures if a.name == render["armature"]), None)
    if armature is None:
        die(f"Armature '{render['armature']}' not found; found {[a.name for a in armatures]}")

    bone_names = {bone.name for bone in armature.data.bones}
    socket_report = {}
    for semantic, bone in render.get("sockets", {}).items():
        ok = bone in bone_names
        socket_report[semantic] = {"bone": bone, "ok": ok}
        if not ok:
            die(f"Socket {semantic} references missing bone {bone}")

    material_names = {mat.name for mat in bpy.data.materials}
    material_report = {}
    for semantic, material in render["materials"].items():
        ok = material in material_names
        material_report[semantic] = {"material": material, "ok": ok}
        if not ok:
            die(f"Semantic material {semantic} references missing material {material}")

    action_names = {action.name for action in bpy.data.actions}
    animation_report = {}
    for role in contract["roles"]:
        mapping = render.get("animations", {}).get(role)
        if not mapping:
            animation_report[role] = {"status": "missing"}
            continue
        clip = mapping.get("clip", "")
        grade = mapping.get("grade")
        if grade == "procedural":
            animation_report[role] = {"status": "procedural", "grade": grade}
            continue
        if grade == "author_required" and not clip:
            animation_report[role] = {"status": "author_required", "grade": grade}
            continue
        ok = clip in action_names
        animation_report[role] = {"status": "found" if ok else "missing_clip", "clip": clip, "grade": grade}
        if not ok:
            die(f"Animation role {role} references missing action '{clip}'")

    report = {
        "fighterId": render["fighterId"],
        "model": str(model_path.relative_to(project_root)),
        "armature": armature.name,
        "bones": len(bone_names),
        "actions": sorted(action_names),
        "materials": material_report,
        "sockets": socket_report,
        "animations": animation_report,
        "status": "PASS",
    }
    output = fighter_dir / "asset-audit.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"SLU fighter asset audit PASS -> {output}")


if __name__ == "__main__":
    main()
