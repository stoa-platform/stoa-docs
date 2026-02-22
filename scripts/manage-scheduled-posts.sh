#!/usr/bin/env bash
# manage-scheduled-posts.sh — Auto-manage scheduled blog post visibility
#
# Convention:
#   - Posts with future dates → unlisted: true (accessible by URL, hidden from listings/feeds)
#   - Posts whose date has arrived → unlisted removed (fully published)
#
# Why unlisted (not draft)?
#   - draft: true hides completely → breaks cross-links from published posts
#   - unlisted: true keeps URL alive → cross-links work, but not in listings/RSS/sitemap
#   - This is how Vercel/Supabase handle "launch week" pre-published content
#
# Usage:
#   ./scripts/manage-scheduled-posts.sh          # Apply changes (prebuild hook)
#   ./scripts/manage-scheduled-posts.sh --check  # Dry-run, report only (CI/dev)
#   ./scripts/manage-scheduled-posts.sh --status  # Show all posts with dates + status

set -euo pipefail

BLOG_DIR="$(cd "$(dirname "$0")/../blog" && pwd)"
TODAY=$(date +%Y-%m-%d)
MODE="${1:---apply}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

drafted=0
published=0
skipped=0
errors=0

log_action() {
  local color="$1" label="$2" file="$3" detail="$4"
  printf "${color}[%-9s]${NC} %-55s %s\n" "$label" "$(basename "$file")" "$detail"
}

# Check if frontmatter has draft: true (manual, not managed by this script)
has_draft() {
  local file="$1"
  awk 'BEGIN{fm=0} /^---$/{fm++; next} fm==1{print} fm>=2{exit}' "$file" \
    | grep -q '^draft:[[:space:]]*true' 2>/dev/null
}

# Check if frontmatter has unlisted: true
has_unlisted() {
  local file="$1"
  awk 'BEGIN{fm=0} /^---$/{fm++; next} fm==1{print} fm>=2{exit}' "$file" \
    | grep -q '^unlisted:[[:space:]]*true' 2>/dev/null
}

# Check if frontmatter explicitly sets unlisted: false (force-publish override)
# When set, the script skips auto-scheduling for this post regardless of date
has_force_published() {
  local file="$1"
  awk 'BEGIN{fm=0} /^---$/{fm++; next} fm==1{print} fm>=2{exit}' "$file" \
    | grep -q '^unlisted:[[:space:]]*false' 2>/dev/null
}

# Add unlisted: true to frontmatter (after line 1, which is always ---)
add_unlisted() {
  local file="$1"
  if [[ "$MODE" == "--check" ]]; then
    return
  fi
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' '1 a\
unlisted: true' "$file"
  else
    sed -i '1 a\unlisted: true' "$file"
  fi
}

# Remove unlisted: true from frontmatter only (not from body)
remove_unlisted() {
  local file="$1"
  if [[ "$MODE" == "--check" ]]; then
    return
  fi
  local end_line
  end_line=$(awk '/^---$/{n++; if(n==2){print NR; exit}}' "$file")
  if [[ -n "$end_line" ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "2,${end_line}{/^unlisted:[[:space:]]*true$/d;}" "$file"
    else
      sed -i "2,${end_line}{/^unlisted:[[:space:]]*true$/d;}" "$file"
    fi
  fi
}

# Extract date from filename (YYYY-MM-DD)
extract_date() {
  local filename="$1"
  echo "$filename" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo ""
}

echo ""
if [[ "$MODE" == "--status" ]]; then
  printf "${BLUE}%-12s %-55s %-10s %-10s${NC}\n" "DATE" "FILE" "STATUS" "UNLISTED?"
  printf "%-12s %-55s %-10s %-10s\n" "----" "----" "------" "---------"
fi

# Process each blog post
for entry in "$BLOG_DIR"/2*; do
  filename="$(basename "$entry")"
  post_date="$(extract_date "$filename")"

  if [[ -z "$post_date" ]]; then
    continue
  fi

  # Determine the markdown file
  if [[ -d "$entry" ]]; then
    file="$entry/index.md"
    if [[ ! -f "$file" ]]; then
      file="$entry/index.mdx"
    fi
  else
    file="$entry"
  fi

  if [[ ! -f "$file" ]]; then
    ((errors++)) || true
    log_action "$RED" "ERROR" "$filename" "File not found"
    continue
  fi

  is_future=false
  if [[ "$post_date" > "$TODAY" ]]; then
    is_future=true
  fi

  is_unlisted=false
  if has_unlisted "$file"; then
    is_unlisted=true
  fi

  is_manual_draft=false
  if has_draft "$file"; then
    is_manual_draft=true
  fi

  # --status mode: just report
  if [[ "$MODE" == "--status" ]]; then
    status="published"
    unlisted_flag="no"
    if $is_manual_draft; then status="${RED}draft${NC}"; fi
    if $is_future && ! $is_manual_draft; then status="${YELLOW}scheduled${NC}"; fi
    if $is_unlisted; then unlisted_flag="yes"; fi
    printf "%-12s %-55s ${status}%-10s${NC} %-8s\n" "$post_date" "$filename" "" "$unlisted_flag"
    continue
  fi

  # Skip posts with manual draft: true (Docusaurus forbids draft + unlisted)
  if $is_manual_draft; then
    ((skipped++)) || true
    if [[ "$MODE" != "--apply" ]] || [[ "${VERBOSE:-}" == "1" ]]; then
      log_action "$BLUE" "SKIP" "$filename" "has manual draft: true"
    fi
    continue
  fi

  # Skip posts with unlisted: false (force-publish override — author wants post live now)
  if has_force_published "$file"; then
    ((skipped++)) || true
    if [[ "$MODE" != "--apply" ]] || [[ "${VERBOSE:-}" == "1" ]]; then
      log_action "$GREEN" "SKIP" "$filename" "force-published (unlisted: false)"
    fi
    continue
  fi

  # Future post without unlisted → add unlisted
  if $is_future && ! $is_unlisted; then
    add_unlisted "$file"
    ((drafted++)) || true
    log_action "$YELLOW" "UNLISTED" "$filename" "future ($post_date > $TODAY)"

  # Past/today post with unlisted → remove unlisted (publish)
  elif ! $is_future && $is_unlisted; then
    remove_unlisted "$file"
    ((published++)) || true
    log_action "$GREEN" "PUBLISHED" "$filename" "date arrived ($post_date <= $TODAY)"

  # Already correct state
  else
    ((skipped++)) || true
    if [[ "$MODE" != "--apply" ]] || [[ "${VERBOSE:-}" == "1" ]]; then
      if $is_future; then
        log_action "$BLUE" "OK" "$filename" "already unlisted (scheduled)"
      else
        log_action "$BLUE" "OK" "$filename" "already published"
      fi
    fi
  fi
done

if [[ "$MODE" != "--status" ]]; then
  echo ""
  echo "Summary: ${drafted} drafted, ${published} published, ${skipped} unchanged, ${errors} errors"

  if [[ "$MODE" == "--check" ]] && (( drafted > 0 || published > 0 )); then
    echo ""
    echo -e "${YELLOW}⚠ Dry-run mode — no files were modified. Run without --check to apply.${NC}"
    exit 1
  fi
fi
