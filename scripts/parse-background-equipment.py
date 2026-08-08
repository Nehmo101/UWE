#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(
    r"C:\git\uwe\tmp\character-creator-source-extract\Background__Background - Notizen.pdf.txt"
).read_text(encoding="utf-8", errors="replace")
OUT = Path(
    r"C:\git\uwe\packages\character-creator\dev-progress\backgrounds-equipment.json"
)

NAMES = [
    "Acolyte",
    "Artisan",
    "Charlatan",
    "Criminal",
    "Entertainer",
    "Farmer",
    "Guard",
    "Guide",
    "Hermit",
    "Merchant",
    "Noble",
    "Sage",
    "Sailor",
    "Scribe",
    "Soldier",
    "Wayfarer",
]


def main() -> None:
    clean = re.sub(r"08\.08\.26.*?html-export \d+/\d+\n?", "", TEXT)
    clean = re.sub(r"--- PAGE \d+ ---\n?", "\n", clean)
    positions: list[tuple[int, str]] = []
    for name in NAMES:
        match = re.search(rf"(?m)^\s*{re.escape(name)}\s*$", clean)
        if match:
            positions.append((match.start(), name))
    positions.sort()
    result: dict[str, str] = {}
    for i, (pos, name) in enumerate(positions):
        end = positions[i + 1][0] if i + 1 < len(positions) else min(pos + 1500, len(clean))
        body = clean[pos:end]
        match = re.search(r"Equipment:\s*(.+)", body, re.S)
        if not match:
            result[name] = "MISSING"
            continue
        chunk = match.group(1)
        # stop at narrative paragraph start heuristics
        stop = re.search(
            r"\n(?:You |A |As |Born |Growing |Your |In |On |When |After |Before |[A-Z][a-z]+ing )",
            chunk,
        )
        if stop:
            chunk = chunk[: stop.start()]
        result[name] = re.sub(r"\s+", " ", chunk).strip()
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for name, eq in result.items():
        print(name, "=>", eq[:200])


if __name__ == "__main__":
    main()
