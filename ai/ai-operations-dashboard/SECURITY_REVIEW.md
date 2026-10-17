# Security and integration review — v1.2.1-demo

Review date: October 8, 2026. Scope: AI OS source in `ai/ai-operations-dashboard/`, its locally built artifacts, registry dependency advisory checks and synthetic local tests. No real accounts/data, publication, hosting changes, or third-party infrastructure testing.

## Findings and implemented changes

1. **Unknown saved metadata propagated into the application model.** Restored workflows, tasks, timeline, draft versions, activity and view fields now use explicit allowlists. Unknown fields such as provider tokens, connection secrets or policy claims are not adopted or re-saved by the app. This does not prevent an attacker who controls the browser from reading its original storage, and does not detect sensitive text deliberately entered into a draft.
2. **Unbounded result input and restored payloads.** The editor/domain enforce a 100,000-character result limit. Restored requests, IDs, timeline text, collections and raw snapshots are bounded; activity workflow references are validated. Invalid snapshots use the existing warning and empty workspace, preserving the original until a domain change/reset. The adapter retains version-1/2 compatibility and current edits. Browser histories can still grow during use and hit quota limits; visible session-only fallback remains.
3. **Approval needed an exact-preview invariant.** Confirmation captures the result it displayed. If result content changes before confirmation, local completion is rejected and Dave must review again. Existing terminal-state validation prevents duplicate complete/cancel events. Neither browser safeguard substitutes for server authorization, immutable result versions, transactional action claiming or provider idempotency.
4. **Development-tool advisories.** Initial npm audit reported one high-severity Vite package finding (multiple advisories) and one low-severity esbuild finding. Updated Vite from 7.3.1 to 7.3.7 and esbuild in the lockfile from 0.27.7 to 0.28.2, within Vite's supported dependency range. No force upgrades, disabled TLS or integrity bypasses. These are development/build dependencies; never expose the dev server as production hosting.
5. **Integration uncertainty.** Added INTEGRATION_PLAN.md and THREAT_MODEL.md, using adapters to preserve the existing workflow states and single review surface. No second authentication system, fake identity enforcement or security-control UI was added. Other app sources/shared contracts are absent from this checkout and need reconciliation before implementation.

## Checks actually executed

- Node engine/storage suite: **19 passed**, zero failed/skipped. Includes schema recovery, strict restoration, metadata stripping, size boundaries, exact retained drafts and duplicate terminal decisions.
- Chromium desktop/mobile suite: **48 passed**, zero failed/skipped. Includes malicious command/restored text, safe identifiers, invalid storage recovery, preview-change rejection, approval/cancellation/reset boundaries, stale-tab handling, persistence, literal draft downloads, clipboard failure and accessible/responsive review/history flows.
- Production build and single-file smoke test: **passed**. Exact edited draft approval survives reload; no asset/API requests. Tested over loopback HTTP because the managed browser blocks file navigation.
- Registry advisory check: `npm audit --json --cache /tmp/ai-os-npm-cache` reports **zero known advisories** after remediation. Time-dependent advisory coverage is not proof of no vulnerabilities.
- Pattern-based secret check of project source/docs/lockfile and generated JS/HTML/CSS: **no matching credentials found**. Rules cover private-key markers, common GitHub/AWS formats and long credential assignments; output contains file/rule metadata only. This is not a complete entropy/history/secret-detection assessment. The scanner excludes dependencies, .git and test reports and does not inspect environment secret values.
- Synthetic browser export/log test: export contains exactly the selected draft text, not unknown credential metadata; console output does not contain synthetic credential markers or draft text in the exercised flow. User-authored draft text is intentionally exported verbatim, not automatically redacted.
- Read-only Git inspection: remote gh-pages branch and preserved v1.5.0-demo tag exist. No remote writes or hosting changes.

An existing malicious-ID fixture initially failed because changing only a workflow ID now leaves invalid activity references. The fixture was made internally consistent, preserving its hostile identifier payload; the revised check still verifies literal rendering. No assertion was disabled.

## Explicitly unimplemented / untested

There is no authentication/session service, backend API, multi-user/workspace authorization, OAuth redirect/state handling, token store/refresh/revocation, trusted audit database, server rate limiting, encryption-at-rest configuration, or production security header policy. These areas cannot be validated by the demo tests. LocalStorage is mutable, shared by a browser origin, and unsuitable for provider credentials, sensitive profiles or authoritative audit. Displayed Dave identity is fictional. Local reset is not a server retention/deletion guarantee.

No hosting project/site ID is stored in the checkout or available hosting tools. Existing site identity/configuration is preserved by making no hosting changes; the remote Pages baseline is untouched. All AI OS work remains uncommitted locally; no deployment is implied by a passing build.

## Required before real accounts or user data

- Inspect the other modules and reconcile existing contracts/auth/hosting identities; owner approves broader integration changes.
- Select/reuse an established MFA/passkey-capable auth provider, backend/database/job runner, managed secret/key storage, production domain/callbacks and retention/access policy.
- Implement and test server-enforced membership/resource isolation, secure sessions/CSRF, least-scope OAuth consent and revocation, typed version-bound approvals, transactional duplicate prevention, redacted durable audit and authorized exports/deletion.
- Configure and verify production transport/security headers and operational rate limits/monitoring. Preserve existing hosting project; never invent a new Site.
- Commission an **authorized security assessment of the integrated system**, remediate findings and retest before real-user launch. Third-party testing requires its own permission. Passing this local suite does not establish absence of vulnerabilities.

The running app remains entirely fictional and deterministic, without real AI/accounts/external actions. The integration documents are engineering requirements, not claims of implemented backend protection.
