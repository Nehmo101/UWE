#!/usr/bin/env python3
"""Extract text from E:\\Downloads\\UWE Character Creator PDFs into inventory."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(r"E:\Downloads\UWE Character Creator")
OUT_ROOT = Path(r"C:\git\uwe\tmp\character-creator-source-extract")
INVENTORY_PATH = Path(r"C:\git\uwe\data\character-creator-progress\source-inventory.json")


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    INVENTORY_PATH.parent.mkdir(parents=True, exist_ok=True)

    inventory: dict = {
        "sourceRoot": str(ROOT),
        "extractedAt": datetime.now().isoformat(timespec="seconds"),
        "files": [],
        "links": [],
        "discovered": {
            "classes": [],
            "species": [],
            "backgrounds": [],
            "feats": [],
            "other": [],
        },
        "notes": [
            "PDFs are user-supplied Notizen. Licensing must be reviewed before "
            "publishing any non-SRD mechanics into shared/distribution channels.",
        ],
    }

    links_file = ROOT / "Items,Spells,Armor Links to scalp.txt"
    if links_file.exists():
        for line in links_file.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line:
                inventory["links"].append({"url": line, "status": "discovered"})

    for pdf in sorted(ROOT.rglob("*.pdf")):
        rel = str(pdf.relative_to(ROOT)).replace("\\", "/")
        print(f"EXTRACT {rel}", flush=True)
        reader = PdfReader(str(pdf))
        pages: list[str] = []
        for page in reader.pages:
            try:
                text = page.extract_text() or ""
            except Exception as exc:  # noqa: BLE001
                text = f"[extract_error: {exc}]"
            pages.append(text)

        full = "\n\n".join(f"--- PAGE {i + 1} ---\n{t}" for i, t in enumerate(pages))
        digest = hashlib.sha256(full.encode("utf-8", errors="replace")).hexdigest()[:16]
        out_path = OUT_ROOT / (rel.replace("/", "__") + ".txt")
        out_path.write_text(full, encoding="utf-8")

        parent = pdf.parent.name.lower()
        if "klasse" in parent:
            category = "classes"
        elif "spez" in parent:
            category = "species"
        elif "background" in parent:
            category = "backgrounds"
        elif "feat" in parent:
            category = "feats"
        else:
            category = "other"

        candidates: list[str] = []
        seen: set[str] = set()
        for t in pages[:8]:
            for line in t.splitlines():
                s = line.strip()
                if not (3 <= len(s) <= 90):
                    continue
                if s.startswith("http") or s.count(" ") > 10:
                    continue
                if not re.search(r"[A-Za-zÄÖÜäöüß]", s):
                    continue
                key = s.lower()
                if key in seen:
                    continue
                seen.add(key)
                candidates.append(s)

        entry = {
            "path": rel,
            "bytes": pdf.stat().st_size,
            "pages": len(reader.pages),
            "sha256_16": digest,
            "extractPath": str(out_path.relative_to(Path(r"C:\git\uwe"))).replace("\\", "/"),
            "categoryGuess": category,
            "headingCandidates": candidates[:120],
            "textChars": len(full),
            "hasExtractableText": any(len(p.strip()) > 20 for p in pages),
        }
        inventory["files"].append(entry)
        inventory["discovered"][category].append(
            {
                "source": rel,
                "nameHint": pdf.stem,
                "pages": len(reader.pages),
                "status": "inventoried",
            }
        )

    INVENTORY_PATH.write_text(
        json.dumps(inventory, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("FILES", len(inventory["files"]))
    print("LINKS", len(inventory["links"]))
    for f in inventory["files"]:
        print(
            f"{f['categoryGuess']:12} pages={f['pages']:3} "
            f"chars={f['textChars']:7} text={f['hasExtractableText']} {f['path']}"
        )


if __name__ == "__main__":
    main()
