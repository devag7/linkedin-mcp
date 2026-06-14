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

export interface ScrapedCompanyResult {
  name?: string;
  universalName?: string;
  companyUrl?: string;
  subtitle?: string;
}

/** Scrape company-search results (SSR, like people search). Returns name +
 *  universalName (slug) — pass the slug to get_company for full details. */
export async function scrapeCompanySearch(
  engine: BrowserEngine,
  keywords: string,
  count: number,
  logger: Logger,
): Promise<ScrapedCompanyResult[]> {
  const url = `${ORIGIN}/search/results/companies/?keywords=${encodeURIComponent(keywords)}`;
  const page = await engine.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('a[href*="/company/"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const results = await page.evaluate((max: number) => {
      const clean = (s: string | null | undefined): string | undefined =>
        (s ?? '').replace(/\s+/g, ' ').trim() || undefined;
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/company/"]'));
      const seen = new Set<string>();
      const out: Array<Record<string, string | undefined>> = [];
      for (const a of anchors) {
        const href = a.href.split('?')[0] ?? a.href;
        const m = href.match(/\/company\/([^/]+)\/?$/);
        if (!m || !m[1]) continue;
        const slug = decodeURIComponent(m[1]);
        if (seen.has(slug)) continue;
        const card =
          a.closest('li') ?? a.closest('[data-chameleon-result-urn]') ?? a.parentElement?.parentElement ?? undefined;
        let name =
          clean(a.querySelector('span[aria-hidden="true"]')?.textContent) ?? clean(a.textContent);
        if (name) {
          name = name.split(/\s*[•·]\s*/)[0]?.trim();
          // Company cards concat name+subtitle with no separator; collapse the
          // leading duplicated token ("Fintech Fintech …" → "Fintech …").
          if (name) name = name.replace(/^(\S.*?)\s+\1(\s|$)/, '$1$2').trim();
        }
        if (!name || /^(view|follow)/i.test(name)) continue;
        const subtitle = card
          ? clean(card.querySelector('[class*="subtitle"]')?.textContent)
          : undefined;
        seen.add(slug);
        out.push({ name, universalName: slug, companyUrl: href, subtitle });
        if (out.length >= max) break;
      }
      return out;
    }, count);
    logger.debug('scrapeCompanySearch', { keywords, found: results.length });
    return results as ScrapedCompanyResult[];
  } finally {
    await page.close().catch(() => {});
  }
}

export interface ScrapedCompany {
  name?: string;
  tagline?: string;
  description?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  headquarters?: string;
  founded?: string;
  universalName: string;
}

/**
 * Scrape a company's About page (server-rendered; no clean Voyager XHR). Pulls
 * the overview + the labelled detail rows (Website, Industry, Company size,
 * Headquarters, Founded) via tolerant label-matching rather than brittle classes.
 */
export async function scrapeCompany(
  engine: BrowserEngine,
  universalName: string,
  logger: Logger,
): Promise<ScrapedCompany> {
  const url = `${ORIGIN}/company/${encodeURIComponent(universalName)}/about/`;
  const page = await engine.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const data = await page.evaluate(() => {
      const clean = (s: string | null | undefined): string | undefined =>
        (s ?? '').replace(/\s+/g, ' ').trim() || undefined;

      const name = clean(document.querySelector('h1')?.textContent);

      // Description: the longest paragraph in an "about"/"description" region.
      let description: string | undefined;
      const paras = Array.from(
        document.querySelectorAll<HTMLElement>('[class*="description"] p, [class*="about"] p, p'),
      );
      for (const p of paras) {
        const t = clean(p.textContent);
        if (t && t.length > (description?.length ?? 60)) description = t;
      }

      // Labelled detail rows: find dt/dd or heading/value pairs by label text.
      const fields: Record<string, string | undefined> = {};
      const labels = ['Website', 'Industry', 'Company size', 'Headquarters', 'Founded', 'Specialties'];
      const dts = Array.from(document.querySelectorAll<HTMLElement>('dt, h3, h4'));
      for (const dt of dts) {
        const label = clean(dt.textContent);
        if (!label) continue;
        const match = labels.find((l) => label.toLowerCase().startsWith(l.toLowerCase()));
        if (!match) continue;
        const dd = dt.nextElementSibling;
        const val = clean(dd?.textContent) ?? clean((dt.parentElement?.querySelector('dd'))?.textContent);
        if (val) fields[match] = val;
      }

      return {
        name,
        description,
        website: fields['Website'],
        industry: fields['Industry'],
        companySize: fields['Company size'],
        headquarters: fields['Headquarters'],
        founded: fields['Founded'],
      };
    });

    logger.debug('scrapeCompany', { universalName, hasName: !!data.name });
    return { ...data, universalName };
  } finally {
    await page.close().catch(() => {});
  }
}

export interface ScrapedCompanyPost {
  text?: string;
  meta?: string;
}

/**
 * Scrape a company's recent posts from its Posts tab (server-rendered, no clean
 * Voyager XHR for the org page feed). Returns each post's visible text plus a
 * short meta line (relative time / reactions). Scrolls once to load more.
 */
export async function scrapeCompanyPosts(
  engine: BrowserEngine,
  universalName: string,
  count: number,
  logger: Logger,
): Promise<ScrapedCompanyPost[]> {
  const url = `${ORIGIN}/company/${encodeURIComponent(universalName)}/posts/`;
  const page = await engine.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('div.feed-shared-update-v2, [data-urn*="activity"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, 3000).catch(() => {});
    await page.waitForTimeout(1500);

    const posts = await page.evaluate((max: number) => {
      const clean = (s: string | null | undefined): string | undefined =>
        (s ?? '').replace(/\s+/g, ' ').trim() || undefined;
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>('div.feed-shared-update-v2, [data-urn*="urn:li:activity"]'),
      );
      const seen = new Set<string>();
      const out: Array<Record<string, string | undefined>> = [];
      for (const card of cards) {
        const textEl = card.querySelector<HTMLElement>(
          '.feed-shared-update-v2__description, .update-components-text, [class*="commentary"]',
        );
        const text = clean(textEl?.textContent);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        const meta = clean(
          card.querySelector<HTMLElement>('.update-components-actor__sub-description, time, [class*="sub-description"]')
            ?.textContent,
        );
        out.push({ text, meta });
        if (out.length >= max) break;
      }
      return out;
    }, count);

    logger.debug('scrapeCompanyPosts', { universalName, found: posts.length });
    return posts as ScrapedCompanyPost[];
  } finally {
    await page.close().catch(() => {});
  }
}

export interface ScrapedEmployee {
  name?: string;
  headline?: string;
  publicIdentifier?: string;
  profileUrl?: string;
}

/**
 * Scrape a company's People tab — the employees LinkedIn surfaces for the org.
 * Returns name + headline + public identifier (feed the slug to get_profile).
 * SSR like people search; tolerant anchor-on-`/in/` extraction.
 */
export async function scrapeCompanyEmployees(
  engine: BrowserEngine,
  universalName: string,
  count: number,
  logger: Logger,
): Promise<ScrapedEmployee[]> {
  const url = `${ORIGIN}/company/${encodeURIComponent(universalName)}/people/`;
  const page = await engine.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('a[href*="/in/"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, 2500).catch(() => {});
    await page.waitForTimeout(1500);

    const employees = await page.evaluate((max: number) => {
      const clean = (s: string | null | undefined): string | undefined =>
        (s ?? '').replace(/\s+/g, ' ').trim() || undefined;
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]'));
      const seen = new Set<string>();
      const out: Array<Record<string, string | undefined>> = [];
      for (const a of anchors) {
        const href = a.href.split('?')[0] ?? a.href;
        const m = href.match(/\/in\/([^/]+)\/?$/);
        if (!m || !m[1]) continue;
        const slug = decodeURIComponent(m[1]);
        if (seen.has(slug)) continue;
        // Mark seen at extraction — before any name/card filtering — so a later
        // anchor with the same slug can't slip past the dedup if this one is dropped.
        seen.add(slug);
        const card =
          a.closest('li') ?? a.closest('[class*="org-people-profile-card"]') ?? a.parentElement?.parentElement ?? undefined;
        if (!card) continue;
        let name =
          clean(card.querySelector('[class*="profile-card__title"], [class*="entity-result__title"]')?.textContent) ??
          clean(a.querySelector('span[aria-hidden="true"]')?.textContent) ??
          clean(a.textContent);
        if (name) name = name.split(/\s*[•·]\s*/)[0]?.trim();
        if (!name || /^(view|connect|message|follow|status is)/i.test(name)) continue;
        const headline = clean(
          card.querySelector('[class*="profile-card__subtitle"], [class*="entity-result__primary-subtitle"], [class*="subtitle"]')
            ?.textContent,
        );
        out.push({ name, headline, publicIdentifier: slug, profileUrl: href });
        if (out.length >= max) break;
      }
      return out;
    }, count);

    logger.debug('scrapeCompanyEmployees', { universalName, found: employees.length });
    return employees as ScrapedEmployee[];
  } finally {
    await page.close().catch(() => {});
  }
}
