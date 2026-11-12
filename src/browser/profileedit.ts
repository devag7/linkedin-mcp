/**
 * Profile-edit automation (headline + About) by driving the real editor UI.
 *
 * WHY DOM AUTOMATION AND NOT A REPLAYED HTTP CALL
 * ------------------------------------------------
 * LinkedIn's profile editor is a server-driven UI (SDUI). The SPA loads the
 * edit form with `POST /flagship-web/rsc-action/actions/component` and saves
 * with `POST /flagship-web/rsc-action/actions/server-request?sduiid=…saveProfileIntroForm`.
 * The captured save body carries only field KEYS (`headlineIntroForm`,
 * `aboutIntroForm`, …) mapped into a client-side `MemoryNamespace`; the actual
 * VALUES never travel in the request body. A captured request therefore cannot
 * be replayed with different text — the value lives in the page's own state.
 *
 * The only reliable way to write a different value is to drive the editor the
 * way a human does: open it, set the field, click Save. That is what this
 * module does. Selectors are matched defensively (several fallbacks each,
 * because LinkedIn obfuscates class names) and every failure path reports what
 * it actually saw instead of silently doing nothing.
 *
 * Verified against the live UI 2026-11-12:
 *   - the intro editor is opened by an ANCHOR `<a aria-label="Edit intro">`
 *     (not a button, and there is no `data-control-name` any more);
 *   - the editor modal is titled "Basic info";
 *   - the headline field lives in a textarea whose id contains "headline";
 *   - the About editor is reached from the About section's own pencil.
 */

import type { BrowserEngine } from './engine.js';
import type { Logger } from '../types.js';
import type { Page } from 'patchright';

const ORIGIN = 'https://www.linkedin.com';
const OWN_PROFILE = `${ORIGIN}/in/me/`;
/** Marker attribute stamped on the element we edit so we can wait for it to go. */
const MARK = 'data-nr-profile-edit';

/** Profile fields this module knows how to write. */
export type EditableProfileField = 'headline' | 'about';

export interface ProfileEditOutcome {
  field: EditableProfileField;
  /** Text that was in the field before the edit (truncated). */
  previous: string;
  /** Text that was written (truncated). */
  next: string;
  /** True when the editor reported a save (modal closed, no error banner). */
  saved: boolean;
  /** True when a re-read of the field confirmed the new value landed. */
  verified: boolean;
  /** HTTP status of LinkedIn's own save request (0 = never observed). */
  httpStatus: number;
  /** Diagnostic detail for the caller when something went wrong. */
  detail?: string;
}

const TRUNC = 220;

function clip(s: string, n = TRUNC): string {
  const t = (s ?? '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * esbuild (used by tsx) rewrites named function expressions with a `__name`
 * helper. Inside `page.evaluate` that helper does not exist in the page, so
 * every evaluated callback containing a named inner function would throw
 * "__name is not defined".
 *
 * The fix has to be installed as a STRING expression: `page.addInitScript` is
 * a no-op in this Patchright build (verified), but a string-form
 * `page.evaluate` is passed through to the page verbatim. A compiled (tsc)
 * build never needs this — it only matters when the server is run from source
 * through tsx — so the install is cheap and harmless.
 */
async function installEvalHelpers(page: Page): Promise<void> {
  await page
    .evaluate(
      'globalThis.__name = globalThis.__name || function (f) { return f; };',
    )
    .catch(() => {
      /* A page that is still navigating will be re-tried after the next load. */
    });
}

/** Click the first element matching any of the selectors (in-page). */
async function clickFirst(page: Page, selectors: string[]): Promise<boolean> {
  for (const sel of selectors) {
    const clicked = await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement | null;
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    }, sel);
    if (clicked) return true;
  }
  return false;
}

/** Click the Save button in the open editor modal. */
async function clickSave(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const save = buttons.find((b) => {
      if (b.hasAttribute('disabled')) return false;
      const t = (b.textContent || '').trim();
      return /^save$/i.test(t) || /save changes/i.test(t);
    });
    if (!save) return false;
    save.scrollIntoView({ block: 'center' });
    save.click();
    return true;
  });
}

/** True when the page shows the SDUI error banner. */
async function hasSaveError(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    if (/Something went wrong/i.test(text)) return 'Something went wrong';
    if (/couldn'?t save|unable to save/i.test(text)) return 'unable to save';
    return undefined;
  });
}

/** Wait until the element we marked has been detached from the DOM. */
async function waitForEditorClosed(page: Page, timeoutMs = 20000): Promise<boolean> {
  try {
    await page.waitForFunction(
      (m) => !document.querySelector(`[${m}]`),
      MARK,
      { timeout: timeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

/** Scroll the whole page once so lazy-loaded sections (About) render. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.floor(window.innerHeight * 0.8);
    const height = () => document.body.scrollHeight;
    for (let y = 0; y < height(); y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 250));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 250));
  });
}

/** Open the "Edit intro" (basic info) modal. */
async function openIntroEditor(page: Page): Promise<boolean> {
  const opened = await clickFirst(page, [
    'a[aria-label="Edit intro"]',
    'button[aria-label="Edit intro"]',
    '[data-control-name*="edit_intro" i]',
    'a[href*="/in/me/edit"]',
  ]);
  if (!opened) return false;
  try {
    await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 20000 });
    return true;
  } catch {
    return false;
  }
}

/** Open the About section editor from the profile page. */
async function openAboutEditor(page: Page): Promise<boolean> {
  await scrollThrough(page);
  // Fast path: a section wrapper carrying a data-section="about" hint.
  let opened = await clickFirst(page, [
    'section[data-section="about"] button[aria-label*="Edit" i]',
    'section[data-section="about"] a[aria-label*="Edit" i]',
  ]);
  if (!opened) {
    // Generic path: find the About heading, walk up to its card, click its pencil.
    opened = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2, h3, strong'));
      const heading = headings.find((h) => (h.textContent || '').trim() === 'About');
      if (!heading) return false;
      let node: HTMLElement | null = heading.parentElement;
      for (let depth = 0; depth < 6 && node; depth += 1) {
        const control = node.querySelector(
          'button[aria-label*="Edit" i], a[aria-label*="Edit" i]',
        ) as HTMLElement | null;
        if (control) {
          control.scrollIntoView({ block: 'center' });
          control.click();
          return true;
        }
        node = node.parentElement;
      }
      return false;
    });
  }
  if (!opened) return false;
  try {
    await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 20000 });
    return true;
  } catch {
    return false;
  }
}

/** Close the open editor modal without saving (verification re-open, cancel). */
async function closeModal(page: Page): Promise<void> {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const cancel = buttons.find((b) => /^(cancel|close)$/i.test((b.textContent || '').trim()));
    if (cancel) {
      cancel.click();
      return;
    }
    const esc = document.querySelector('[aria-label="Dismiss"]') as HTMLElement | null;
    if (esc) esc.click();
  });
  await page.waitForTimeout(800);
}

interface FieldProbe {
  found: boolean;
  before: string;
  after: string;
  tag: string;
  reason?: string;
}

/**
 * Find the editable surface for a field, read its current text, and write the
 * new text into it. Runs as ONE in-page evaluation so the element handle
 * never has to cross the bridge.
 *
 * `preferred` is an ordered list of selectors; the first match wins. When none
 * match, the largest editable surface inside the open dialog is used — LinkedIn
 * ships the About editor as a contenteditable and the headline editor as a
 * textarea, and both have moved between renders.
 */
async function writeField(
  page: Page,
  preferred: string[],
  value: string,
): Promise<FieldProbe> {
  return page.evaluate(
    ({ preferred: pref, value: val, mark }) => {
      const isTextControl = (el: Element): el is HTMLTextAreaElement | HTMLInputElement =>
        el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;

      const readText = (el: Element): string =>
        isTextControl(el)
          ? el.value
          : ((el as HTMLElement).innerText || el.textContent || '');

      const isVisible = (el: Element): boolean => {
        if (!el.getClientRects().length) return false;
        const style = window.getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none';
      };

      const visibleEditables = (): HTMLElement[] =>
        Array.from(
          document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'),
        ).filter((e) => isVisible(e)) as HTMLElement[];

      let el: HTMLElement | null = null;
      for (const sel of pref) {
        const candidate = document.querySelector(sel) as HTMLElement | null;
        if (candidate && isVisible(candidate)) {
          el = candidate;
          break;
        }
      }
      if (!el) {
        const candidates = visibleEditables();
        if (!candidates.length) {
          return { found: false, before: '', after: '', tag: '', reason: 'no editable element found' };
        }
        candidates.sort((a, b) => readText(b).length - readText(a).length);
        el = candidates[0] ?? null;
      }
      if (!el) {
        return { found: false, before: '', after: '', tag: '', reason: 'no editable element found' };
      }

      const before = readText(el);
      if (isTextControl(el)) {
        const proto =
          el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc?.set) desc.set.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Rich editor (LinkedIn uses TipTap/ProseMirror). Plain innerHTML does
        // NOT update the editor's internal state, so the save would carry the
        // OLD text. execCommand drives a real input/transaction the editor
        // understands, which is what makes the save stick.
        el.focus();
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(el);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        document.execCommand('delete');
        const paragraphs = val.split(/\n{2,}/);
        paragraphs.forEach((paragraph, index) => {
          if (index > 0) document.execCommand('insertParagraph');
          document.execCommand('insertText', false, paragraph);
        });
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      el.setAttribute(mark, '1');
      return { found: true, before, after: readText(el), tag: el.tagName };
    },
    { preferred, value, mark: MARK },
  );
}

/** Read the current text of the field without changing it. */
async function readField(page: Page, preferred: string[]): Promise<string> {
  const probe = await page.evaluate(
    ({ preferred: pref }) => {
      const isTextControl = (el: Element): el is HTMLTextAreaElement | HTMLInputElement =>
        el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
      const readText = (el: Element): string =>
        isTextControl(el)
          ? el.value
          : ((el as HTMLElement).innerText || el.textContent || '');
      for (const sel of pref) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) return readText(el);
      }
      const isVisible = (el: Element): boolean => {
        if (!el.getClientRects().length) return false;
        const style = window.getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none';
      };
      const candidates = Array.from(
        document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'),
      ).filter((e) => isVisible(e)) as HTMLElement[];
      candidates.sort((a, b) => readText(b).length - readText(a).length);
      return candidates.length ? readText(candidates[0] as HTMLElement) : '';
    },
    { preferred },
  );
  return probe;
}

const HEADLINE_FIELD: readonly [string, ...string[]] = [
  'textarea[id*="headline" i]',
  '[role="textbox"][contenteditable="true"]',
  '.ProseMirror[contenteditable="true"]',
  '[contenteditable="true"]',
];
const ABOUT_FIELD: readonly [string, ...string[]] = [
  'textarea[id*="about" i]',
  'textarea[data-id*="about" i]',
  '[role="textbox"][contenteditable="true"]',
  '.ProseMirror[contenteditable="true"]',
  '[contenteditable="true"]',
];

/**
 * Write one profile field through the live editor and verify the result.
 *
 * @param engine        browser engine used to obtain a page
 * @param field         which field to write
 * @param value         the new text
 * @param logger        optional logger
 * @param beforeDispatch called immediately before the irreversible Save click
 */
export async function updateProfileField(
  engine: BrowserEngine,
  field: EditableProfileField,
  value: string,
  logger?: Logger,
  beforeDispatch?: () => void,
): Promise<ProfileEditOutcome> {
  const trimmed = (value ?? '').trim();
  const outcome: ProfileEditOutcome = {
    field,
    previous: '',
    next: clip(trimmed),
    saved: false,
    verified: false,
    httpStatus: 0,
  };
  if (!trimmed) {
    outcome.detail = 'Refusing to write an empty value.';
    return outcome;
  }

  const page = await engine.newPage();
  try {
    await installEvalHelpers(page);
    await page.goto(OWN_PROFILE, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await engine.assertPageSafe(page);
    await installEvalHelpers(page);
    await page.waitForTimeout(2500);

    const opened =
      field === 'headline' ? await openIntroEditor(page) : await openAboutEditor(page);
    if (!opened) {
      outcome.detail = `Could not open the ${field} editor on ${OWN_PROFILE}.`;
      return outcome;
    }

    const preferred = field === 'headline' ? HEADLINE_FIELD : ABOUT_FIELD;
    const probe = await writeField(page, [...preferred], trimmed);
    if (!probe.found) {
      outcome.detail = `Found the ${field} editor but no writable field inside it (${probe.reason ?? 'unknown'}).`;
      return outcome;
    }
    outcome.previous = clip(probe.before);
    await page.waitForTimeout(500);

    // The Save click is the irreversible point — signal the transaction guard
    // immediately before it, exactly like a dispatched HTTP write would.
    beforeDispatch?.();
    const saved = await clickSave(page);
    if (!saved) {
      outcome.detail = `No enabled Save button in the ${field} editor.`;
      return outcome;
    }
    // LinkedIn's own save request — capture its HTTP status so the caller can
    // report what the server actually said, not just what the DOM looked like.
    const saveResponse = await page
      .waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          /rsc-action\/actions\/server-request/.test(r.url()) &&
          /save/i.test(r.url()),
        { timeout: 15000 },
      )
      .catch(() => undefined);
    outcome.httpStatus = saveResponse?.status() ?? 0;
    await page.waitForTimeout(2500);

    const error = await hasSaveError(page);
    if (error) {
      outcome.detail = `LinkedIn reported "${error}" while saving the ${field}.`;
      return outcome;
    }

    const closed = await waitForEditorClosed(page);
    outcome.saved = closed;
    if (!closed) {
      outcome.detail = `The ${field} editor stayed open after Save.`;
      return outcome;
    }

    // Verify by re-opening the editor and reading the field back.
    const reopened =
      field === 'headline' ? await openIntroEditor(page) : await openAboutEditor(page);
    if (reopened) {
      const after = await readField(page, [...preferred]);
      // Compare with whitespace and smart typography normalized: a rich editor
      // renders paragraph breaks as separate blocks whose textContent
      // concatenates without a separator, and TipTap rewrites straight quotes
      // into typographic ones. A byte-exact compare would report false
      // mismatches for text that did land.
      const norm = (s: string): string =>
        s
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/\s+/g, ' ')
          .trim();
      outcome.verified = norm(after) === norm(trimmed);
      if (!outcome.verified) {
        outcome.detail = `Saved, but the field reads back as "${clip(after)}".`;
      }
      await closeModal(page);
    } else {
      outcome.detail = 'Saved, but the editor could not be re-opened for verification.';
    }
    logger?.info('profile field updated', {
      field,
      saved: outcome.saved,
      verified: outcome.verified,
      httpStatus: outcome.httpStatus,
    });
    return outcome;
  } catch (err) {
    outcome.detail = err instanceof Error ? err.message : String(err);
    return outcome;
  } finally {
    await page.close().catch(() => {});
  }
}
