import { expect, it } from 'vitest';
import { jobResponseShape } from '../scripts/job-response-shape.js';

it('retains field presence and known machine error classes without private values or keys', () => {
  const secret = 'private-person-cookie-url-and-description';
  const report = jobResponseShape({
    included: [
      {
        $type: 'private.namespace.JobPosting',
        entityUrn: secret,
        title: secret,
        formattedLocation: { text: secret },
        listedAt: 1723456789,
        [secret]: secret,
      },
    ],
    data: {
      data: { errors: [{ message: secret, extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' } }] },
    },
  });
  const json = JSON.stringify(report);
  expect(json).not.toContain(secret);
  expect(json).not.toContain('private.namespace');
  expect(json).not.toContain('1723456789');
  expect(report.entities.jobPosting).toBe(1);
  expect(report.providerCodeClasses).toEqual(['PERSISTED_QUERY_NOT_FOUND']);
  expect(report.paths).toContainEqual({
    path: '$.included[].formattedLocation.text',
    types: ['string'],
    observations: 1,
    nonemptyStrings: 1,
  });
  expect(report.truncated).toBe(false);
});

it('redacts arbitrary provider error codes and distinguishes absent and empty fields', () => {
  const report = jobResponseShape({
    included: [{ title: '', location: null }],
    errors: [{ code: 'private-error-message', message: 'private' }],
  });
  expect(report.providerCodeClasses).toEqual(['unrecognized']);
  expect(JSON.stringify(report)).not.toContain('private');
  expect(report.paths.find((p) => p.path === '$.included[].title')?.nonemptyStrings).toBe(0);
  expect(report.paths.some((p) => p.path.endsWith('.formattedLocation'))).toBe(false);
});

it('bounds hostile arrays, deep nesting and cycles without treating truncation as absence', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.data = cyclic;
  expect(jobResponseShape(cyclic).truncated).toBe(true);
  expect(
    jobResponseShape({ included: Array.from({ length: 101 }, () => ({ title: 'x' })) }).truncated,
  ).toBe(true);
  let deep: unknown = { title: 'private' };
  for (let i = 0; i < 20; i++) deep = { data: deep };
  const report = jobResponseShape(deep);
  expect(report.truncated).toBe(true);
  expect(report.nodes).toBeLessThanOrEqual(10000);
});
