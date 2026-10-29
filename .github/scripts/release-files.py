#!/usr/bin/env python3
"""Valide l'inventaire SHA-256 et prépare les trois phases de publication."""
import hashlib
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys


def key_ok(key):
    return (bool(key) and not key.startswith('/') and
            all(p not in ('', '.', '..') for p in key.split('/')) and
            not any(ord(c) < 32 or ord(c) == 127 or c == '\\' for c in key))


def manifest_keys(data):
    keys = []
    for line in data.splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  \./(.+)', line)
        if not match or not key_ok(match[2]):
            raise ValueError('manifeste mal formé ou chemin non autorisé')
        keys.append(match[2])
    if not keys or len(keys) != len(set(keys)) or not {'index.html', '404.html'} <= set(keys):
        raise ValueError('manifeste vide, incomplet ou avec doublons')
    return keys


def inventory(root):
    files = []
    for path in root.rglob('*'):
        if path.is_symlink():
            raise ValueError('lien symbolique dans la release')
        if path.is_file():
            key = path.relative_to(root).as_posix()
            if not key_ok(key):
                raise ValueError('chemin non autorisé dans la release')
            files.append(key)
    if not {'index.html', '404.html'} <= set(files):
        raise ValueError('index.html ou 404.html absent')
    return files


def phase(key, prefixes):
    if key.lower().endswith('.html'):
        return 'html'
    for prefix in prefixes:
        if key.startswith(prefix + '/'):
            # Astro garantit les noms de build sous _astro ; Docusaurus :
            # main.<hash>.js, styles.<hash>.css, image-<hash>.png, etc.
            if prefix == '_astro' or re.search(r'[.-][0-9a-fA-F]{8,64}(?=\.|$)', PurePosixPath(key).name):
                return 'long'
    return 'short'


def main():
    root = Path(sys.argv[1])
    files = inventory(root)
    prefixes = os.environ.get('IMMUTABLE_PREFIXES', '_astro').split()
    if 'assets/js' in prefixes:
        for prefix in ('assets/js', 'assets/css'):
            if not any(k.startswith(prefix + '/') and phase(k, prefixes) == 'long' for k in files):
                raise ValueError('assets Docusaurus hachés JS/CSS absents : vérifier le build')
    if len(sys.argv) >= 3:
        data = Path(sys.argv[2]).read_text()
        keys = manifest_keys(data)
        if set(keys) != set(files):
            raise ValueError('inventaire différent du manifeste')
        for line, key in zip(data.splitlines(), keys):
            with (root / key).open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            if digest != line[:64]:
                raise ValueError('empreinte de release différente du manifeste')
    if len(sys.argv) >= 4:
        staging = Path(sys.argv[3])
        for group in ('long', 'short', 'html'):
            (staging / group).mkdir(parents=True)
        for key in files:
            dest = staging / phase(key, prefixes) / key
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / key, dest)
    print(f'Release validée : {len(files)} fichiers')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError):
        sys.exit('Release invalide : inventaire, chemins, empreintes ou assets à vérifier')
