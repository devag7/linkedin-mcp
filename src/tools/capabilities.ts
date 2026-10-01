/** Local route inventory. Historical source comments are not current live evidence. */
const local = (route: string) => ({
  route,
  source: 'engine' as const,
  permission: 'local',
  write: false,
});
const read = (route: string, source: 'voyager' | 'dom' = 'voyager', maxResults?: number) => ({
  route,
  source,
  permission: 'authenticated_browser',
  write: false,
  maxResults,
});
const write = (route: string) => ({
  route,
  source: 'voyager' as const,
  permission: 'alpha_write_opt_in_and_user_confirmation',
  write: true,
});
export const CAPABILITIES = {
  whoami: local('local session inspection'),
  health_check: read('/me'),
  close_session: local('local browser shutdown'),
  get_my_profile: read('/me + DASH profile + five component sections'),
  get_profile: read('DASH profile + five component sections'),
  get_feed: read('voyagerFeedDashMainFeed', 'voyager', 25),
  get_notifications: read('voyagerIdentityDashNotificationCards', 'voyager', 50),
  search_people: read('/search/results/people/', 'dom', 25),
  research_jobs: read('bounded composition of search_jobs + one get_job_details', 'voyager', 10),
  search_jobs: read('voyagerJobsDashJobCards', 'voyager', 25),
  get_inbox: read('/me + messengerConversations', 'voyager', 50),
  get_job_details: read('voyagerJobsDashJobPosting'),
  search_companies: read('/search/results/companies/', 'dom', 25),
  get_company: read('/company/:slug/about/', 'dom'),
  get_company_posts: read('/company/:slug/posts/', 'dom', 25),
  get_company_employees: read('/company/:slug/people/', 'dom', 25),
  get_pending_invitations: read('invitationViews + sentInvitationViewsV2', 'voyager', 200),
  get_conversation: read('messengerMessages', 'voyager', 100),
  connect_with_person: write('voyagerRelationshipsDashMemberRelationships:verifyQuotaAndCreateV2'),
  send_message: write(
    'voyagerMessagingDashMessengerMessages:createMessage; new thread experimental',
  ),
  create_post: write('voyagerFeedDashCreateShare'),
  react_to_post: write('voyagerSocialDashReactions'),
  comment_on_post: write('voyagerSocialDashNormComments'),
} as const;
export type ToolName = keyof typeof CAPABILITIES;
export interface CapabilityPolicy {
  writesEnabled: boolean;
  experimentalMessagesEnabled: boolean;
}
export function capabilityManifest(
  policy: CapabilityPolicy,
  names: readonly ToolName[] = Object.keys(CAPABILITIES) as ToolName[],
) {
  return names.map((name) => ({
    name,
    ...CAPABILITIES[name],
    provider: 'local_browser_unofficial',
    verification: 'offline_contract_tested',
    offlineCheckedAt: '2026-10-01',
    liveCheckedAt: null,
    availability:
      CAPABILITIES[name].write && !policy.writesEnabled
        ? 'disabled'
        : CAPABILITIES[name].source === 'engine'
          ? 'available'
          : 'unknown_until_checked',
    ...(name === 'send_message'
      ? { newThreadEnabled: policy.writesEnabled && policy.experimentalMessagesEnabled }
      : {}),
  }));
}
