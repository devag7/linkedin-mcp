# 3.1.0 search-only candidate — not released

Adds research_jobs as tool23: one first-page job search, up to ten source-linked
jobs, exact per-fact source/fetch time, partial/empty/error states, unknown fields,
comparison-evidence counts and Markdown. A useful job requires an observed title
plus location or listing date. The enforced ceiling is two explicit Voyager GET
attempts including identity and one underlying tool; browser traffic is excluded.
No detail enrichment, fallback, paging, retries, persistence or inferred fit.

Migration from published3.0.0 is additive; its22 tools and safety gates remain.
Earlier unpublished draft users must refresh tool schemas: enrich_first now
defaults false and true is rejected before provider work. get_job_details remains
separate with strict supported numeric identity checks; normalized identities are
not accepted. No optional enrichment compatibility claim is included.

Useful live output is untested; the fresh offline held-session strict cleanup
gate failed with2 tracked processes at both checks. This candidate remains
blocked and unreleased. Final exact-head release gates do not replace cleanup. Historical failures remain failed. No broad
platform/client/provider compatibility claim follows from offline fixtures.
Mandatory maintainer cash:$0. Published3.0.0 pilot, native client first use,
coordinated erasure and native Windows ACL proof remain separate limitations.
