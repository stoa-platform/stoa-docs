#!/usr/bin/env bash
# Nettoyage différé : union validée des releases récentes, du témoin à J-7 et des 2 dernières.
# Le workflow calcule KEEP_FILE avant de fournir les secrets Scaleway à ce script.
set -euo pipefail
: "${BUCKET:?}" "${REGION:?}" "${KEEP_FILE:?}"
DRY_RUN=${DRY_RUN:-1}
[[ "$DRY_RUN" = 0 || "$DRY_RUN" = 1 ]] || { echo "DRY_RUN invalide" >&2; exit 1; }
aws --version 2>&1 | grep -q 'aws-cli/2\.' || { echo "AWS CLI v2 requise" >&2; exit 1; }
S3="https://s3.${REGION}.scw.cloud"
export LC_ALL=C AWS_DEFAULT_REGION="$REGION" AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required AWS_EC2_METADATA_DISABLED=true
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT

aws s3api list-objects-v2 --bucket "$BUCKET" --endpoint-url "$S3" --output json > "$work/bucket.json"
python3 - "$KEEP_FILE" "$work" "$(dirname "$0")" <<'PY'
import importlib.util
import json
from pathlib import Path
import sys
spec = importlib.util.spec_from_file_location('release_files', Path(sys.argv[3]) / 'release-files.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
work = Path(sys.argv[2])
keep_lines = Path(sys.argv[1]).read_text().splitlines()
keep = set(keep_lines)
if not keep or len(keep) != len(keep_lines) or not all(module.key_ok(k) for k in keep) or not {'index.html', '404.html'} <= keep:
    sys.exit('Union des manifestes invalide : arrêt')
payload = json.loads((work / 'bucket.json').read_text())
if payload.get('IsTruncated') or payload.get('NextContinuationToken'):
    sys.exit('Inventaire bucket incomplet : arrêt')
keys = {obj['Key'] for obj in payload.get('Contents', [])}
if not keys or not all(module.key_ok(k) for k in keys):
    sys.exit('Inventaire bucket vide ou chemins invalides : arrêt')
if not keep <= keys:
    sys.exit('Objets protégés manquants dans le bucket : arrêt')
delete = keys - keep
print(f'Objets : {len(keys)} ; protégés : {len(keep)} ; candidats : {len(delete)}')
# Les garde-fous s'appliquent également à la simulation.
if {'index.html', '404.html'} & delete or len(delete) > len(keys) // 2:
    sys.exit('Suppression protégée ou supérieure à 50 % du bucket : arrêt')
(work / 'delete.txt').write_text(''.join(k + '\n' for k in sorted(delete)))
PY
cat "$work/delete.txt"
if [ "$DRY_RUN" = 1 ]; then echo "À BLANC : aucune suppression"; exit 0; fi
while IFS= read -r k; do
  aws s3api delete-object --bucket "$BUCKET" --key "$k" --endpoint-url "$S3" > /dev/null
  echo "supprimé : $k"
done < "$work/delete.txt"
