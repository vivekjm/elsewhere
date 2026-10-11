#!/usr/bin/env python3
"""Collect Swift compiler localization keys after building the app.

Usage: python3 ios/scripts/update-localizations.py <DerivedData>
Keeps any translations already present; never translates user content.
"""
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
catalog = root / "TripsLoom/Localizable.xcstrings"
data = json.loads(catalog.read_text())
strings = data["strings"]
for source in pathlib.Path(sys.argv[1]).rglob("*.stringsdata"):
    emitted = json.loads(source.read_text())
    if "/TripsLoom/" not in emitted.get("source", ""):
        continue
    for entry in emitted.get("tables", {}).get("Localizable", []):
        key = entry.get("key")
        if not key:
            continue
        item = strings.setdefault(key, {"extractionState": "manual", "comment": entry.get("comment", "")})
        item.setdefault("localizations", {}).setdefault("en", {"stringUnit": {"state": "translated", "value": key}})
data["strings"] = dict(sorted(strings.items()))
catalog.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(f"Collected {len(strings)} English source strings in {catalog}")
