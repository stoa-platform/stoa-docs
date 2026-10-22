#!/usr/bin/env node
// Static compatibility pages return HTTP 200, not HTTP redirects.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const manifest = JSON.parse(readFileSync(new URL('../redirects.json', import.meta.url), 'utf8'));
const origin = 'https://docs.gostoa.dev';
const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const validPath = (value) => typeof value === 'string' && /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*\/?$/.test(value);

export function generateRedirects(buildDir, entries = manifest) {
  const root = resolve(buildDir);
  const sources = new Set();
  // Preflight the whole manifest before producing anything.
  const pages = entries.map(({source, destination}) => {
    if (!validPath(source) || source === '/' || source.endsWith('/') ||
        !validPath(destination) || !destination.endsWith('/') ||
        destination.replace(/\/$/, '') === source || sources.has(source)) {
      throw new Error('Invalid or duplicate redirect path');
    }
    sources.add(source);
    const file = join(root, source.slice(1), 'index.html');
    if (existsSync(file) || existsSync(join(root, source.slice(1) + '.html'))) {
      throw new Error(`Refusing to overwrite a page: ${source}`);
    }
    if (!existsSync(join(root, destination.slice(1), 'index.html'))) {
      throw new Error(`Redirect destination has no index: ${destination}`);
    }
    return {file, destination};
  });
  for (const {file, destination} of pages) {
    mkdirSync(resolve(file, '..'), {recursive: true});
    const canonical = escapeHtml(origin + destination);
    writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><meta name="referrer" content="strict-origin-when-cross-origin"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><meta http-equiv="refresh" content="0; url=${canonical}"><link rel="canonical" href="${canonical}"><title>Page moved / Page déplacée</title></head><body><p>Page moved / Page déplacée : <a href="${canonical}">Continue / Continuer</a></p></body></html>\n`, {flag: 'wx'});
  }
  // Defense in depth: exclude sources and any alternates pointing to them.
  for (const sitemap of [join(root, 'sitemap.xml'), join(root, 'fr/sitemap.xml')]) {
    if (!existsSync(sitemap)) continue;
    const isSource = (url) => sources.has(new URL(url, origin).pathname.replace(/\/$/, ''));
    const xml = readFileSync(sitemap, 'utf8').replace(/<url\b[^>]*>[\s\S]*?<\/url>/g, (entry) => {
      const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
      if (loc && isSource(loc)) return '';
      return entry.replace(/<xhtml:link\b[^>]*href="([^"]+)"[^>]*\/>/g, (link, href) => isSource(href) ? '' : link);
    });
    writeFileSync(sitemap, xml);
  }
  return pages.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Generated ${generateRedirects(process.argv[2] || 'build')} static redirect pages (HTTP 200).`);
}
