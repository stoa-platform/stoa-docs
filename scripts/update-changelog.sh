#!/usr/bin/env bash
# Regenerates the "Per-Component Releases" section of docs/reference/changelog.md
# from GitHub releases of stoa-platform/stoa.
#
# Markers in changelog.md:
#   <!-- AUTOGEN:RELEASES:START -->
#   ... generated tables ...
#   <!-- AUTOGEN:RELEASES:END -->
set -euo pipefail

REPO="stoa-platform/stoa"
FILE="docs/reference/changelog.md"
START="<!-- AUTOGEN:RELEASES:START -->"
END="<!-- AUTOGEN:RELEASES:END -->"

# Fetch last 50 releases, skip monolithic v*.*.* tags (keep per-component only)
releases=$(gh release list --repo "$REPO" --limit 50 \
  --json tagName,publishedAt,name \
  --jq '[.[] | select(.tagName | test("^[a-z].*-v[0-9]"))]')

# Group by YYYY-MM
months=$(echo "$releases" | jq -r '[.[] | .publishedAt[0:7]] | unique | reverse | .[]')

tmp=$(mktemp)
{
  echo "$START"
  echo ""
  for month in $months; do
    echo "## Per-Component Releases ($month)"
    echo ""
    echo "| Component | Version | Date | Release |"
    echo "|-----------|---------|------|---------|"
    echo "$releases" | jq -r --arg m "$month" '
      .[] | select(.publishedAt[0:7] == $m) |
      (.tagName | capture("^(?<comp>[a-z-]+)-v(?<ver>.+)$")) as $p |
      "| \($p.comp) | v\($p.ver) | \(.publishedAt[0:10]) | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/\(.tagName)) |"
    '
    echo ""
  done
  echo "$END"
} > "$tmp"

# Replace block between markers
awk -v start="$START" -v end="$END" -v repl="$(cat "$tmp")" '
  $0 ~ start {print repl; skip=1; next}
  $0 ~ end   {skip=0; next}
  !skip
' "$FILE" > "$FILE.new" && mv "$FILE.new" "$FILE"

rm "$tmp"
echo "Changelog updated."
