/** Offline compiled-CLI protocol smoke. No browser or LinkedIn requests. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const bundle = process.argv[2] ?? resolve('dist/index.js');
const dir = mkdtempSync(join(tmpdir(), 'linkedin-built-smoke-'));
const profile = join(dir, 'profile');
mkdirSync(profile);
writeFileSync(
  `${profile}.circuit.json`,
  JSON.stringify({
    globalOpen: true,
    globalTrippedAt: Date.now(),
    globalReason: 'Synthetic test stop',
    actions: {},
    rate429Count: 0,
  }),
);
const payload = (result) => JSON.parse(result.content[0].text);
try {
  for (let i = 0; i < 2; i++) {
    const client = new Client({ name: 'offline-artifact-smoke', version: '1' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bundle],
      stderr: 'pipe',
      env: {
        ...process.env,
        LINKEDIN_PROFILE_DIR: profile,
        LINKEDIN_CHROME_PATH: join(dir, 'no-chrome'),
        LOG_LEVEL: 'error',
      },
    });
    try {
      await client.connect(transport);
      const tools = (await client.listTools()).tools;
      assert.equal(tools.length, 24);
      assert.equal(
        payload(await client.callTool({ name: 'whoami', arguments: {} })).data.sessionState,
        'not_checked',
      );
      assert.equal(tools.find((tool) => tool.name === 'get_inbox').inputSchema.properties.keywords.maxLength, 100);
      const invalidSearch = payload(await client.callTool({
        name: 'get_inbox', arguments: { count: 26, keywords: 'Synthetic summary query' },
      }));
      assert.equal(invalidSearch.code, 'INVALID_INBOX_SEARCH');
      assert.equal(invalidSearch.data, null);
      const materials = payload(
        await client.callTool({
          name: 'prepare_job_application',
          arguments: {
            job_id: '123',
            job_title: 'Synthetic engineer',
            evidence_library: [
              {
                id: 'selected',
                text: 'Maintained a TypeScript library',
                source_label: 'Synthetic notes',
              },
              { id: 'unused', text: 'UNUSED_PRIVATE_FACT_MUST_NOT_BE_RETURNED' },
            ],
            requirements: [
              { requirement: 'TypeScript', evidence_ids: ['selected'] },
              { requirement: 'Incident response' },
            ],
            include_drafts: true,
          },
        }),
      );
      assert.equal(materials.meta.source, 'engine');
      assert.equal(materials.data.missingEvidenceCount, 1);
      assert.equal(materials.data.requirements[0].evidenceStatus, 'user_supplied_unverified');
      assert.deepEqual(materials.data.drafts.resumeBullets, [
        JSON.stringify('Maintained a TypeScript library'),
      ]);
      assert.equal(materials.data.drafts.lineage[0].text, 'Maintained a TypeScript library');
      assert.equal(materials.data.stored, false);
      assert.equal(materials.data.submitted, false);
      assert.ok(!JSON.stringify(materials).includes('UNUSED_PRIVATE_FACT_MUST_NOT_BE_RETURNED'));
      const interview = payload(
        await client.callTool({
          name: 'prepare_job_application',
          arguments: {
            job_id: '123',
            job_title: 'Synthetic engineer',
            company: 'Synthetic company',
            evidence_library: [
              {
                id: 'selected',
                text: 'Maintained a TypeScript library',
                source_label: 'Synthetic notes',
              },
              {
                id: 'unused',
                text: 'UNUSED_INTERVIEW_FACT',
                source_label: 'UNUSED_INTERVIEW_LABEL',
              },
            ],
            requirements: [
              { requirement: 'TypeScript', evidence_ids: ['selected'] },
              { requirement: 'Incident response' },
              { requirement: 'Code review', evidence_ids: ['selected'] },
            ],
            include_interview_prep: true,
            include_drafts: false,
          },
        }),
      );
      assert.equal(interview.data.missingEvidenceCount, 1);
      assert.equal('drafts' in interview.data, false);
      const practice = interview.data.interviewPrep;
      assert.equal(practice.status, 'practice_only');
      assert.equal(practice.verification, 'user_supplied_unverified');
      assert.equal(practice.practiceQuestions.length, 3);
      for (const question of practice.practiceQuestions) {
        assert.deepEqual(question.starWorksheet, {
          situation: null,
          task: null,
          action: null,
          result: null,
        });
        const row = interview.data.requirements[question.requirementIndex];
        assert.equal(question.evidenceStatus, row.evidenceStatus);
        for (const index of question.evidenceItemIndices) {
          assert.equal(row.evidenceItems[index].text, 'Maintained a TypeScript library');
          assert.deepEqual(row.evidenceItems[index].sources, [
            { kind: 'library', evidenceId: 'selected', sourceLabel: 'Synthetic notes' },
          ]);
        }
      }
      assert.deepEqual(practice.practiceQuestions[0].evidenceItemIndices, [0]);
      assert.deepEqual(practice.practiceQuestions[1].evidenceItemIndices, []);
      assert.equal(practice.practiceQuestions[1].evidenceStatus, 'missing');
      assert.deepEqual(practice.practiceQuestions[2].evidenceItemIndices, [0]);
      assert.equal(practice.followUpTemplate.requiresVerifiedInterview, true);
      assert.ok(practice.followUpTemplate.body.includes('[INTERVIEW_DATE]'));
      assert.equal(interview.data.submitted, false);
      assert.equal(interview.data.stored, false);
      assert.equal(JSON.stringify(interview).includes('UNUSED_INTERVIEW'), false);
      const trackerInput = {
        records: [
          {
            job_id: '123',
            title: 'Synthetic',
            status: 'submitted_unverified',
            updated_at: '2026-10-28T00:00:00Z',
            follow_up_at: '2026-10-29T00:00:00Z',
          },
          {
            job_id: '456',
            title: 'Synthetic closed',
            status: 'withdrawn',
            updated_at: '2026-10-28T00:00:00Z',
            follow_up_at: '2026-10-27T00:00:00Z',
          },
        ],
      };
      const legacyTracker = payload(
        await client.callTool({
          name: 'export_application_tracker',
          arguments: trackerInput,
        }),
      ).data;
      assert.equal('followUpPlan' in legacyTracker, false);
      const plannedTracker = payload(
        await client.callTool({
          name: 'export_application_tracker',
          arguments: {
            ...trackerInput,
            include_follow_up_plan: true,
            as_of: '2026-10-30T00:00:00Z',
          },
        }),
      ).data;
      assert.deepEqual(plannedTracker.followUpPlan, {
        referenceTime: '2026-10-30T00:00:00Z',
        basis: 'user_supplied_dates',
        notificationsScheduled: false,
        overdueRecordIndices: [0],
        dueNowRecordIndices: [],
        upcomingRecordIndices: [],
        unscheduledRecordIndices: [],
        closedRecordIndices: [1],
      });
      const { followUpPlan: _plan, ...unchangedTracker } = plannedTracker;
      assert.deepEqual(unchangedTracker, legacyTracker);
      assert.equal(
        payload(await client.callTool({ name: 'whoami', arguments: {} })).data.sessionState,
        'not_checked',
      );
      assert.equal(
        payload(
          await client.callTool({
            name: 'prepare_job_application',
            arguments: {
              job_id: '123',
              job_title: 'Synthetic',
              requirements: [{ requirement: 'Example', evidence_ids: ['absent'] }],
              include_drafts: false,
            },
          }),
        ).code,
        'INVALID_APPLICATION_EVIDENCE',
      );
      const names = [
        'connect_with_person',
        'send_message',
        'create_post',
        'react_to_post',
        'comment_on_post',
      ];
      for (const name of names)
        assert.ok(tools.find((tool) => tool.name === name).inputSchema.properties.operation_id);
      assert.equal(
        payload(
          await client.callTool({
            name: 'create_post',
            arguments: { text: 'synthetic', confirm: false },
          }),
        ).data.refused,
        true,
      );
      assert.equal(
        payload(await client.callTool({ name: 'get_my_profile', arguments: {} })).code,
        'CIRCUIT_OPEN',
      );
      assert.equal(
        payload(await client.callTool({ name: 'health_check', arguments: {} })).data.status,
        'blocked',
      );
      assert.equal(
        payload(await client.callTool({ name: 'close_session', arguments: {} })).data.closed,
        true,
      );
    } finally {
      await client.close();
    }
  }
  console.log(
    'PASS: two fresh built stdio processes, 24 tools, offline material/interview practice, explicit follow-up timing and unused-fact privacy, write IDs, confirmation refusal, persisted stop, blocked health, clean close.',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
