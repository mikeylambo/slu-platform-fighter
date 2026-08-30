"""Safely suggest/apply semantic animation bindings for a fighter GLB/FBX.

Usage:
  blender --background --python scripts/blender/autobind_animations.py -- fighters/<id>/render.json
  blender --background --python scripts/blender/autobind_animations.py -- fighters/<id>/render.json --apply

The tool never guesses between multiple clips. It maps only exact normalized role
names and a small explicit alias table. Ambiguous/unmatched roles stay unresolved.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

import bpy

ALIASES: dict[str, tuple[str, ...]] = {
    "initial_dash": ("dash", "initialdash"),
    "run_brake": ("runbrake", "brake"),
    "jump_squat": ("jumpsquat", "squatjump"),
    "short_hop": ("shorthop",),
    "full_hop": ("fullhop", "jump"),
    "double_jump": ("doublejump", "jump2"),
    "fast_fall": ("fastfall",),
    "jab_1": ("jab1", "attackjab1"),
    "jab_2": ("jab2", "attackjab2"),
    "jab_3": ("jab3", "attackjab3"),
    "rapid_jab": ("rapidjab",),
    "dash_attack": ("dashattack",),
    "forward_tilt": ("forwardtilt", "ftilt"),
    "up_tilt": ("uptilt", "utilt"),
    "down_tilt": ("downtilt", "dtilt"),
    "forward_smash": ("forwardsmash", "fsmash"),
    "up_smash": ("upsmash", "usmash"),
    "down_smash": ("downsmash", "dsmash"),
    "neutral_air": ("neutralair", "nair"),
    "forward_air": ("forwardair", "fair", "attackfair"),
    "back_air": ("backair", "bair"),
    "up_air": ("upair", "uair"),
    "down_air": ("downair", "dair"),
    "neutral_special": ("neutralspecial", "specialn"),
    "side_special": ("sidespecial", "specials"),
    "up_special": ("upspecial", "specialhi"),
    "down_special": ("downspecial", "speciallw"),
    "shield_hold": ("shield", "shieldhold"),
    "spot_dodge": ("spotdodge",),
    "roll_forward": ("rollforward", "forwardroll"),
    "roll_back": ("rollback", "backroll"),
    "air_dodge": ("airdodge",),
    "grab_hold": ("grabhold",),
    "grab_release": ("grabrelease",),
    "forward_throw": ("forwardthrow", "fthrow", "throwf"),
    "back_throw": ("backthrow", "bthrow", "throwb"),
    "up_throw": ("upthrow", "uthrow", "throwu"),
    "down_throw": ("downthrow", "dthrow", "throwd"),
    "hit_light": ("hitlight", "hit1"),
    "hit_heavy": ("hitheavy", "hit2"),
    "wall_bounce": ("wallbounce",),
    "ground_bounce": ("groundbounce",),
    "tech_in_place": ("techinplace", "techneutral"),
    "tech_forward": ("techforward",),
    "tech_back": ("techback",),
    "missed_tech": ("missedtech",),
    "ledge_hang": ("ledgehang",),
    "ledge_getup": ("ledgegetup",),
    "ledge_roll": ("ledgeroll",),
    "ledge_jump": ("ledgejump",),
    "ledge_attack": ("ledgeattack",),
    "ledge_drop": ("ledgedrop",),
    "wall_jump": ("walljump",),
    "wall_cling": ("wallcling",),
}


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def import_model(model_path: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    suffix = model_path.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(model_path))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(model_path))
    else:
        raise RuntimeError(f"Unsupported model format: {suffix}")


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if not args:
        raise RuntimeError("Expected render.json path after --")
    render_path = Path(args[0]).resolve()
    apply = "--apply" in args[1:]
    root = Path(__file__).resolve().parents[2]
    render = load_json(render_path)
    contract = load_json(root / "content" / "animation-contract.json")
    model_path = (render_path.parent / render["model"]).resolve()
    if not model_path.exists():
        raise RuntimeError(f"Model does not exist: {model_path}")
    import_model(model_path)

    actions = sorted(action.name for action in bpy.data.actions)
    by_normalized: dict[str, list[str]] = {}
    for action in actions:
        by_normalized.setdefault(normalize(action), []).append(action)

    existing = render.setdefault("animations", {})
    report: dict[str, dict] = {}
    applied = 0
    for role in contract["roles"]:
        if role in existing and existing[role].get("clip"):
            report[role] = {"status": "existing", "clip": existing[role]["clip"]}
            continue
        candidates: list[str] = []
        keys = [normalize(role), *(normalize(alias) for alias in ALIASES.get(role, ()))]
        for key in keys:
            candidates.extend(by_normalized.get(key, []))
        candidates = sorted(set(candidates))
        if len(candidates) == 1:
            clip = candidates[0]
            report[role] = {"status": "matched", "clip": clip}
            if apply:
                existing[role] = {"clip": clip, "grade": "retargeted", "loop": role in {"idle", "idle_alt", "walk", "walk_back", "run", "crouch", "fall", "fast_fall", "shield_hold", "grab_hold", "grabbed", "ledge_hang"}}
                applied += 1
        elif len(candidates) > 1:
            report[role] = {"status": "ambiguous", "candidates": candidates}
        else:
            report[role] = {"status": "unmatched"}

    output = render_path.parent / "animation-bindings.suggested.json"
    output.write_text(json.dumps({"fighterId": render["fighterId"], "actions": actions, "roles": report}, indent=2) + "\n", encoding="utf-8")
    if apply:
        render_path.write_text(json.dumps(render, indent=2) + "\n", encoding="utf-8")
    matched = sum(1 for entry in report.values() if entry["status"] in {"matched", "existing"})
    ambiguous = sum(1 for entry in report.values() if entry["status"] == "ambiguous")
    unmatched = sum(1 for entry in report.values() if entry["status"] == "unmatched")
    print(f"SLU animation autobind: {matched}/{len(contract['roles'])} resolved; {ambiguous} ambiguous; {unmatched} unmatched; {applied} applied -> {output}")


if __name__ == "__main__":
    main()
