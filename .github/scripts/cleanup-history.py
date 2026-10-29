#!/usr/bin/env python3
"""Lecture REST de l'historique complet ; produit uniquement l'union des manifestes."""
from datetime import datetime, timedelta, timezone
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile

spec = importlib.util.spec_from_file_location('release_files', Path(__file__).with_name('release-files.py'))
release_files = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_files)


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != 'https':
            raise ValueError('redirection non HTTPS')
        result = super().redirect_request(req, fp, code, msg, headers, newurl)
        if urllib.parse.urlsplit(req.full_url).netloc != urllib.parse.urlsplit(newurl).netloc:
            result.remove_header('Authorization')
        return result


class API:
    def __init__(self):
        self.base = os.environ['GITHUB_API_URL'].rstrip('/')
        self.repo = os.environ['GH_REPO']
        self.token = os.environ['GH_TOKEN']
        if urllib.parse.urlsplit(self.base).scheme != 'https' or not re.fullmatch(r'[\w.-]+/[\w.-]+', self.repo):
            raise ValueError('configuration API invalide')
        self.opener = urllib.request.build_opener(SafeRedirect())

    def open(self, path):
        return self.opener.open(urllib.request.Request(
            self.base + '/repos/' + self.repo + path,
            headers={'Authorization': 'Bearer ' + self.token,
                     'Accept': 'application/vnd.github+json',
                     'X-GitHub-Api-Version': '2022-11-28'}), timeout=30)

    def pages(self, path, field):
        # Aucune troncature silencieuse : trop d'historique => arrêt sans suppression.
        for page in range(1, 101):
            sep = '&' if '?' in path else '?'
            with self.open(f'{path}{sep}per_page=100&page={page}') as response:
                payload = json.load(response)
            items = payload[field]
            yield from items
            if len(items) < 100:
                return
        raise ValueError('pagination incomplète')

    def manifest(self, artifact_id):
        # L'archive n'est pas extraite : aucun chemin ZIP n'est écrit sur disque.
        with self.open(f'/actions/artifacts/{int(artifact_id)}/zip') as response, tempfile.TemporaryFile() as stream:
            while chunk := response.read(1024 * 1024):
                stream.write(chunk)
            stream.seek(0)
            with zipfile.ZipFile(stream) as archive:
                entries = [e for e in archive.infolist() if e.filename == 'release-manifest.txt']
                if len(entries) != 1 or entries[0].file_size > 64 * 1024 * 1024:
                    raise ValueError('manifeste manquant, dupliqué ou excessif')
                return archive.read(entries[0]).decode('utf-8')


def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def select_releases(releases, now):
    # completed_at du job production est postérieur au transfert et aux tests :
    # ne jamais vieillir une release à partir du build, de l'approbation ou du run.updated_at.
    releases = sorted(releases, key=lambda r: (timestamp(r['completed_at']), r['job_id']), reverse=True)
    cutoff = now - timedelta(days=7)
    selected = []
    boundary = False
    for release in releases:
        t = timestamp(release['completed_at'])
        if t > now:
            raise ValueError('date de publication future')
        if t >= cutoff or len(selected) < 2 or not boundary:
            selected.append(release)
            if t < cutoff:
                boundary = True
        else:
            break
    if len(selected) < 2:
        raise ValueError('au moins deux publications requises')
    if any(r['conclusion'] != 'success' for r in selected):
        raise ValueError('publication partielle, échouée ou annulée dans la fenêtre protégée')
    # Sans témoin antérieur au seuil, conserver tout l'historique disponible.
    return selected


def collect(api, workflow):
    releases = []
    workflow = urllib.parse.quote(workflow, safe='')
    runs = api.pages(f'/actions/workflows/{workflow}/runs?branch=main', 'workflow_runs')
    for run in runs:
        if run['head_branch'] != 'main' or run['event'] not in ('push', 'workflow_dispatch'):
            continue
        # filter=all inclut les tentatives antérieures d'une réexécution du même run.
        for job in api.pages(f"/actions/runs/{int(run['id'])}/jobs?filter=all", 'jobs'):
            if job['name'] != 'production' or job['conclusion'] == 'skipped':
                continue
            if job['status'] != 'completed' or not job['completed_at']:
                raise ValueError('publication encore active ou historique incomplet')
            releases.append({'run_id': run['id'], 'attempt': job['run_attempt'],
                             'job_id': job['id'], 'completed_at': job['completed_at'],
                             'conclusion': job['conclusion']})
    return releases


def keep_keys(api, selected):
    keys = set()
    cache = {}
    for release in selected:
        run_id = release['run_id']
        if run_id not in cache:
            cache[run_id] = list(api.pages(f'/actions/runs/{int(run_id)}/artifacts', 'artifacts'))
        name = f"release-{run_id}-{release['attempt']}"
        matches = [a for a in cache[run_id] if a['name'] == name]
        if len(matches) != 1 or matches[0]['expired']:
            raise ValueError('artefact absent, expiré ou ambigu')
        keys.update(release_files.manifest_keys(api.manifest(matches[0]['id'])))
    return keys


def main():
    api = API()
    selected = select_releases(collect(api, os.environ['WORKFLOW']), datetime.now(timezone.utc))
    keys = keep_keys(api, selected)
    Path(sys.argv[1]).write_text(''.join(key + '\n' for key in sorted(keys)))
    print(f'{len(selected)} publications protégées ; {len(keys)} clés conservées')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Pas de corps HTTP, jeton, URL signée ni paramètres d'exploitation dans les logs.
        sys.exit('Historique ou manifestes invalides/incomplets : arrêt sans suppression')
