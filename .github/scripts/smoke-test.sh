#!/usr/bin/env bash
# Tests de fumée après publication : statuts 200 sur SMOKE_PATHS, vrai 404, absence de boucle de redirection.
set -euo pipefail
: "${SITE:?}"
SITE=${SITE%/}
[[ "$SITE" = https://* ]] || { echo "SITE doit utiliser HTTPS" >&2; exit 1; }
PATHS=${SMOKE_PATHS:-/}
fail=0
sleep 10   # laisse la purge se propager
for p in $PATHS; do
  c=$(curl --connect-timeout 10 --max-time 30 --silent -L --max-redirs 5 -o /dev/null -w '%{http_code}' "$SITE$p") || { echo "KO transport ou redirection $p"; fail=1; continue; }
  if [ "$c" = 200 ]; then echo "OK  200 $p"; else echo "KO  $c $p"; fail=1; fi
done
c=$(curl --connect-timeout 10 --max-time 30 --silent -o /dev/null -w '%{http_code}' "$SITE/nexiste-pas-$(date +%s)/")
if [ "$c" = 404 ]; then echo "OK  404 chemin absent"; else echo "KO  $c chemin absent (404 attendu)"; fail=1; fi
curl --connect-timeout 10 --max-time 30 --silent -o /dev/null -L --max-redirs 5 "$SITE/" || { echo "KO  boucle de redirection"; fail=1; }
exit $fail
