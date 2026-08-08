#!/usr/bin/env python3
"""Dump unique English materials from Open5e JSON for exact DE mapping."""

from __future__ import annotations

import json
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "tmp" / "srd-spells-by-level"
out = Path(__file__).resolve().parents[1] / "tmp" / "materials-en-unique.txt"

mats: set[str] = set()
for path in sorted(SRC.glob("level-*.json")):
    for item in json.loads(path.read_text(encoding="utf-8")):
        m = (item.get("material") or "").strip()
        if m:
            mats.add(m)

out.write_text("\n".join(sorted(mats)) + "\n", encoding="utf-8")
print(f"wrote {len(mats)} -> {out}")
