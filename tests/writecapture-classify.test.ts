import { describe, expect, it } from 'vitest';
import { classifyWrite } from '../src/browser/writecapture.js';

/**
 * LinkedIn's server-driven UI (RSC/SDUI) expresses READS as POST. The profile
 * edit screen loads its form data through POSTs to
 * /flagship-web/rsc-action/actions/component and /navigation. Aborting those
 * renders "Something went wrong on our end" in the Edit-intro modal and the
 * save request is never sent — so the capture harness must tell reads from
 * genuine mutations.
 */
const ORIGIN = 'https://www.linkedin.com';

describe('classifyWrite — SDUI reads must pass through', () => {
  it('treats SDUI component loads as reads', () => {
    expect(
      classifyWrite(`${ORIGIN}/flagship-web/rsc-action/actions/component`, 'POST'),
    ).toBeUndefined();
  });

  it('treats SDUI navigation as a read', () => {
    expect(
      classifyWrite(`${ORIGIN}/flagship-web/rsc-action/actions/navigation`, 'POST'),
    ).toBeUndefined();
  });

  it('treats SDUI app-config as a read', () => {
    expect(
      classifyWrite(`${ORIGIN}/flagship-web/rsc-action/actions/app-config`, 'POST'),
    ).toBeUndefined();
  });

  it('treats SDUI server-request READ actions as reads', () => {
    expect(
      classifyWrite(
        `${ORIGIN}/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.profile.fetchProfileDiscoveryDrawer`,
        'POST',
      ),
    ).toBeUndefined();
    expect(
      classifyWrite(
        `${ORIGIN}/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.impl.homenav.requests.getThirdPartyTrackingPixels`,
        'POST',
      ),
    ).toBeUndefined();
    expect(
      classifyWrite(
        `${ORIGIN}/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.profile.profilePolicyNotice`,
        'POST',
      ),
    ).toBeUndefined();
  });

  it('treats the profile intro save as a mutation', () => {
    expect(
      classifyWrite(
        `${ORIGIN}/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.profile.saveProfileIntroForm&parentSpanId=abc`,
        'POST',
      ),
    ).toBe('sdui');
  });

  it('treats Voyager non-GETs as mutations', () => {
    expect(classifyWrite(`${ORIGIN}/voyager/api/graphql`, 'POST')).toBe('voyager');
    expect(classifyWrite(`${ORIGIN}/voyager/api/feed/update`, 'PUT')).toBe('voyager');
  });

  it('treats profile page-data POSTs and telemetry as reads', () => {
    expect(classifyWrite(`${ORIGIN}/flagship-web/in/nasr-rizkallah/`, 'POST')).toBeUndefined();
    expect(classifyWrite(`${ORIGIN}/to11yFVRvPfNBjxCN`, 'POST')).toBeUndefined();
    expect(classifyWrite(`${ORIGIN}/realtime/realtimeFrontendClientConnectivityTracking`, 'POST')).toBeUndefined();
  });
});
