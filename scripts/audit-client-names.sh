#!/usr/bin/env bash
# =============================================================================
# CAB-953 - Client Names Audit Script
# Scans documentation for leaked client/prospect names
# =============================================================================
# Note: Don't use -u (nounset) as it breaks on CI with empty arrays
set -eo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BLOCKLIST_FILE="${SCRIPT_DIR}/.audit-blocklist.txt"

# Counters
CRITICAL_COUNT=0
WARNING_COUNT=0
SCANNED_COUNT=0

# Options
VERBOSE=false
FIX_MODE=false

# =============================================================================
# Whitelist patterns (false positives to ignore)
# =============================================================================
declare -a WHITELIST_PATTERNS=(
    # Generic "Total" usage
    "Total Cost"
    "Total points"
    "total count"
    "total number"
    "in total"
    # Prometheus metrics (lowercase only: mcp_requests_total)
    # Handled by regex below, not string match

    # OAuth/Technical "client" terms
    "Client Credentials"
    "client IP"
    "API client"
    "Keycloak client"
    "client certificate"
    "Dynamic Client Registration"
    "client_id"
    "client_secret"
    "OAuth client"
    "HTTP client"
    "client application"
    "client-side"
)

# Regex patterns that are OK (Chucky's fix: lowercase_total only)
declare -a WHITELIST_REGEX=(
    '[a-z_]+_total'           # Prometheus: mcp_requests_total (NOT CEVA_total)
    '@example\.com'           # RFC 2606 reserved
    '@acme\.com'              # Common fictional domain
    '@localhost'              # Local testing
    '@gostoa\.dev'            # Official project domain
    '@your-domain\.com'       # Placeholder domain
)

# Terms that look like blocklist but are technical
declare -a WHITELIST_TERMS=(
    "BDFL"                    # Benevolent Dictator For Life (matches BdF)
    "client-side"             # Technical term
    "server-side"             # Technical term
)

# Warning patterns (need manual review)
declare -a WARNING_PATTERNS=(
    '\[Client\]'
    '\[Prospect\]'
    '\[REDACTED\]'
)

# =============================================================================
# Functions
# =============================================================================

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Scan documentation for leaked client/prospect names.

OPTIONS:
    -v, --verbose     Show files being scanned
    -f, --fix         Show suggested fixes (dry-run)
    -b, --blocklist   Path to custom blocklist file
    -h, --help        Show this help message

EXIT CODES:
    0   Clean (no CRITICAL findings, warnings allowed)
    1   CRITICAL findings detected (blocks CI)

EXAMPLES:
    $(basename "$0")                    # Standard audit
    $(basename "$0") --verbose          # See all scanned files
    $(basename "$0") -b /path/list.txt  # Custom blocklist
EOF
}

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[CRITICAL]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

# Check if a line matches whitelist
is_whitelisted() {
    local line="$1"

    # Check string whitelist
    for wl_pattern in "${WHITELIST_PATTERNS[@]}"; do
        if echo "$line" | grep -qi "$wl_pattern"; then
            return 0
        fi
    done

    # Check regex whitelist
    for regex in "${WHITELIST_REGEX[@]}"; do
        if echo "$line" | grep -qE "$regex"; then
            return 0
        fi
    done

    # Check term whitelist (exact technical terms)
    for term in "${WHITELIST_TERMS[@]}"; do
        if echo "$line" | grep -qi "$term"; then
            return 0
        fi
    done

    return 1
}

# Load blocklist from file
load_blocklist() {
    if [[ ! -f "$BLOCKLIST_FILE" ]]; then
        log_error "Blocklist not found: $BLOCKLIST_FILE"
        exit 1
    fi

    BLOCKLIST=()
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ -z "${line// }" ]] && continue
        BLOCKLIST+=("$line")
    done < "$BLOCKLIST_FILE"

    log_info "Loaded ${#BLOCKLIST[@]} patterns from blocklist"
}

# Scan a single file
scan_file() {
    local file="$1"
    local relative_path="${file#$REPO_ROOT/}"

    ((SCANNED_COUNT++))
    [[ "$VERBOSE" == true ]] && echo "  Scanning: $relative_path"

    # Check CRITICAL patterns (from blocklist)
    for pattern in "${BLOCKLIST[@]}"; do
        while IFS=: read -r line_num content; do
            # Skip if whitelisted
            if is_whitelisted "$content"; then
                continue
            fi

            ((CRITICAL_COUNT++))
            printf "| %-50s | %5s | %-25s | ${RED}CRITICAL${NC} |\n" \
                "$relative_path" "$line_num" "$pattern"

            if [[ "$FIX_MODE" == true ]]; then
                echo "  -> Suggested: Replace '$pattern' with '[Enterprise Client]'"
            fi
        done < <(grep -in "$pattern" "$file" 2>/dev/null || true)
    done

    # Check WARNING patterns
    for pattern in "${WARNING_PATTERNS[@]}"; do
        while IFS=: read -r line_num content; do
            ((WARNING_COUNT++))
            printf "| %-50s | %5s | %-25s | ${YELLOW}WARNING${NC}  |\n" \
                "$relative_path" "$line_num" "${pattern//\\/}"
        done < <(grep -inE "$pattern" "$file" 2>/dev/null || true)
    done

    # N3m0's check: Real emails (not @example.com, @acme.com, @localhost)
    while IFS=: read -r line_num content; do
        # Extract email
        email=$(echo "$content" | grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' | head -1)

        # Skip safe domains
        if [[ "$email" =~ @example\.(com|org|net)$ ]] || \
           [[ "$email" =~ @acme\.com$ ]] || \
           [[ "$email" =~ @localhost$ ]] || \
           [[ "$email" =~ @test\.com$ ]] || \
           [[ "$email" =~ @your-domain\.com$ ]] || \
           [[ "$email" =~ @gostoa\.dev$ ]] || \
           [[ "$email" =~ @noreply\.github\.com$ ]]; then
            continue
        fi

        # Check if it's in GOVERNANCE.md (Gh0st's point: intentional for maintainers)
        if [[ "$relative_path" == "GOVERNANCE.md" ]] || \
           [[ "$relative_path" == "CODE_OF_CONDUCT.md" ]] || \
           [[ "$relative_path" == "SECURITY.md" ]]; then
            continue
        fi

        ((WARNING_COUNT++))
        printf "| %-50s | %5s | %-25s | ${YELLOW}WARNING${NC}  |\n" \
            "$relative_path" "$line_num" "Real email: $email"
    done < <(grep -inE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' "$file" 2>/dev/null || true)
}

# =============================================================================
# Main
# =============================================================================

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--fix)
            FIX_MODE=true
            shift
            ;;
        -b|--blocklist)
            BLOCKLIST_FILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

echo ""
echo "=============================================="
echo "  CAB-953 - Client Names Audit"
echo "=============================================="
echo ""

# Load blocklist
load_blocklist

# Print table header
echo ""
printf "| %-50s | %5s | %-25s | %-8s |\n" "File" "Line" "Pattern" "Severity"
echo "|----------------------------------------------------|-------|---------------------------|----------|"

# Find and scan files
cd "$REPO_ROOT"

# Use a temp file to avoid process substitution issues on CI
TMPFILE=$(mktemp)
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
    2>/dev/null > "$TMPFILE" || true

while IFS= read -r file; do
    [[ -n "$file" ]] && scan_file "$file"
done < "$TMPFILE"
rm -f "$TMPFILE"

# Summary
echo ""
echo "=============================================="
echo "  Summary"
echo "=============================================="
echo ""
echo "  Files scanned:     $SCANNED_COUNT"
echo -e "  ${RED}CRITICAL findings: $CRITICAL_COUNT${NC}"
echo -e "  ${YELLOW}WARNING findings:  $WARNING_COUNT${NC}"
echo ""

# Exit code
if [[ $CRITICAL_COUNT -gt 0 ]]; then
    log_error "Audit FAILED - $CRITICAL_COUNT critical finding(s) must be fixed before merge"
    exit 1
else
    if [[ $WARNING_COUNT -gt 0 ]]; then
        log_warn "Audit PASSED with $WARNING_COUNT warning(s) - review recommended"
    else
        log_success "Audit PASSED - No sensitive data detected"
    fi
    exit 0
fi
