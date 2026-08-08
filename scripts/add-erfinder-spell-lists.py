#!/usr/bin/env python3
"""Add 'erfinder' to Artificer-compatible cantrip and L1 spell lists (DE keys)."""

from __future__ import annotations

import re
from pathlib import Path

CONTENT = Path(__file__).resolve().parents[1] / "packages" / "character-creator" / "src" / "content"

# UWE catalog keys that belong on the Erfinder (Artificer) list at L0/L1.
ERFINDER_KEYS = {
    # cantrips
    "saeurespritzer",
    "feuerblitz",
    "fuehrung",
    "licht",
    "magierhand",
    "ausbessern",
    "botschaft",
    "giftschwall",
    "zaubertrick",
    "froststrahl",
    "widerstand",
    "sterbende_stabilisieren",
    "druidenknueppel",
    # level 1
    "alarm",
    "wunden_heilen",
    "magie_entdecken",
    "selbstverkleidung",
    "eiliger_rueckzug",
    "feenfeuer",
    "falsches_leben",
    "federfall",
    "fettfleck",
    "identifizieren",
    "sprung",
    "weitmarsch",
    "nahrung_und_trank_laeutern",
    "asyl",
    "schild",
}


def patch(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    updated = 0
    pattern = re.compile(
        r'key: "([^"]+)",((?:(?!key: ).)*?)lists: \[([^\]]*)\]',
        re.S,
    )

    def repl(match: re.Match[str]) -> str:
        nonlocal updated
        key = match.group(1)
        mid = match.group(2)
        lists_raw = match.group(3)
        if key not in ERFINDER_KEYS:
            return match.group(0)
        items = re.findall(r'"([^"]+)"', lists_raw)
        if "erfinder" in items:
            return match.group(0)
        items.append("erfinder")
        new_lists = ", ".join(f'"{i}"' for i in items)
        updated += 1
        return f'key: "{key}",{mid}lists: [{new_lists}]'

    new_text = pattern.sub(repl, text)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
    return updated


def main() -> None:
    total = 0
    for name in ("spells-cantrips.ts", "spells-level1-a-f.ts", "spells-level1-g-z.ts"):
        n = patch(CONTENT / name)
        print(f"{name}: {n}")
        total += n
    print(f"total={total}")


if __name__ == "__main__":
    main()
