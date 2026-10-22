#!/usr/bin/env node
// Normalize legacy absolute links only when a directory index exists.
import {readdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export function normalizeInternalLinks(buildDir) {
  const root = resolve(buildDir);
  const origin = 'https://docs.gostoa.dev';
  function normalize(value) {
    if (!(value.startsWith('/') && !value.startsWith('//')) && !value.startsWith(origin + '/')) return value;
    const url = new URL(value, origin);
    const target = resolve(root, '.' + decodeURIComponent(url.pathname), 'index.html');
    if (!target.startsWith(root + sep) || !existsSync(target)) return value;
    url.pathname = url.pathname.replace(/\/$/, '') + '/';
    return (value.startsWith(origin) ? url.origin : '') + url.pathname + url.search + url.hash;
  }
  const attribute = (tag, name) => {
    const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
  };
  function visit(dir) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        let html = readFileSync(file, 'utf8').replace(/\bhref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_, double, single, bare) => `href="${normalize(double ?? single ?? bare)}"`);
        // headTags are appended by Docusaurus. Move these before executable code,
        // preserving the mandatory charset declaration at the front of the head.
        const early = [];
        html = html.replace(/<meta\b[^>]*>|<script\b[^>]*><\/script>/gi, (tag) => {
          const policy = attribute(tag, 'http-equiv')?.toLowerCase();
          if (policy === 'content-security-policy' || attribute(tag, 'name') === 'referrer' || attribute(tag, 'src') === '/js/theme-cookie.js') {
            early.push(tag);
            return '';
          }
          return tag;
        });
        early.sort((a, b) => Number(a.startsWith('<script')) - Number(b.startsWith('<script')));
        html = html.replace(/(<head\b[^>]*>)(<meta\b[^>]*charset[^>]*>)?/i, (_, head, charset = '') => head + charset + early.join(''));
        writeFileSync(file, html);
      }
    }
  }
  visit(root);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  normalizeInternalLinks(process.argv[2] || 'build');
}
