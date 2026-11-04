#!/usr/bin/env bash
# Regenerates the release summaries of the Release Notes page from the
# GitHub releases of stoa-platform/stoa, in the English source and in every
# localized copy listed at the bottom of this script.
#
# Two marker pairs are maintained in each target file:
#   <!-- AUTOGEN:LATEST:START -->    latest published version per component
#   <!-- AUTOGEN:LATEST:END -->
#   <!-- AUTOGEN:RELEASES:START -->  per-component release tables, by month
#   <!-- AUTOGEN:RELEASES:END -->
#
# Only the content between markers is rewritten. The surrounding prose and
# the dated historical entries are left untouched. Requires gh and jq.
set -euo pipefail

REPO="stoa-platform/stoa"

LATEST_START="<!-- AUTOGEN:LATEST:START -->"
LATEST_END="<!-- AUTOGEN:LATEST:END -->"
RELEASES_START="<!-- AUTOGEN:RELEASES:START -->"
RELEASES_END="<!-- AUTOGEN:RELEASES:END -->"

# Fetch recent releases, newest first, skipping monolithic v*.*.* tags.
# The full window feeds the latest-per-component summary so that a component
# with no recent release is not dropped; the tables keep the 50 most recent
# releases, as before.
all_releases=$(gh release list --repo "$REPO" --limit 200 \
  --json tagName,publishedAt \
  --jq '[.[] | select(.tagName | test("^[a-z].*-v[0-9]"))
         | . + (.tagName | capture("^(?<comp>[a-z-]+)-v(?<ver>.+)$"))]')
releases=$(jq '.[0:50]' <<< "$all_releases")

# One line: `component@version` for each component, then the newest release date.
latest=$(jq -r '
  group_by(.comp) | map(max_by(.publishedAt))
  | (map("`\(.comp)@\(.ver)`") | join(", "))
    + " (" + (map(.publishedAt[0:10]) | max) + ")"
' <<< "$all_releases")

months=$(jq -r '[.[] | .publishedAt[0:7]] | unique | reverse | .[]' <<< "$releases")

render_releases() { # $1 = section heading, $2 = table header row
  local month
  for month in $months; do
    echo "## $1 ($month)"
    echo ""
    echo "| $2 |"
    echo "|-----------|---------|------|---------|"
    jq -r --arg m "$month" '
      .[] | select(.publishedAt[0:7] == $m) |
      "| \(.comp) | v\(.ver) | \(.publishedAt[0:10]) | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/\(.tagName)) |"
    ' <<< "$releases"
    echo ""
  done
}

replace_block() { # $1 = file, $2 = start marker, $3 = end marker, $4 = new content
  local file="$1" start="$2" end="$3" tmp
  if ! grep -qF -- "$start" "$file" || ! grep -qF -- "$end" "$file"; then
    echo "error: markers '$start' / '$end' not found in $file" >&2
    exit 1
  fi
  # The content goes through a temp file: BSD awk rejects newlines in -v values.
  tmp=$(mktemp)
  printf '%s\n' "$4" > "$tmp"
  awk -v start="$start" -v end="$end" -v repl="$tmp" '
    $0 == start { print; while ((getline line < repl) > 0) print line; skip=1; next }
    $0 == end   { print; skip=0; next }
    !skip
  ' "$file" > "$file.new" && mv "$file.new" "$file"
  rm -f "$tmp"
}

sync_file() { # $1 = file, $2 = section heading, $3 = table header row
  replace_block "$1" "$LATEST_START" "$LATEST_END" "$latest"
  replace_block "$1" "$RELEASES_START" "$RELEASES_END" \
    $'\n'"$(render_releases "$2" "$3")"$'\n'
  echo "Updated $1"
}

sync_file "docs/reference/changelog.md" \
  "Per-Component Releases" "Component | Version | Date | Release"
sync_file "i18n/fr/docusaurus-plugin-content-docs/current/reference/changelog.md" \
  "Releases par composant" "Composant | Version | Date | Release"
