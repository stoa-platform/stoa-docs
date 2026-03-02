#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# check-i18n-coverage.sh — Report i18n translation coverage for stoa-docs
#
# Usage:
#   ./scripts/check-i18n-coverage.sh          # summary
#   ./scripts/check-i18n-coverage.sh --detail  # list missing files
#   ./scripts/check-i18n-coverage.sh --ci      # exit 1 if below threshold
#
# Environment:
#   I18N_MIN_COVERAGE  minimum % to pass CI gate (default: 5)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DOCS_DIR="$REPO_ROOT/docs"
FR_DIR="$REPO_ROOT/i18n/fr/docusaurus-plugin-content-docs/current"

MIN_COVERAGE="${I18N_MIN_COVERAGE:-5}"
DETAIL=false
CI_MODE=false

for arg in "$@"; do
  case "$arg" in
    --detail) DETAIL=true ;;
    --ci) CI_MODE=true ;;
    --help|-h)
      echo "Usage: $0 [--detail] [--ci]"
      echo "  --detail  List all missing FR translations"
      echo "  --ci      Exit 1 if coverage < I18N_MIN_COVERAGE (default: 5%)"
      exit 0
      ;;
  esac
done

# Priority tiers (sidebar order — most important pages first)
TIER1_PAGES=(
  "intro.md"
  "concepts/architecture.md"
  "concepts/mcp-gateway.md"
  "concepts/multi-tenant.md"
  "concepts/uac.md"
  "guides/quick-start.md"
  "guides/authentication.md"
  "guides/mcp-getting-started.md"
  "faq/index.md"
)

TIER2_PAGES=(
  "concepts/gitops.md"
  "concepts/mcp-gateway-positioning.md"
  "guides/subscriptions.md"
  "guides/console.md"
  "guides/portal.md"
  "guides/observability.md"
  "guides/mcp-tools-development.md"
  "community/index.md"
  "community/philosophy.md"
  "community/faq.md"
)

# Collect all EN docs
en_files=()
while IFS= read -r file; do
  rel="${file#$DOCS_DIR/}"
  en_files+=("$rel")
done < <(find "$DOCS_DIR" \( -name '*.md' -o -name '*.mdx' \) | sort)

total_en=${#en_files[@]}

# Count FR translations
translated=0
missing=()
for f in "${en_files[@]}"; do
  if [ -f "$FR_DIR/$f" ]; then
    ((translated++))
  else
    missing+=("$f")
  fi
done

# Calculate coverage
if [ "$total_en" -gt 0 ]; then
  coverage=$((translated * 100 / total_en))
else
  coverage=0
fi

# Tier coverage
tier1_total=${#TIER1_PAGES[@]}
tier1_done=0
tier1_missing=()
for p in "${TIER1_PAGES[@]}"; do
  if [ -f "$FR_DIR/$p" ]; then
    ((tier1_done++))
  else
    tier1_missing+=("$p")
  fi
done

tier2_total=${#TIER2_PAGES[@]}
tier2_done=0
tier2_missing=()
for p in "${TIER2_PAGES[@]}"; do
  if [ -f "$FR_DIR/$p" ]; then
    ((tier2_done++))
  else
    tier2_missing+=("$p")
  fi
done

# Output
echo "=== STOA Docs — i18n Coverage Report (FR) ==="
echo ""
echo "Overall:  $translated / $total_en pages translated ($coverage%)"
echo "Tier 1:   $tier1_done / $tier1_total key pages (intro, concepts, guides)"
echo "Tier 2:   $tier2_done / $tier2_total secondary pages"
echo ""

if [ ${#tier1_missing[@]} -gt 0 ]; then
  echo "Tier 1 missing (high priority):"
  for p in "${tier1_missing[@]}"; do
    echo "  - $p"
  done
  echo ""
fi

if [ ${#tier2_missing[@]} -gt 0 ]; then
  echo "Tier 2 missing (medium priority):"
  for p in "${tier2_missing[@]}"; do
    echo "  - $p"
  done
  echo ""
fi

if $DETAIL; then
  echo "All missing FR translations (${#missing[@]}):"
  for f in "${missing[@]}"; do
    echo "  - $f"
  done
  echo ""
fi

# CI gate
if $CI_MODE; then
  if [ "$coverage" -lt "$MIN_COVERAGE" ]; then
    echo "FAIL: coverage $coverage% < minimum $MIN_COVERAGE%"
    exit 1
  else
    echo "PASS: coverage $coverage% >= minimum $MIN_COVERAGE%"
  fi
fi
