# Bounded package-metadata propagation tolerance

October 27 source follow-up, separate from immutable core 4.2.0.

The 4.1.2 and 4.2.0 production histories both contain a successful upload followed
by `PACKAGE_NOT_VISIBLE`, and later independent public visibility. Their causes
remain unproven. This follow-up gives missing npm/GitHub Packages metadata more
bounded time to become observable; it does not retry uploading a package.

`verifyPackage` performs one initial metadata GET plus at most six additional
GETs after waits of 2, 5, 10, 20, 30 and 30 seconds. Scheduled waits total 97 seconds;
that is not a hard elapsed deadline. The existing 15-second timeout per metadata
request remains unchanged. There is no wait after the last read, and a verified
result returns immediately.

Only missing metadata is retried. Wrong package/version/integrity, authentication,
rate-limit/network/redirect/JSON/size errors and a failed injected wait still stop
immediately. No publish, authentication mode, source/tag mutation, Registry wait,
workflow permission or browser/provider request limit is changed. Token fallback
and blind second uploads remain prohibited by the coordinator's release procedure.

Synthetic regressions cover immediate visibility in both registries, late seventh
visibility, all-missing exhaustion, fixed read-only methods, exact wait bounds,
fail-fast invalid/error responses including mismatch after a missing result, and
failed waits. No real endpoint is contacted in those fixtures. The current 4.2.0
production run used the earlier helper; its first failure stays failed and its
same-source successful resume remains separately recorded.
