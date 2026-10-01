# Official-provider pilot: design and outstanding evidence

The active runtime has no official OAuth adapter. Explicit
LINKEDIN_PROVIDER=official fails before browser creation; there is no automatic
fallback. whoami and generated metadata identify the browser route as unofficial
and official mode as unavailable. Legacy token/cookie configuration is isolated
from the shipped runtime; it is not an implementation of this pilot.

Documentation reviewed 2026-10-01: LinkedIn requires authorized apps and grants
many permissions through product/partner approval. OIDC provides limited own-member
identity with openid/profile (email only when needed); it does not grant arbitrary
people search or inbox access. Share on LinkedIn lists w_member_social for member
actions. Product provisioning and actual token grants must both be confirmed.
Sources: [API access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access),
[OIDC integration](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).

## Provider contract to implement with a real test app

Use a provider abstraction with: ID (browser/official), capabilities(), ownIdentity(),
previewWrite(), executeApprovedWrite() and close(). Every capability carries route,
required/granted scopes, verification scope/date and availability. Check capability
and granted scope before any request. Unsupported operations fail with a fixed
UNSUPPORTED_CAPABILITY error. Never turn an official denial into a browser action.
Shared public contracts preserve provider-specific optional fields and provenance.

Official configuration must be explicitly selected. Maintain a separate credential
store, account namespace and authorization flow; never pass a local MCP bearer
secret or browser cookie to api.linkedin.com. Use the app's registered redirect,
short-lived state/nonce and expiry checks. Verify ID token issuer/audience/signature
against official discovery/JWKS rather than decoding and trusting an unverified
JWT. Pairwise OIDC subject is not assumed equivalent to a Voyager ID. Request only
scopes required for the chosen capability and keep refresh/token handling local.

## Ordered implementation gates

1. Maintainer supplies a real developer app with provisioned OIDC and, separately,
   permitted publishing. Record redacted app/product/grant evidence, supported API
   version and permitted redirect. Do not request or put credentials in chat/docs.
2. Implement/test local auth initiation, callback state validation, token exchange,
   signature/expiry verification, private storage, logout/revocation and scope denial.
   Review local redirect/network boundaries and secret redaction independently.
3. Implement own-member OIDC identity only. The documented userinfo endpoint is
   https://api.linkedin.com/v2/userinfo; validate a real response on an authorized
   test app. No arbitrary profile export, search, connection or inbox capability
   follows from identity access.
4. With w_member_social actually granted, implement a text-publishing route against
   the then-current [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api).
   Preserve preview/account binding/journal/unknown rules, versioned headers and
   request deadlines. Capture the exact approved request/result before exposing it.
5. Publish a capability only after approved integration evidence: scope denial
   sends zero requests, identity is app-bound, publishing sends once, returned
   resource/URL is validated, timeout remains unknown, and no browser fallback.

No developer app, token grant, official network request or approved publication
was available/exercised in this task. This document is an execution design, not
an achieved Phase 4 exit gate. Email/media/company publishing remain outside pilot
scope. Recheck official documentation and app grants at implementation time.
