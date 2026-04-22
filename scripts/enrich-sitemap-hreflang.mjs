#!/usr/bin/env node
/**
 * enrich-sitemap-hreflang.mjs — Add xhtml:link hreflang alternates to sitemaps
 *
 * Docusaurus generates separate sitemaps per locale but without cross-language
 * xhtml:link annotations. This script post-processes both sitemaps to add them,
 * reinforcing the hreflang signal for Google (in addition to HTML <link> tags).
 *
 * Usage: node scripts/enrich-sitemap-hreflang.mjs [build_dir]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const buildDir = process.argv[2] || 'build';
const SITE_URL = 'https://docs.gostoa.dev';

const enSitemapPath = join(buildDir, 'sitemap.xml');
const frSitemapPath = join(buildDir, 'fr', 'sitemap.xml');

/** Extract all <loc> URLs from sitemap XML */
function extractUrls(xml) {
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

/** Strip site URL to get path (origin-checked, not substring-matched) */
function toPath(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin === SITE_URL) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // not a parsable URL — fall through
  }
  return url;
}

// Read both sitemaps
const enXml = readFileSync(enSitemapPath, 'utf-8');
const frXml = readFileSync(frSitemapPath, 'utf-8');

// Build path sets
const enPaths = new Set(extractUrls(enXml).map(toPath));
const frBasePaths = new Set(
  extractUrls(frXml).map((url) => toPath(url).replace(/^\/fr/, ''))
);

/**
 * Enrich a sitemap with xhtml:link alternates.
 * For each <url> entry, if a counterpart exists in the other locale,
 * inject hreflang alternate links before </url>.
 */
function enrichSitemap(xml, locale) {
  // Add xmlns:xhtml if missing
  if (!xml.includes('xmlns:xhtml')) {
    xml = xml.replace(
      '<urlset ',
      '<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml" '
    );
  }

  let enrichedCount = 0;

  // For each </url>, find the preceding <loc> and inject alternates
  xml = xml.replace(/<url>([\s\S]*?)<\/url>/g, (match, inner) => {
    const locMatch = inner.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) return match;

    const url = locMatch[1];
    const path = toPath(url);
    const basePath = locale === 'fr' ? path.replace(/^\/fr/, '') : path;

    // Check if counterpart exists
    const hasEn = enPaths.has(basePath);
    const hasFr = frBasePaths.has(basePath);

    if (hasEn && hasFr) {
      enrichedCount++;
      const alternates = [
        `<xhtml:link rel="alternate" hreflang="en-US" href="${SITE_URL}${basePath}"/>`,
        `<xhtml:link rel="alternate" hreflang="fr-FR" href="${SITE_URL}/fr${basePath}"/>`,
        `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${basePath}"/>`,
      ].join('');
      return `<url>${inner}${alternates}</url>`;
    }

    return match;
  });

  return { xml, enrichedCount };
}

// Enrich both sitemaps
const enResult = enrichSitemap(enXml, 'en');
const frResult = enrichSitemap(frXml, 'fr');

writeFileSync(enSitemapPath, enResult.xml);
writeFileSync(frSitemapPath, frResult.xml);

console.log(
  `Sitemap hreflang enrichment done. EN: ${enResult.enrichedCount} URLs enriched, FR: ${frResult.enrichedCount} URLs enriched.`
);
