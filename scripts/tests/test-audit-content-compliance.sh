#!/usr/bin/env bash
# =============================================================================
# Test runner for audit-content-compliance.sh (CAB-2069)
# Validates P1_UNSOURCED_TCO detector against fixtures.
# Exit 0 = all pass, exit 1 = any failure.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT="$REPO_ROOT/scripts/audit-content-compliance.sh"
FIXTURES="$REPO_ROOT/scripts/fixtures"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

FAIL_COUNT=0
PASS_COUNT=0

run_case() {
    local name="$1" fixture="$2" expected_exit="$3" expected_min_p1="$4"
    local output exit_code p1_count

    output=$("$AUDIT" "$fixture" 2>&1)
    exit_code=$?

    # Strip ANSI, extract P1 count
    p1_count=$(echo "$output" | sed 's/\x1b\[[0-9;]*m//g' | awk '/P1 \(warning\):/{print $NF}')
    p1_count="${p1_count:-0}"

    local ok=1
    if [[ "$exit_code" != "$expected_exit" ]]; then
        ok=0
    fi
    if [[ "$expected_min_p1" -gt 0 && "$p1_count" -lt "$expected_min_p1" ]]; then
        ok=0
    fi
    if [[ "$expected_min_p1" -eq 0 && "$p1_count" -ne 0 ]]; then
        ok=0
    fi

    if [[ "$ok" -eq 1 ]]; then
        printf "  ${GREEN}PASS${NC}  %-40s (exit=%s, p1=%s)\n" "$name" "$exit_code" "$p1_count"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        printf "  ${RED}FAIL${NC}  %-40s (exit=%s expected=%s, p1=%s expected_min=%s)\n" \
            "$name" "$exit_code" "$expected_exit" "$p1_count" "$expected_min_p1"
        echo "$output" | sed 's/\x1b\[[0-9;]*m//g' | head -40 | sed 's/^/      /'
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo -e "${CYAN}audit-content-compliance.sh — fixture tests${NC}"
echo ""

# Pass fixture: every currency row has a source link or whitelisted marker
run_case "compliance-pass-sourced" \
    "$FIXTURES/compliance-pass-sourced.md" \
    0 0

# Fail fixture: currency rows without any source link
run_case "compliance-fail-fabricated" \
    "$FIXTURES/compliance-fail-fabricated.md" \
    2 1

# Pass fixture: regulatory claims with official source or softener (CAB-2072)
run_case "compliance-pass-regulatory-sourced" \
    "$FIXTURES/compliance-pass-regulatory-sourced.md" \
    0 0

# Fail fixture: regulatory claims without sources (CAB-2072)
run_case "compliance-fail-regulatory-claim" \
    "$FIXTURES/compliance-fail-regulatory-claim.md" \
    2 1

echo ""
if [[ "$FAIL_COUNT" -eq 0 ]]; then
    echo -e "${GREEN}ALL TESTS PASSED${NC} ($PASS_COUNT/$((PASS_COUNT + FAIL_COUNT)))"
    exit 0
else
    echo -e "${RED}FAILED${NC} ($FAIL_COUNT failure(s), $PASS_COUNT passing)"
    exit 1
fi
