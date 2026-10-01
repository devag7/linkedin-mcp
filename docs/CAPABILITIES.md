# Capabilities and compatibility

Generated from src/tools/capabilities.ts for linkedin-mcp-tools v3.0.0.

| Tool | Route | Source | Permission | Max rows | Evidence | Current live check |
| --- | --- | --- | --- | --- | --- | --- |
| whoami | local session inspection | engine | local | — | offline_contract_tested (2026-10-01) | Unchecked |
| health_check | /me | voyager | authenticated_browser | — | offline_contract_tested (2026-10-01) | Unchecked |
| close_session | local browser shutdown | engine | local | — | offline_contract_tested (2026-10-01) | Unchecked |
| get_my_profile | /me + DASH profile + five component sections | voyager | authenticated_browser | — | offline_contract_tested (2026-10-01) | Unchecked |
| get_profile | DASH profile + five component sections | voyager | authenticated_browser | — | offline_contract_tested (2026-10-01) | Unchecked |
| get_feed | voyagerFeedDashMainFeed | voyager | authenticated_browser | 25 | offline_contract_tested (2026-10-01) | Unchecked |
| get_notifications | voyagerIdentityDashNotificationCards | voyager | authenticated_browser | 50 | offline_contract_tested (2026-10-01) | Unchecked |
| search_people | /search/results/people/ | dom | authenticated_browser | 25 | offline_contract_tested (2026-10-01) | Unchecked |
| search_jobs | voyagerJobsDashJobCards | voyager | authenticated_browser | 25 | offline_contract_tested (2026-10-01) | Unchecked |
| get_inbox | /me + messengerConversations | voyager | authenticated_browser | 50 | offline_contract_tested (2026-10-01) | Unchecked |
| get_job_details | voyagerJobsDashJobPosting | voyager | authenticated_browser | — | offline_contract_tested (2026-10-01) | Unchecked |
| search_companies | /search/results/companies/ | dom | authenticated_browser | 25 | offline_contract_tested (2026-10-01) | Unchecked |
| get_company | /company/:slug/about/ | dom | authenticated_browser | — | offline_contract_tested (2026-10-01) | Unchecked |
| get_company_posts | /company/:slug/posts/ | dom | authenticated_browser | 25 | offline_contract_tested (2026-10-01) | Unchecked |
| get_company_employees | /company/:slug/people/ | dom | authenticated_browser | 25 | offline_contract_tested (2026-10-01) | Unchecked |
| get_pending_invitations | invitationViews + sentInvitationViewsV2 | voyager | authenticated_browser | 200 | offline_contract_tested (2026-10-01) | Unchecked |
| get_conversation | messengerMessages | voyager | authenticated_browser | 100 | offline_contract_tested (2026-10-01) | Unchecked |
| connect_with_person | voyagerRelationshipsDashMemberRelationships:verifyQuotaAndCreateV2 | voyager | alpha_write_opt_in_and_user_confirmation | — | offline_contract_tested (2026-10-01) | Unchecked |
| send_message | voyagerMessagingDashMessengerMessages:createMessage; new thread experimental | voyager | alpha_write_opt_in_and_user_confirmation | — | offline_contract_tested (2026-10-01) | Unchecked |
| create_post | voyagerFeedDashCreateShare | voyager | alpha_write_opt_in_and_user_confirmation | — | offline_contract_tested (2026-10-01) | Unchecked |
| react_to_post | voyagerSocialDashReactions | voyager | alpha_write_opt_in_and_user_confirmation | — | offline_contract_tested (2026-10-01) | Unchecked |
| comment_on_post | voyagerSocialDashNormComments | voyager | alpha_write_opt_in_and_user_confirmation | — | offline_contract_tested (2026-10-01) | Unchecked |

These are synthetic contract and registration checks, not current LinkedIn observations. Historical capture comments are retained in endpoints.ts and are not promoted to current live checks. No endpoint has a new live capture here. DOM selectors have no multi-locale browser integration evidence. whoami supplies this inventory and the actual runtime write policy; it never guesses provider availability.

Search/feed/notification offsets use existing endpoint builders, one page per call. nextCursor appears only for matching provider start/count/total metadata. DOM discovery, inbox, conversation and invitation reads expose bounded first pages and mark completeness partial. Profiles make at most six requests (seven for own profile), plus bounded identity verification; optional hidden sections may be unavailable.

For the 3.0.0 safety/client changes, read [migration](../SETUP_GUIDE.md#migrating-from-203-to-300). Preview tokens are mandatory for new writes; human approval remains a client workflow requirement. Offline platform/config checks do not certify current provider behavior, native chat or Windows NTFS privacy.

The official provider is unavailable in the active runtime. Token/cookie settings from v1 do not activate it. All alpha writes are disabled by default; new-thread messaging has a second experimental opt-in.
