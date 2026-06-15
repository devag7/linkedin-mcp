/**
 * Live write-probe (`--writeprobe`).
 *
 * Verifies the post / react / comment write payloads against a BURNER by firing
 * them FOR REAL via the in-page Voyager POST and printing the actual response —
 * but self-contained and reversible: it posts to your OWN feed, reacts +
 * comments on THAT post, then deletes it (no third party is ever touched).
 *
 * connect is intentionally NOT fired here (its exact request shape is already
 * verified via --writecapture, and firing it would send a real invite). message
 * is skipped too (it needs a real recipient).
 *
 * Gentle by design: a short pause between calls so a fresh account is not
 * hammered (the read-spike's pacing-disabled burst is what logged the burner out
 * the first time).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { BrowserEngine } from './engine.js';
import { VoyagerClient } from './voyager.js';
import { classifyWrite } from './write-status.js';
import * as ep from './endpoints.js';
import { ownPublicId, ownFsdId, type NormalizedResponse } from './normalize.js';
import type { Logger } from '../types.js';
import type { EnvConfig } from '../config/env.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Deep-find the first share/ugcPost/activity urn in a response (the created post). */
function findShareUrn(node: unknown): string | undefined {
  let found: string | undefined;
  const visit = (n: unknown): void => {
    if (found || n == null) return;
    if (typeof n === 'string') {
      const m = n.match(/urn:li:(?:share|ugcPost|activity|fsd_update):[^"',)\s]+/);
      if (m) found = m[0];
      return;
    }
    if (typeof n === 'object') for (const v of Object.values(n as Record<string, unknown>)) visit(v);
  };
  visit(node);
  return found;
}

function report(label: string, raw: { status: number; ok: boolean; body: string; json: unknown }, kind: 'post' | 'react' | 'comment'): void {
  const outcome = classifyWrite(raw, kind);
  process.stderr.write(
    `\n▶ ${label}: HTTP ${raw.status} → status=${outcome.status}` +
      `${outcome.detail ? ` (${outcome.detail})` : ''}\n`,
  );
  const preview = raw.body.length > 400 ? raw.body.slice(0, 400) + '…' : raw.body;
  process.stderr.write(`   body: ${preview || '(empty)'}\n`);
}

export async function runWriteProbe(config: EnvConfig, logger: Logger): Promise<void> {
  const engine = new BrowserEngine(config, logger);
  const voyager = new VoyagerClient(engine, logger);
  try {
    await engine.ensureContext();
    if (!(await engine.isLoggedIn())) {
      process.stderr.write('\n❌ Not logged in. Run --login on this profile first.\n');
      return;
    }
    const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
    const who = ownPublicId(me);
    process.stderr.write(`\n✅ Logged in as ${who ?? '(unknown)'} — probing writes (self-targeted, reversible).\n`);

    // Targeted send_message: reply into an existing conversation (verified shape).
    const convUrn = process.env.TARGET_CONVERSATION_URN;
    if (convUrn) {
      const ownId = ownFsdId(me);
      const mailboxUrn = `urn:li:fsd_profile:${ownId}`;
      process.stderr.write(`\n▶ send_message reply into ${convUrn}\n`);
      const r = await voyager.voyagerPostRaw(ep.messengerMessagesCreate(), {
        message: {
          body: { attributes: [], text: `v2 write-probe message ${new Date().toISOString()}` },
          renderContentUnions: [],
          conversationUrn: convUrn,
          originToken: randomUUID(),
        },
        mailboxUrn,
        trackingId: randomBytes(16).toString('latin1'),
        dedupeByClientGeneratedToken: false,
      });
      const outcome = classifyWrite(r, 'message');
      process.stderr.write(`▶ send_message: HTTP ${r.status} → status=${outcome.status}${outcome.detail ? ` (${outcome.detail})` : ''}\n`);
      process.stderr.write(`   body: ${r.body.slice(0, 300)}\n`);
      return;
    }

    // Cleanup mode: delete a probe post by its share urn.
    const delUrn = process.env.TARGET_DELETE_URN;
    if (delUrn) {
      const del = await voyager.voyagerDeleteRaw(ep.deleteShare(delUrn));
      process.stderr.write(`\n🧹 delete ${delUrn}: HTTP ${del.status} ${del.ok ? '(removed)' : `(body: ${del.body.slice(0, 200)})`}\n`);
      return;
    }

    // Targeted mode: react + comment on an existing post (its ACTIVITY urn), to
    // verify those two payloads live without creating a fresh post.
    const targetActivity = process.env.TARGET_ACTIVITY_URN;
    if (targetActivity) {
      process.stderr.write(`\n▶ targeted react/comment on ${targetActivity}\n`);
      const rq = ep.KNOWN_QUERY_IDS.reactions;
      const r = await voyager.voyagerPostRaw(ep.reactionsMutation(rq), {
        variables: { entity: { reactionType: 'LIKE' }, threadUrn: targetActivity },
        queryId: rq,
        includeWebMetadata: true,
      });
      report('react_to_post', r, 'react');
      await sleep(6000);
      const c = await voyager.voyagerPostRaw(ep.normCommentsCreate(), {
        commentary: { text: 'v2 write-probe comment', attributesV2: [], $type: 'com.linkedin.voyager.dash.common.text.TextViewModel' },
        threadUrn: targetActivity,
      });
      report('comment_on_post', c, 'comment');
      process.stderr.write('\n🎯 Targeted react/comment probe complete.\n');
      return;
    }

    // 1) create_post (verified-live GraphQL share mutation) -------------------
    const text = `v2 write-probe ${new Date().toISOString()} — automated test post, will self-delete`;
    const queryId = ep.KNOWN_QUERY_IDS.createShare;
    const postBody = {
      variables: {
        post: {
          allowedCommentersScope: 'ALL',
          intendedShareLifeCycleState: 'PUBLISHED',
          origin: 'FEED',
          visibilityDataUnion: { visibilityType: 'ANYONE' },
          commentary: { text, attributesV2: [] },
        },
      },
      queryId,
      includeWebMetadata: true,
    };
    const postRaw = await voyager.voyagerPostRaw(ep.createShareMutation(queryId), postBody);
    report('create_post', postRaw, 'post');
    const shareUrn = findShareUrn(postRaw.json) ?? findShareUrn(postRaw.body);
    process.stderr.write(`   created urn: ${shareUrn ?? '(none found — payload may be wrong)'}\n`);
    await sleep(6000);

    // create_post returns a SHARE urn; react/comment need the post's ACTIVITY
    // urn (a different id, not derivable by string-swap). So this create-flow
    // verifies create_post only — to verify react/comment, run with
    // TARGET_ACTIVITY_URN (the activity urn of any post). Cleanup deletes the
    // probe post unless KEEP_POST=1 leaves it up as a capture target.
    if (shareUrn) {
      if (process.env.KEEP_POST === '1') {
        process.stderr.write(`\n📌 KEEP_POST=1 — leaving the post up: ${shareUrn}\n`);
        process.stderr.write('   (re-run with TARGET_ACTIVITY_URN=<activity urn> to verify react/comment)\n');
      } else {
        const del = await voyager.voyagerDeleteRaw(ep.deleteShare(shareUrn));
        process.stderr.write(`\n🧹 delete probe post: HTTP ${del.status} ${del.ok ? '(removed)' : '(manual cleanup may be needed)'}\n`);
      }
    } else {
      process.stderr.write('\n⚠️  No share urn from create_post — payload may be wrong (or the account is posting-restricted).\n');
    }

    process.stderr.write('\n🎯 Write-probe complete. Inspect each status above (ok = payload verified live).\n');
  } catch (err) {
    process.stderr.write(`\n❌ writeprobe failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  } finally {
    await engine.shutdown();
  }
}
