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
# P1_UNSOURCED_TCO — Fabricated TCO tables (CAB-2069)
# Detects markdown table rows with currency (€/$) that lack a source link
# within +-10 lines. Whitelisted markers: markdown http(s) link in context,
# "Vendor-dependent", "see .* pricing", "see .* calculator", or gostoa.dev.
# =============================================================================

TCO_RADIUS=10
TCO_CONTEXT_WHITELIST='Vendor-dependent|[Ss]ee .* pricing|[Ss]ee .* calculator|gostoa\.dev'

# =============================================================================
# P1_REGULATORY_CLAIM — Fabricated regulatory alignment claims (CAB-2072)
# Detects "STOA is DORA compliant" / "AI Act aligned" / "NIS2 ready" style
# claims without a link to an official primary source within +-10 lines.
# Whitelists: softener phrases ("supports compliance with",
# "helps you comply with"), gostoa.dev scoping, or a markdown link whose URL
# matches an official domain (eur-lex/enisa/iso/nist/hhs/edpb/europa.eu).
# =============================================================================

REG_RADIUS=10
REG_FRAMEWORK='(DORA|AI Act|NIS2|GDPR|SOC[[:space:]]*2|ISO[[:space:]]*27001|HIPAA)'
REG_STATE_VERB='(compliant|aligned|ready|certified|conformant)'
REG_SOFTENER='(supports compliance with|helps you comply with)'
REG_OFFICIAL_DOMAIN='(eur-lex\.europa\.eu|enisa\.europa\.eu|iso\.org|nist\.gov|hhs\.gov|edpb\.europa\.eu|europa\.eu|gdpr\.eu)'

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

has_source_link_in_context() {
    local file="$1"
    local line_num="$2"
    local start=$((line_num - TCO_RADIUS))
    [[ $start -lt 1 ]] && start=1
    local end=$((line_num + TCO_RADIUS))
    sed -n "${start},${end}p" "$file" 2>/dev/null | grep -qE '\[[^]]+\]\(https?://[^)]+\)'
}

has_regulatory_whitelist_on_line() {
    local line="$1"
    # Softener phrases, gostoa.dev self-scoping, or official domain on the same line.
    echo "$line" | grep -qEi "$REG_SOFTENER|gostoa\.dev|$REG_OFFICIAL_DOMAIN"
}

has_official_source_in_context() {
    local file="$1"
    local line_num="$2"
    local start=$((line_num - REG_RADIUS))
    [[ $start -lt 1 ]] && start=1
    local end=$((line_num + REG_RADIUS))
    sed -n "${start},${end}p" "$file" 2>/dev/null | grep -qEi "$REG_OFFICIAL_DOMAIN"
}

has_tco_whitelist_in_context() {
    local file="$1"
    local line_num="$2"
    local start=$((line_num - TCO_RADIUS))
    [[ $start -lt 1 ]] && start=1
    local end=$((line_num + TCO_RADIUS))
    sed -n "${start},${end}p" "$file" 2>/dev/null | grep -qE "$TCO_CONTEXT_WHITELIST"
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

    # --- P1_REGULATORY_CLAIM: Fabricated regulatory alignment (CAB-2072) ---
    # Framework + state verb on the same line, unless softened or sourced.
    while IFS=: read -r line_num content; do
        [[ -z "$line_num" ]] && continue
        # Must contain both a framework token and a state verb on the same line
        echo "$content" | grep -qEi "$REG_FRAMEWORK" || continue
        echo "$content" | grep -qEi "$REG_STATE_VERB" || continue
        # Line-level whitelist (softener, gostoa.dev, or official domain)
        has_regulatory_whitelist_on_line "$content" && continue
        # Context-level whitelist (±10 lines with official source link)
        has_official_source_in_context "$file" "$line_num" && continue
        report_p1 "$file" "$line_num" "P1_REGULATORY_CLAIM" "Unsourced regulatory claim"
    done < <(grep -niE "$REG_FRAMEWORK" "$file" 2>/dev/null || true)

    # --- P1_UNSOURCED_TCO: Fabricated TCO tables (CAB-2069) ---
    while IFS=: read -r line_num content; do
        [[ -z "$line_num" ]] && continue
        # Must be a markdown table row
        echo "$content" | grep -qE '^[[:space:]]*\|' || continue
        # Line-level TCO whitelist
        echo "$content" | grep -qE "$TCO_CONTEXT_WHITELIST" && continue
        # Context-level TCO whitelist (±10 lines)
        has_tco_whitelist_in_context "$file" "$line_num" && continue
        # Source link in ±10 lines exempts the row
        has_source_link_in_context "$file" "$line_num" && continue
        report_p1 "$file" "$line_num" "P1_UNSOURCED_TCO" "Unsourced currency in table row"
    done < <(grep -nE '€[0-9]|\$[0-9]' "$file" 2>/dev/null || true)

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
# Internal-content patterns (default full scan only).
#
# P0 literals below are blocking: a hit fails the audit (exit 1).
#
# The other patterns are P1 warnings on purpose. Occurrences already exist
# outside the change that added these checks, and this audit must not force
# that wider cleanup. They do not fail CI (exit 2, same as other P1s).
# Promote a pattern to P0 only after its remaining hits are gone:
#   - IPv4 outside RFC 5737 (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24),
#     127.0.0.0/8, the address 0.0.0.0, and private ranges used as examples
#     (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
#   - linear.app/
#   - hlfh
#   - case-insensitive (NIS2|DORA)[ -]?(compliance|ready)
#   - case-insensitive (NIS2|DORA)[ /-]+(NIS2|DORA)[ -]?(compliance|ready)
# =============================================================================

INTERNAL_P0_LITERALS=(
    'stoa-next'
    'stoa-strategy'
    'HEGEMON/'
)

INTERNAL_P1_LITERALS=(
    'linear.app/'
    'hlfh'
)

INTERNAL_P1_REGEX=(
    '(NIS2|DORA)[ -]?(compliance|ready)'
    '(NIS2|DORA)[ /-]+(NIS2|DORA)[ -]?(compliance|ready)'
)

INTERNAL_P1_REGEX_LABELS=(
    'NIS2-DORA compliance-ready'
    'NIS2-DORA pair compliance-ready'
)

# 0 = valid IPv4 outside the allowlist (report). 1 = allowed or not an IPv4.
ipv4_outside_allowlist() {
    local ip="$1"
    local o1 o2 o3 o4 octet
    IFS='.' read -r o1 o2 o3 o4 <<< "$ip"
    [[ -n "${o4:-}" ]] || return 1
    for octet in "$o1" "$o2" "$o3" "$o4"; do
        [[ "$octet" =~ ^[0-9]{1,3}$ ]] || return 1
        if (( 10#$octet > 255 )); then
            return 1
        fi
    done
    o1=$((10#$o1))
    o2=$((10#$o2))
    o3=$((10#$o3))
    o4=$((10#$o4))

    # 0.0.0.0 exactly; 127.0.0.0/8; RFC1918 examples; RFC 5737 documentation.
    if (( o1 == 0 && o2 == 0 && o3 == 0 && o4 == 0 )); then return 1; fi
    if (( o1 == 127 )); then return 1; fi
    if (( o1 == 10 )); then return 1; fi
    if (( o1 == 172 && o2 >= 16 && o2 <= 31 )); then return 1; fi
    if (( o1 == 192 && o2 == 168 )); then return 1; fi
    if (( o1 == 192 && o2 == 0 && o3 == 2 )); then return 1; fi
    if (( o1 == 198 && o2 == 51 && o3 == 100 )); then return 1; fi
    if (( o1 == 203 && o2 == 0 && o3 == 113 )); then return 1; fi
    return 0
}

# Report line numbers only. Do not keep or print the matched line.
# Process substitution keeps the counter updates in the current shell.
report_grep_lines() {
    local file="$1" severity="$2" detail="$3"
    shift 3
    local line_num
    while IFS= read -r line_num; do
        [[ -z "$line_num" ]] && continue
        if [[ "$severity" == "P0" ]]; then
            report_p0 "$file" "$line_num" "$detail" "$detail"
        else
            report_p1 "$file" "$line_num" "$detail" "$detail"
        fi
    done < <("$@" 2>/dev/null | cut -d: -f1 || true)
}

scan_internal_content_file() {
    local file="$1"
    local pattern line_num ip last_ipv4_line=""
    local i

    for pattern in "${INTERNAL_P0_LITERALS[@]}"; do
        report_grep_lines "$file" "P0" "$pattern" grep -nF "$pattern" "$file"
    done

    for pattern in "${INTERNAL_P1_LITERALS[@]}"; do
        report_grep_lines "$file" "P1" "$pattern" grep -nF "$pattern" "$file"
    done

    for i in "${!INTERNAL_P1_REGEX[@]}"; do
        report_grep_lines "$file" "P1" "${INTERNAL_P1_REGEX_LABELS[$i]}" \
            grep -niE "${INTERNAL_P1_REGEX[$i]}" "$file"
    done

    while IFS=: read -r line_num ip; do
        [[ -z "$line_num" ]] && continue
        [[ "$line_num" == "$last_ipv4_line" ]] && continue
        if ipv4_outside_allowlist "$ip"; then
            last_ipv4_line="$line_num"
            report_p1 "$file" "$line_num" "ipv4" "IPv4 outside allowlist"
        fi
    done < <(grep -nEo '[0-9]{1,3}(\.[0-9]{1,3}){3}' "$file" 2>/dev/null || true)
}

scan_internal_content() {
    local tmp file
    tmp=$(mktemp)
    find . -type f \( \
        -name "*.md" -o \
        -name "*.mdx" -o \
        -name "*.yml" -o \
        -name "*.yaml" -o \
        -name "*.json" -o \
        -name "*.js" -o \
        -name "*.ts" -o \
        -name "*.tsx" \
    \) \
        ! -path "./node_modules/*" \
        ! -path "./.git/*" \
        ! -path "./.docusaurus/*" \
        ! -path "./build/*" \
        ! -name "package-lock.json" \
        ! -name "pnpm-lock.yaml" \
        ! -name "yarn.lock" \
        2>/dev/null | sort > "$tmp" || true

    while IFS= read -r file; do
        [[ -n "$file" ]] && scan_internal_content_file "$file"
    done < "$tmp"
    rm -f "$tmp"
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

    # Repo-wide internal-content check. Not run for explicit file args so
    # fixture tests keep scanning only the file they pass in.
    scan_internal_content
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
