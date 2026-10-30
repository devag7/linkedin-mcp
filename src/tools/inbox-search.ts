/** Local matching over a bounded portion of an already returned inbox page. */
import { z } from 'zod';
import type { InboxSummarySearchView } from '../browser/normalize.js';
import { ToolError } from './result.js';

export const MAX_INBOX_SEARCH_ROWS = 25;
const MAX_PARTICIPANTS = 50;
const MAX_FIELD_CHARACTERS = 10_000;
export const inboxSearchMetaSchema = z.object({
  query: z.string().min(1).max(100),
  matching: z.literal('nfc_lowercase_literal_substring'),
  fields: z.tuple([
    z.literal('provider_title'),
    z.literal('participant_name'),
    z.literal('participant_headline'),
  ]),
  coverage: z.literal('bounded_first_page'),
  complete: z.literal(false),
  messageBodiesSearched: z.literal(false),
  scannedConversations: z.number().int().min(0).max(MAX_INBOX_SEARCH_ROWS),
  matchedConversations: z.number().int().min(0).max(MAX_INBOX_SEARCH_ROWS),
  summariesWithoutText: z.number().int().min(0).max(MAX_INBOX_SEARCH_ROWS),
  truncatedSummaries: z.number().int().min(0).max(MAX_INBOX_SEARCH_ROWS),
  stored: z.literal(false),
});

export function searchInboxSummaries(
  rows: readonly InboxSummarySearchView[],
  keywords: string,
  count: number,
) {
  const query = keywords.trim();
  if (
    !query ||
    query.length > 100 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_INBOX_SEARCH_ROWS
  )
    throw new ToolError('INVALID_INBOX_SEARCH');
  const needle = query.normalize('NFC').toLowerCase();
  const window = rows.slice(0, count);
  let summariesWithoutText = 0;
  let truncatedSummaries = 0;
  const conversations = window
    .filter((view) => {
      const row = view.conversation;
      let truncated = (row.participants?.length ?? 0) > MAX_PARTICIPANTS;
      let searchable = false;
      let matched = false;
      const inspect = (text: string | undefined) => {
        if (text === undefined) return;
        if (text.length > MAX_FIELD_CHARACTERS) truncated = true;
        const sample = text.slice(0, MAX_FIELD_CHARACTERS);
        if (!sample.trim()) return;
        searchable = true;
        if (sample.normalize('NFC').toLowerCase().includes(needle)) matched = true;
      };
      inspect(view.titleForSearch);
      for (const participant of (row.participants ?? []).slice(0, MAX_PARTICIPANTS)) {
        inspect(participant.name);
        inspect(participant.headline);
      }
      if (!searchable) summariesWithoutText++;
      if (truncated) truncatedSummaries++;
      return matched;
    })
    .map((view) => view.conversation);
  return {
    status: 'partial' as const,
    conversations,
    search: {
      query,
      matching: 'nfc_lowercase_literal_substring' as const,
      fields: ['provider_title', 'participant_name', 'participant_headline'] as const,
      coverage: 'bounded_first_page' as const,
      complete: false as const,
      messageBodiesSearched: false as const,
      scannedConversations: window.length,
      matchedConversations: conversations.length,
      summariesWithoutText,
      truncatedSummaries,
      stored: false as const,
    },
  };
}
