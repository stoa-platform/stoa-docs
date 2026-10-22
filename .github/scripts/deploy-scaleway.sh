#!/usr/bin/env bash
# Publie un artefact de build sur un bucket Scaleway (Object Storage website) puis purge le pipeline Edge Services.
# Ordre : assets hachés (cache long) -> fichiers non hachés hors HTML -> HTML (active la release). Aucune suppression.
# Entrées (variables d'environnement) : DIST, MANIFEST, BUCKET, PIPELINE, REGION, IMMUTABLE_PREFIXES,
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (clé de l'application IAM de l'environnement), SCW_SECRET_KEY (purge).
# DRY_RUN=1 : affiche les transferts sans rien écrire et sans purger.
set -euo pipefail
: "${DIST:?}" "${MANIFEST:?}" "${BUCKET:?}" "${PIPELINE:?}" "${REGION:?}"
aws --version 2>&1 | grep -q 'aws-cli/2\.' || { echo "AWS CLI v2 requise" >&2; exit 1; }
export LC_ALL=C
[ "${DRY_RUN:-0}" = 0 ] || [ "${DRY_RUN:-0}" = 1 ] || exit 1
[ "${DRY_RUN:-0}" = 1 ] || : "${SCW_SECRET_KEY:?}"
export IMMUTABLE_PREFIXES=${IMMUTABLE_PREFIXES:-_astro}
S3="https://s3.${REGION}.scw.cloud"
LONG="public, max-age=31536000, immutable"
SHORT="public, max-age=300"
export AWS_DEFAULT_REGION="$REGION" AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required AWS_EC2_METADATA_DISABLED=true
DRY=(); [ "${DRY_RUN:-0}" = 1 ] && DRY=(--dryrun)

ctype() { case "$1" in
  html) echo "text/html; charset=utf-8" ;;   css) echo "text/css; charset=utf-8" ;;
  js|mjs) echo "text/javascript; charset=utf-8" ;; json|map) echo "application/json" ;;
  xml) echo "application/xml; charset=utf-8" ;; txt) echo "text/plain; charset=utf-8" ;;
  svg) echo "image/svg+xml" ;; webmanifest) echo "application/manifest+json" ;;
  woff2) echo "font/woff2" ;; woff) echo "font/woff" ;; ttf) echo "font/ttf" ;;
  ico) echo "image/x-icon" ;; png) echo "image/png" ;; jpg|jpeg) echo "image/jpeg" ;;
  webp) echo "image/webp" ;; avif) echo "image/avif" ;; gif) echo "image/gif" ;;
  pdf) echo "application/pdf" ;; *) echo "" ;; esac; }

# cp_tree <source> <destination dans le bucket> <cache-control> [motifs --exclude supplémentaires...]
cp_tree() {
  local src=$1 dst=$2 cache=$3; shift 3
  local excl=(); local e; for e in "$@"; do excl+=(--exclude "$e"); done
  local exts; exts=$(find "$src" -type f -name '*.*' | sed 's/.*\.//' | sort -u)
  local typed=()
  for ext in $exts; do
    local t; t=$(ctype "${ext,,}"); [ -n "$t" ] || continue
    typed+=(--exclude "*.$ext")
    aws s3 cp "$src" "s3://$BUCKET/$dst" --recursive --endpoint-url "$S3" --only-show-errors --no-progress "${DRY[@]}" \
      --exclude "*" --include "*.$ext" "${excl[@]}" --content-type "$t" --cache-control "$cache"
  done
  # fichiers sans type connu : type deviné par l'AWS CLI
  aws s3 cp "$src" "s3://$BUCKET/$dst" --recursive --endpoint-url "$S3" --only-show-errors --no-progress "${DRY[@]}" \
    "${typed[@]}" "${excl[@]}" --cache-control "$cache"
}

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
python3 "$(dirname "$0")/release-files.py" "$DIST" "$MANIFEST" "$work/staged"

echo "1/4 assets hachés (cache long)"
cp_tree "$work/staged/long" "" "$LONG"
echo "2/4 fichiers non hachés hors HTML (cache court)"
cp_tree "$work/staged/short" "" "$SHORT"
echo "3/4 HTML (active la release)"
cp_tree "$work/staged/html" "" "$SHORT"

if [ "${DRY_RUN:-0}" = 1 ]; then echo "DRY_RUN : pas de purge"; exit 0; fi
echo "4/4 purge du pipeline Edge Services"
: "${SCW_SECRET_KEY:?}"
API=https://api.scaleway.com/edge-services/v1beta1
id=$(curl --connect-timeout 10 --max-time 30 --fail --silent -X POST "$API/purge-requests" -H "X-Auth-Token: $SCW_SECRET_KEY" -H "Content-Type: application/json" \
      -d "$(jq -nc --arg pipeline "$PIPELINE" '{pipeline_id: $pipeline, all: true}')" | jq -er '.id | select(type == "string" and test("^[0-9a-fA-F-]{36}$"))')
for i in $(seq 1 30); do
  st=$(curl --connect-timeout 10 --max-time 15 --fail --silent "$API/purge-requests/$id" -H "X-Auth-Token: $SCW_SECRET_KEY" | jq -er '.status | select(type == "string")')
  [ "$st" = done ] && { echo "purge terminée"; exit 0; }
  case "$st" in
    error|failed) echo "purge en erreur" >&2; exit 1 ;;
    pending|in_progress) ;;
    *) echo "état de purge inconnu : arrêt" >&2; exit 1 ;;
  esac
  sleep 5
done
echo "purge non terminée après 30 vérifications" >&2; exit 1
