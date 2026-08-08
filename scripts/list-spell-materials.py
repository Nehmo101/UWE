#!/usr/bin/env python3
"""List unique spell material strings (for review / exact DE map)."""

from __future__ import annotations

import re
from pathlib import Path

CONTENT = Path(__file__).resolve().parents[1] / "packages" / "character-creator" / "src" / "content"

EN = re.compile(
    r"\b(a|an|the|of|worth|gp|piece|diamond|ruby|pearl|powder|bit|small|drop|"
    r"leaf|feather|crystal|holy|water|focus|consumes|copper|silver|gold|"
    r"bat|guano|sulfur|incense|cloth|silk|egg|shell|bone|hair|blood|iron|"
    r"lodestone|amber|jade|ivory|glass|mirror|bell|flute|food|wine|honey|"
    r"salt|dirt|earth|clay|sand|stone|twig|wood|ash|oil|herb|seed|flower|"
    r"wing|scale|tooth|fang|claw|fur|hide|leather|string|wire|needle|key|"
    r"chain|ring|coin|gem|jewel|orb|rod|wand|staff|which|spell|consumes|"
    r"from|with|into|each|must|wear|duration|powdered|pinch|morsel|forked|"
    r"dust|heart|hen|wing|shaving|glowing|stick|pair|platinum|diamonds|"
    r"rotten|reed|straw|skunk|cabbage|bitumen|spider|mica|talc|parchment|"
    r"corn|extract|twisted|loop|ashes|burned|spruce|sprig|honeycomb|"
    r"legume|brimstone|tallow|pitch|adder|stomach|rhubarb|sumac|beast|"
    r"tokens|bones|sticks|marked|specially|similar|bent|cup|shape|shank|"
    r"either|amount|dash|burst|drops|few|several|fine|short|piece|"
    r"jeweled|horn|hearing|seeing|licorice|root|glowing|vial|"
    r"phosphorescent|material|guano|sulfur)\b",
    re.I,
)


def main() -> None:
    mats: set[str] = set()
    for path in sorted(CONTENT.glob("spells*.ts")):
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r'material: "([^"]*)"', text):
            if m.group(1):
                mats.add(m.group(1))
    eng = sorted(m for m in mats if EN.search(m) or "gp" in m.lower())
    print(f"unique={len(mats)} englishish={len(eng)}")
    for m in eng:
        print(m)


if __name__ == "__main__":
    main()
