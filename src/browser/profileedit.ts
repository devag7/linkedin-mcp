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
 *   - the headline field is a textarea whose id contains "headline";
 *   - the About editor is reached from the About section's own pencil.
 */

import type { BrowserEngine } from './engine.js';
import type { Logger } from '../types.js';
import type { Page } from 'patchright';

const ORIGIN = 'https://www.linkedin.com';
const OWN_PROFILE = `${ORIGIN}/in/me/`;

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

/** Set a textarea/input value in a way React's synthetic onChange observes. */
async function setNativeValue(page: Page, selector: string, value: string): Promise<boolean> {
  return page.evaluate(
    ({ selector: sel, value: val }) => {
      const el = document.querySelector(sel) as (HTMLTextAreaElement & HTMLInputElement) | null;
      if (!el) return false;
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc?.set) desc.set.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    { selector, value },
  );
}

/** Set a contenteditable surface (LinkedIn sometimes uses one instead of a textarea). */
async function setContentEditableValue(page: Page, selector: string, value: string): Promise<boolean> {
  return page.evaluate(
    ({ selector: sel, value: val }) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return false;
      el.focus();
      el.innerHTML = val
        .split('\n')
        .map((line) => `<div>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`)
        .join('');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    { selector, value },
  );
}

/** Read the current text of the first matching field. */
async function readField(page: Page, selectors: readonly string[]): Promise<string | undefined> {
  for (const sel of selectors) {
    const v = await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement | null;
      if (!el) return undefined;
      const asInput = el as HTMLTextAreaElement;
      const raw = typeof asInput.value === 'string' ? asInput.value : el.innerText;
      return typeof raw === 'string' ? raw : undefined;
    }, sel);
    if (v !== undefined) return v;
  }
  return undefined;
}

/** Click the first visible element matching any of the selectors. */
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

/** Wait until the editor modal goes away (or time out). */
async function waitForModalClosed(page: Page, selector: string, timeoutMs = 20000): Promise<boolean> {
  try {
    await page.waitForFunction(
      (s) => !document.querySelector(s),
      selector,
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
    await page.waitForSelector('[id*="headline" i], textarea', { timeout: 20000 });
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
          'button[aria-label*="Edit" i], a[aria-label*="Edit" i], button[aria-label*="edit" i]',
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
  await page.waitForTimeout(600);
}

const HEADLINE_FIELD: readonly [string, ...string[]] = [
  '[id*="headline" i]',
  'textarea[data-id*="headline" i]',
];
const ABOUT_FIELD: readonly [string, ...string[]] = [
  'textarea[id*="about" i]',
  'textarea[data-id*="about" i]',
  '[contenteditable="true"][aria-label*="about" i]',
  '[contenteditable="true"][data-id*="about" i]',
];

/**
 * Write one profile field through the live editor and verify the result.
 *
 * @param engine browser engine used to obtain a page
 * @param field   which field to write
 * @param value   the new text
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
    await page.goto(OWN_PROFILE, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await engine.assertPageSafe(page);
    await page.waitForTimeout(2500);

    const opened =
      field === 'headline' ? await openIntroEditor(page) : await openAboutEditor(page);
    if (!opened) {
      outcome.detail = `Could not open the ${field} editor on ${OWN_PROFILE}.`;
      return outcome;
    }

    const selectors = field === 'headline' ? HEADLINE_FIELD : ABOUT_FIELD;
    const previous = await readField(page, selectors);
    outcome.previous = clip(previous ?? '');

    const wrote =
      (await setNativeValue(page, selectors[0], trimmed)) ||
      (await setContentEditableValue(page, selectors[0], trimmed));
    if (!wrote) {
      outcome.detail = `Found the ${field} editor but could not locate a writable field.`;
      return outcome;
    }
    await page.waitForTimeout(400);

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

    const closed = await waitForModalClosed(page, selectors[0]);
    outcome.saved = closed;
    if (!closed) {
      outcome.detail = `The ${field} editor stayed open after Save.`;
      return outcome;
    }

    // Verify by re-opening the editor and reading the field back.
    const reopened =
      field === 'headline' ? await openIntroEditor(page) : await openAboutEditor(page);
    if (reopened) {
      const after = await readField(page, selectors);
      outcome.verified = (after ?? '').trim() === trimmed;
      if (!outcome.verified) {
        outcome.detail = `Saved, but the field reads back as "${clip(after ?? '')}".`;
      }
      await closeModal(page);
    } else {
      outcome.detail = 'Saved, but the editor could not be re-opened for verification.';
    }
    logger?.info('profile field updated', { field, saved: outcome.saved, verified: outcome.verified });
    return outcome;
  } catch (err) {
    outcome.detail = err instanceof Error ? err.message : String(err);
    return outcome;
  } finally {
    await page.close().catch(() => {});
  }
}
