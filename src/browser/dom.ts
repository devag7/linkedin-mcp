/**
 * DOM / rendered-page fallback for endpoints that have no clean Voyager XHR
 * (LinkedIn server-renders people-search results, so there is no API call to
 * intercept). We navigate a short-lived page and extract from the rendered DOM.
 *
 * This is the deliberately-tolerant fallback layer: it prefers stable anchors
 * (profile `/in/` links, `aria-hidden` name spans) over brittle class names,
 * and degrades to whatever it can find rather than throwing.
 */

import type { BrowserEngine } from './engine.js';
import type { Logger } from '../types.js';

export interface ScrapedPerson {
  name?: string;
  headline?: string;
  location?: string;
  profileUrl?: string;
  publicIdentifier?: string;
}

const ORIGIN = 'https://www.linkedin.com';

/**
 * Scrape the people-search results page. Returns each result's name, headline,
 * location, and — most usefully — its public identifier, which `get_profile`
 * (API) can then expand into a full structured profile.
 */
export async function scrapePeopleSearch(
  engine: BrowserEngine,
  keywords: string,
  count: number,
  logger: Logger,
): Promise<ScrapedPerson[]> {
  const url = `${ORIGIN}/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
  const page = await engine.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for at least one profile link to render (or give up quietly).
    await page.waitForSelector('a[href*="/in/"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const results = await page.evaluate((max: number) => {
      const clean = (s: string | null | undefined): string | undefined =>
        (s ?? '').replace(/\s+/g, ' ').trim() || undefined;

      // Anchor on profile links inside the results region; dedupe by slug.
      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]'),
      );
      const seen = new Set<string>();
      const out: Array<Record<string, string | undefined>> = [];

      for (const a of anchors) {
        const href = a.href.split('?')[0] ?? a.href;
        const m = href.match(/\/in\/([^/]+)\/?$/);
        if (!m || !m[1]) continue;
        const slug = decodeURIComponent(m[1]);
        if (seen.has(slug)) continue;

        // The result card is an ancestor that also holds the headline/location.
        const card =
          a.closest('li') ??
          a.closest('[data-chameleon-result-urn]') ??
          a.closest('div[class*="entity-result"]') ??
          a.parentElement?.parentElement ??
          undefined;
        if (!card) continue;

        // Name: a visually-hidden span inside the link is the cleanest source.
        // Some result links wrap the whole card, so normalize: take the text
        // before the "• <degree>" separator and de-duplicate a doubled name.
        let name =
          clean(a.querySelector('span[aria-hidden="true"]')?.textContent) ??
          clean(a.textContent);
        if (name) {
          name = name.split(/\s*[•·]\s*/)[0]?.trim();
          if (name) {
            const h = Math.floor(name.length / 2);
            if (name[h] === ' ' && name.slice(0, h).trim() === name.slice(h).trim()) {
              name = name.slice(0, h).trim();
            }
          }
        }
        if (!name || /^(view|connect|message|follow|status is)/i.test(name)) continue;

        const subtitles = Array.from(
          card.querySelectorAll<HTMLElement>(
            '[class*="subtitle"], [class*="entity-result__primary-subtitle"], [class*="entity-result__secondary-subtitle"]',
          ),
        )
          .map((el) => clean(el.textContent))
          .filter((t): t is string => !!t);

        seen.add(slug);
        out.push({
          name,
          publicIdentifier: slug,
          profileUrl: href,
          headline: subtitles[0],
          location: subtitles[1],
        });
        if (out.length >= max) break;
      }
      return out;
    }, count);

    logger.debug('scrapePeopleSearch', { keywords, found: results.length });
    return results as ScrapedPerson[];
  } finally {
    await page.close().catch(() => {});
  }
}
