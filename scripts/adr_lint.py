#!/usr/bin/env python3
"""ADR lint for stoa-docs.

Enforces structural invariants on `docs/architecture/adr/adr-NNN-*.md`:

Blocking rules:
  1. No two ADR files share the same 3-digit number.
  2. Filename number matches the `# ADR-NNN` header number.
  3. Every ADR has a `# ADR-NNN` header.
  4. No static "Next = ADR-NNN" / "Next ADR = NNN" reference inside ADR files.
  5. ADR-062 must not contain the phrase "never formally recorded".
  6. ADR-003 must not contain any of:
       - "MCP Gateway (current)"
       - "Future unified gateway"
       - a line mentioning "mcp-gateway" together with "current"
       - a line mentioning "stoa-gateway" together with "Future"
  7. ADR-030 must mention ADR-062 (partial supersession).
  8. ADR-064 must mention ADR-059 (ADR-059 scope protection).
  9. ADR-064 must contain a clarification that deployment paths removed by
     ADR-059 are not re-enabled ("not re-enable" or "retired").

Advisory (warnings only, non-blocking):
  - Missing Status line.
  - Missing Date line.
  - Missing sidebar_position (P2, cosmetic — not enforced).

Run: `python3 scripts/adr_lint.py`
Exits with code 1 if any blocking rule fails.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ADR_DIR = Path("docs/architecture/adr")
ADR_FILE_RE = re.compile(r"^adr-(\d{3})-[\w\-]+\.md$")
HEADER_RE = re.compile(r"^#\s+ADR-(\d{3})\b", re.MULTILINE)
NEXT_REF_RE = re.compile(r"Next\s*(?:ADR)?\s*=\s*ADR-\d{3}", re.IGNORECASE)


def find_adr_files(root: Path) -> list[Path]:
    if not root.is_dir():
        raise SystemExit(f"ADR lint: directory not found: {root}")
    return sorted(p for p in root.iterdir() if ADR_FILE_RE.match(p.name))


def check_adr003(text: str) -> list[str]:
    errors: list[str] = []
    if "MCP Gateway (current)" in text:
        errors.append('ADR-003 still contains "MCP Gateway (current)"')
    if "Future unified gateway" in text:
        errors.append('ADR-003 still contains "Future unified gateway"')
    for lineno, line in enumerate(text.splitlines(), start=1):
        low = line.lower()
        if "mcp-gateway" in low and "current" in low and "historical" not in low and "retired" not in low:
            errors.append(
                f'ADR-003 line {lineno} pairs "mcp-gateway" with "current" without a historical/retired qualifier: {line.strip()}'
            )
        if "stoa-gateway" in low and "future" in low:
            errors.append(
                f'ADR-003 line {lineno} pairs "stoa-gateway" with "Future": {line.strip()}'
            )
    return errors


def check_adr030(text: str) -> list[str]:
    if "ADR-062" not in text:
        return ["ADR-030 must mention ADR-062 (partial supersession note)"]
    return []


def check_adr062(text: str) -> list[str]:
    if "never formally recorded" in text:
        return ['ADR-062 still contains "never formally recorded" — supersession lineage must name ADR-030']
    return []


def check_adr064(text: str) -> list[str]:
    errors: list[str] = []
    if "ADR-059" not in text:
        errors.append("ADR-064 must mention ADR-059 (scope protection against reactivation)")
    low = text.lower()
    if "not re-enable" not in low and "retired" not in low:
        errors.append(
            'ADR-064 must contain a clarification preventing reactivation of paths removed by ADR-059 '
            '(expected "not re-enable" or "retired")'
        )
    return errors


TARGETED_CHECKS: dict[str, callable] = {
    "003": check_adr003,
    "030": check_adr030,
    "062": check_adr062,
    "064": check_adr064,
}


def lint() -> int:
    files = find_adr_files(ADR_DIR)
    errors: list[str] = []
    warnings: list[str] = []
    by_number: dict[str, list[Path]] = {}
    texts: dict[str, str] = {}

    for path in files:
        m = ADR_FILE_RE.match(path.name)
        assert m is not None
        file_num = m.group(1)
        text = path.read_text(encoding="utf-8")
        by_number.setdefault(file_num, []).append(path)

        header_match = HEADER_RE.search(text)
        if not header_match:
            errors.append(f"{path}: missing `# ADR-NNN` header")
        else:
            header_num = header_match.group(1)
            if header_num != file_num:
                errors.append(
                    f"{path}: filename number {file_num} does not match header number {header_num}"
                )

        if NEXT_REF_RE.search(text):
            errors.append(
                f"{path}: contains a static 'Next = ADR-NNN' reference; drop static pointers, the next number is computed from the directory"
            )

        if "Status" not in text:
            warnings.append(f"{path}: missing Status metadata (advisory)")
        if "Date" not in text:
            warnings.append(f"{path}: missing Date metadata (advisory)")

        targeted = TARGETED_CHECKS.get(file_num)
        if targeted is not None:
            errors.extend(targeted(text))
        texts[file_num] = text

    for num, paths in sorted(by_number.items()):
        if len(paths) > 1:
            joined = "\n    ".join(str(p) for p in paths)
            errors.append(f"Duplicate ADR number {num}:\n    {joined}")

    for num in ("003", "030", "062", "064"):
        if num not in texts:
            errors.append(f"Expected ADR-{num} not found in {ADR_DIR}")

    if warnings:
        print(f"ADR lint warnings ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")
        print()

    if errors:
        print(f"ADR lint failed ({len(errors)} blocking issue(s)):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("ADR lint passed.")
    print(f"Checked {len(files)} ADR files.")
    print("No duplicate ADR numbers.")
    print("No stale supersession markers.")
    print("No retired gateway markers presented as active.")
    return 0


if __name__ == "__main__":
    sys.exit(lint())
