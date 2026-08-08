#!/usr/bin/env python3
"""Apply exact EN→DE material map from Open5e originals onto spell TS files."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "packages" / "character-creator" / "src" / "content"
SRC = ROOT / "tmp" / "srd-spells-by-level"
MAP_PATH = ROOT / "scripts" / "spell-materials-de-map.json"


def slug_to_key(slug: str) -> str:
    return slug.replace("-", "_")


def load_map() -> dict[str, str]:
    return json.loads(MAP_PATH.read_text(encoding="utf-8"))


def materials_by_key(de_map: dict[str, str]) -> dict[str, str]:
    by_key: dict[str, str] = {}
    missing: list[str] = []
    for path in sorted(SRC.glob("level-*.json")):
        for item in json.loads(path.read_text(encoding="utf-8")):
            en = (item.get("material") or "").strip()
            if not en:
                continue
            key = slug_to_key(item["slug"])
            if en not in de_map:
                missing.append(en)
                continue
            by_key[key] = de_map[en]
    if missing:
        uniq = sorted(set(missing))
        print(f"MISSING_MAP={len(uniq)}")
        for m in uniq:
            print(" -", m)
    return by_key


def looks_english(s: str) -> bool:
    return bool(
        re.search(
            r"\b(a|an|the|of|worth|gp|which|spell|consumes|from|with|piece|powder|"
            r"dust|feather|fur|bit|pinch|drop|small|tiny|holy|focus|crystal|"
            r"diamond|ruby|pearl|incense|bat|leather|wire|ring|feet)\b",
            s,
            re.I,
        )
    )


def patch_file(path: Path, by_key: dict[str, str]) -> tuple[int, list[str]]:
    text = path.read_text(encoding="utf-8")
    updated = 0
    remaining: list[str] = []
    pattern = re.compile(
        r'(key: "([^"]+)",(?:(?!key: ).){0,1200}?material: (?:null|"[^"]*"))',
        re.S,
    )

    def repl(match: re.Match[str]) -> str:
        nonlocal updated
        full = match.group(1)
        key = match.group(2)
        if key not in by_key:
            m = re.search(r'material: "([^"]*)"', full)
            if m and m.group(1) and looks_english(m.group(1)):
                remaining.append(f"{path.name}:{key}: {m.group(1)}")
            return full
        de = by_key[key]
        new_full, n = re.subn(
            r'material: (?:null|"[^"]*")',
            f"material: {json.dumps(de, ensure_ascii=False)}",
            full,
            count=1,
        )
        if n:
            updated += 1
        if looks_english(de):
            remaining.append(f"{path.name}:{key}: {de}")
        return new_full

    new_text = pattern.sub(repl, text)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
    return updated, remaining


def main() -> None:
    de_map = load_map()
    by_key = materials_by_key(de_map)
    print(f"mapped_keys={len(by_key)}")
    total = 0
    remain: list[str] = []
    skip = {
        "spells-cantrips.ts",
        "spells-level1-a-f.ts",
        "spells-level1-g-z.ts",
        "spells-level1.ts",
        "spells-level2.ts",
        "spells-level3.ts",
        "spells-level4.ts",
        "spells-level5.ts",
        "spells-level6.ts",
    }
    for path in sorted(CONTENT.glob("spells*.ts")):
        if path.name in skip:
            continue
        n, rem = patch_file(path, by_key)
        total += n
        remain.extend(rem)
        print(f"  {path.name}: {n}")
    print(f"updated={total} remaining_englishish={len(remain)}")
    for line in remain:
        print(" -", line)


if __name__ == "__main__":
    main()
