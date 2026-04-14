#!/usr/bin/env bash
# =============================================================================
# Content Compliance Audit — P0/P1 Scanner for Blog Articles
# Enforces .claude/rules/content-compliance.md from stoa repo
# =============================================================================
set -eo pipefail

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

P0_COUNT=0
P1_COUNT=0
SCANNED_COUNT=0
VERBOSE=false
FILES_ONLY=""

usage() {
    cat << 'EOF'
Usage: audit-content-compliance.sh [OPTIONS] [FILE...]

Scan blog articles for content compliance violations (P0/P1).

OPTIONS:
    -v, --verbose     Show files being scanned
    -f, --files-only  Only scan specified files (for pre-commit)
    -h, --help        Show this help message

EXIT CODES:
    0   Clean (no P0 findings)
    1   P0 findings detected (blocks merge)
    2   P1 findings detected (warning only)

EXAMPLES:
    audit-content-compliance.sh                        # Scan all blog articles
    audit-content-compliance.sh blog/2026-04-*.md      # Scan specific files
    audit-content-compliance.sh --files-only $(git diff --name-only HEAD~1)
EOF
}

# =============================================================================
# P0 Patterns — Competitor pricing (NEVER acceptable)
# =============================================================================

# Match explicit price + competitor name on same line or in pricing context
# Patterns: "$X.XX", "€XXX", "$XXK", competitor + price
P0_COMPETITOR_PRICING_PATTERNS=(
    # Explicit per-unit competitor pricing
    '\$[0-9]+(\.[0-9]+)?/million'          # $3.50/million
    '\$[0-9]+(\.[0-9]+)?/month'            # $500/month
    '€[0-9]+(\+)?/month'                   # €500+/month
    '\$[0-9]+(\.[0-9]+)? in .* credits'    # $0.10 in OpenAI credits
    '\$[0-9]+[Kk]/year'                    # $50K/year
)

# Competitor names — if found near a price, it's P0
COMPETITORS=(
    "Kong Konnect"
    "AWS API Gateway"
    "Azure APIM"
    "Google Apigee"
    "Apigee"
    "MuleSoft"
    "Anypoint"
    "DataPower"
    "TIBCO"
    "Axway"
    "WSO2"
    "Layer7"
    "Tyk"
    "OpenAI"
    "Cloudflare Workers"
)

# =============================================================================
# P0 Patterns — Other forbidden content
# =============================================================================

P0_CERTIFICATION_PATTERNS=(
    'STOA is .*(compliant|certified)'
    'certified ISO'
    'DORA.compliant'
    'SOC.2 certified'
)

# =============================================================================
# P1 Patterns — Fix before publishing
# =============================================================================

P1_NEGATIVE_PATTERNS=(
    'costs add up'
    'legacy gateway'
    'legacy API'
    'escape vendor'
    'escape lock.in'
    'replace your expensive'
    'better than [A-Z]'
    'superior to'
    'best .* gateway'
)

P1_UNSOURCED_CLAIMS=(
    '[0-9]+-[0-9]+% (reduction|lower|savings|cheaper)'
    'organizations report'
    'run into millions'
    'thousands of dollars'
    'significantly more expensive'
)

# =============================================================================
# Whitelist (false positives)
# =============================================================================

WHITELIST_PATTERNS=(
    'See .* pricing'
    'See vendor pricing'
    'verify.*pricing'
    'check.*pricing page'
    'Vendor-dependent'
    'illustrative'
    'gostoa.dev'
    '€[0-9]' # STOA's own pricing ranges are OK when not attributed to competitor
)

# =============================================================================
# Functions
# =============================================================================

is_whitelisted() {
    local line="$1"
    for wl in "${WHITELIST_PATTERNS[@]}"; do
        if echo "$line" | grep -qiE "$wl"; then
            return 0
        fi
    done
    return 1
}

has_competitor_on_line() {
    local line="$1"
    for comp in "${COMPETITORS[@]}"; do
        if echo "$line" | grep -qi "$comp"; then
            echo "$comp"
            return 0
        fi
    done
    return 1
}

# Check if the line is inside a table row with a competitor
has_competitor_in_table_context() {
    local file="$1"
    local line_num="$2"

    # Check 5 lines before and after for competitor names (table context)
    local start=$((line_num - 5))
    [[ $start -lt 1 ]] && start=1
    local end=$((line_num + 5))

    local context
    context=$(sed -n "${start},${end}p" "$file" 2>/dev/null || true)

    for comp in "${COMPETITORS[@]}"; do
        if echo "$context" | grep -qi "$comp"; then
            echo "$comp"
            return 0
        fi
    done
    return 1
}

report_p0() {
    local file="$1" line_num="$2" pattern="$3" detail="$4"
    P0_COUNT=$((P0_COUNT + 1))
    local rel="${file#$REPO_ROOT/}"
    printf "| %-55s | %5s | ${RED}P0${NC} | %-40s |\n" "$rel" "$line_num" "$detail"
}

report_p1() {
    local file="$1" line_num="$2" pattern="$3" detail="$4"
    P1_COUNT=$((P1_COUNT + 1))
    local rel="${file#$REPO_ROOT/}"
    printf "| %-55s | %5s | ${YELLOW}P1${NC} | %-40s |\n" "$rel" "$line_num" "$detail"
}

scan_file() {
    local file="$1"
    SCANNED_COUNT=$((SCANNED_COUNT + 1))
    [[ "$VERBOSE" == true ]] && echo "  Scanning: ${file#$REPO_ROOT/}"

    # --- P0: Competitor pricing ---
    for pattern in "${P0_COMPETITOR_PRICING_PATTERNS[@]}"; do
        while IFS=: read -r line_num content; do
            [[ -z "$line_num" ]] && continue
            is_whitelisted "$content" && continue

            # Check if competitor is on the same line or in table context
            local comp
            comp=$(has_competitor_on_line "$content" 2>/dev/null) || \
            comp=$(has_competitor_in_table_context "$file" "$line_num" 2>/dev/null) || \
            comp=""

            if [[ -n "$comp" ]]; then
                report_p0 "$file" "$line_num" "$pattern" "Competitor pricing: $comp"
            fi
        done < <(grep -nE "$pattern" "$file" 2>/dev/null || true)
    done

    # --- P0: Certification claims ---
    for pattern in "${P0_CERTIFICATION_PATTERNS[@]}"; do
        while IFS=: read -r line_num content; do
            [[ -z "$line_num" ]] && continue
            report_p0 "$file" "$line_num" "$pattern" "Certification claim"
        done < <(grep -nEi "$pattern" "$file" 2>/dev/null || true)
    done

    # --- P1: Negative characterizations ---
    for pattern in "${P1_NEGATIVE_PATTERNS[@]}"; do
        while IFS=: read -r line_num content; do
            [[ -z "$line_num" ]] && continue
            is_whitelisted "$content" && continue
            report_p1 "$file" "$line_num" "$pattern" "Negative characterization"
        done < <(grep -nEi "$pattern" "$file" 2>/dev/null || true)
    done

    # --- P1: Unsourced comparative claims ---
    for pattern in "${P1_UNSOURCED_CLAIMS[@]}"; do
        while IFS=: read -r line_num content; do
            [[ -z "$line_num" ]] && continue
            is_whitelisted "$content" && continue
            report_p1 "$file" "$line_num" "$pattern" "Unsourced comparative claim"
        done < <(grep -nEi "$pattern" "$file" 2>/dev/null || true)
    done

    # --- P1: Comparison page without disclaimer ---
    # Check if file mentions any competitor by name
    local has_competitor=false
    for comp in "${COMPETITORS[@]}"; do
        if grep -qi "$comp" "$file" 2>/dev/null; then
            has_competitor=true
            break
        fi
    done

    if [[ "$has_competitor" == true ]]; then
        # Check for disclaimer (trademark notice, "last verified", or comparison disclaimer)
        if ! grep -qEi '(last verified|trademark|All trademarks|publicly available.*documentation|feature claims based on)' "$file" 2>/dev/null; then
            report_p1 "$file" "EOF" "disclaimer" "Missing disclaimer (competitor mentioned)"
        fi

        # Check for stale "last verified" date (> 6 months)
        while IFS=: read -r line_num content; do
            local verified_date
            verified_date=$(echo "$content" | grep -oE '[0-9]{4}-[0-9]{2}' | head -1)
            if [[ -n "$verified_date" ]]; then
                local verified_epoch
                verified_epoch=$(date -j -f "%Y-%m" "$verified_date" "+%s" 2>/dev/null || date -d "$verified_date-01" "+%s" 2>/dev/null || echo "0")
                local six_months_ago
                six_months_ago=$(date -v-6m "+%s" 2>/dev/null || date -d "6 months ago" "+%s" 2>/dev/null || echo "0")

                if [[ "$verified_epoch" -gt 0 && "$six_months_ago" -gt 0 && "$verified_epoch" -lt "$six_months_ago" ]]; then
                    report_p1 "$file" "$line_num" "stale-date" "last verified > 6 months old: $verified_date"
                fi
            fi
        done < <(grep -nEi 'last verified' "$file" 2>/dev/null || true)
    fi
}

# =============================================================================
# Main
# =============================================================================

POSITIONAL=()
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose) VERBOSE=true; shift ;;
        -f|--files-only) FILES_ONLY=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) POSITIONAL+=("$1"); shift ;;
    esac
done

echo ""
echo "=============================================="
echo "  Content Compliance Audit (P0/P1)"
echo "=============================================="
echo ""

printf "| %-55s | %5s | %4s | %-40s |\n" "File" "Line" "Sev." "Detail"
echo "|-----------------------------------------------------------|-------|------|------------------------------------------|"

cd "$REPO_ROOT"

if [[ ${#POSITIONAL[@]} -gt 0 ]]; then
    # Scan specified files
    for file in "${POSITIONAL[@]}"; do
        [[ -f "$file" ]] && scan_file "$file"
    done
else
    # Scan all blog articles
    while IFS= read -r file; do
        [[ -n "$file" ]] && scan_file "$file"
    done < <(find blog/ -type f -name "*.md" -o -name "*.mdx" 2>/dev/null | sort)
fi

echo ""
echo "=============================================="
echo "  Summary"
echo "=============================================="
echo ""
echo "  Files scanned:     $SCANNED_COUNT"
echo -e "  ${RED}P0 (blocking):     $P0_COUNT${NC}"
echo -e "  ${YELLOW}P1 (warning):      $P1_COUNT${NC}"
echo ""

if [[ $P0_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED${NC} — $P0_COUNT P0 violation(s) found. Fix before merge."
    echo ""
    echo "P0 rules (content-compliance.md):"
    echo "  - Never include competitor pricing (even if public)"
    echo "  - Never claim certifications (use 'supports compliance with')"
    echo "  - Never name clients without written authorization"
    echo ""
    exit 1
elif [[ $P1_COUNT -gt 0 ]]; then
    echo -e "${YELLOW}WARNING${NC} — $P1_COUNT P1 violation(s). Review before publishing."
    exit 2
else
    echo -e "${GREEN}PASSED${NC} — No compliance violations detected."
    exit 0
fi
