# Orbit threat model and security assessment boundary

## Assets, actors, and trust boundaries

Current assets: fictional briefs, local drafts/history, local task decisions, and simulated execution records. Future assets: private messages/documents, user identities, sessions, provider credentials, tenant data and authorized external changes. Consider anonymous attackers, authenticated users attempting cross-tenant access, compromised accounts/providers, malicious retrieved content, injected/stored markup, and stolen devices.

Boundaries: user input → DOM; browser storage → normalized demo model; draft → explicit review → simulated execution; future browser → authenticated API → authorized datastore; future orchestrator/LLM → scoped connector → external provider. Browser state and model outputs are untrusted. A user owning this browser can alter all demo decisions; client checks cannot defend against that user or a compromised origin.

| Threat | Current safeguard / finding | Required before real accounts |
|---|---|---|
| Stored/reflected XSS | User content/history uses textContent/value; static fixture markup uses innerHTML. Meta CSP limits scripts, connections, base URLs and embeds. Preview script uses a build-time hash. | Context-sensitive encoding, runtime schema validation, header CSP/nonces, safe Markdown sanitization if added, dependency review |
| Wrong/stale confirmation | Execution requires named confirmation submitter, open panel, current workspace, valid payload, pending action; duplicate local sends are ignored | Server binds approval to canonical payload revision and actor/workspace, expiry, scope, idempotency and fresh authorization |
| Cross-tenant reads/writes | No backend or tenants exists; fixture contexts are normalized separately | Object-level/field-level authorization and tenant-scoped queries, export/search/stream tests, negative tests using two users |
| Corrupt/tampered browser state | Known fields/enums/history are normalized; state length is bounded; bad context can reset independently | Browser data must never supply authoritative approval, membership, credential or audit truth |
| Token/session theft | No auth tokens or account credentials exist in app | IdP MFA/passkeys, secure cookies, session revocation/rotation, backend-only encrypted OAuth tokens, no secrets in localStorage |
| OAuth confusion/replay | OAuth is absent | Code+PKCE, state/nonce checks, redirect allowlist, refresh/token lifecycle, account ownership binding and scoped disconnect |
| Prompt injection/tool misuse | No LLM or tool-connected account exists; brief remains literal user text | Distinguish instructions from retrieved content; constrain tools and scopes; output validation; never let a model authorize writes |
| Leaks via activity/downloads | No console logging or network telemetry in app; reply download contains its selected fictional recipient/subject/body, intentionally | Redacted diagnostics, authorized exports, consent/minimal content, privacy labels and retention/deletion controls |
| Supply-chain compromise | No application package manifest or bundled third-party runtime libraries were found | Maintain SBOM and pinned dependency audit for future IdP/backend/connectors; signing/integrity checks as applicable |
| CSRF/clickjacking/missing headers | Static app has no server sessions; meta CSP cannot enforce frame-ancestors | Server CSRF/origin protections; header frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy and appropriate HSTS |
| Abuse/DoS and retries | Demo payload/history caps; no server rate limiter | Per-user/workspace/provider limits, timeouts, bounded queues, backoff, safe retries and anomaly monitoring |

## Implemented in this local pass

Open-review/workspace confirmation guards; single-line email metadata validation; calendar dates round-trip without silently rolling invalid days; bounded browser state/history ingestion; restrictive connection/embed/base/form policy; hash-authorized bundled preview script; no-referrer metadata. Existing draft normalization, literal text rendering, explicit contextual actions, duplicate state checks and corrupt-storage recovery remain in place.

The CSP permits inline styles for existing dynamic styling; it does not permit arbitrary inline scripts/eval. A meta policy cannot protect HTTP responses before parsing, prevent framing, or establish backend authorization. GitHub Pages headers are not changed here. Walkthrough pages contain only fixed scripted content; the main app/preview are the protected user-input surfaces.

## Test scope and release gate

Use the local app, synthetic malicious text and isolated browser profiles. No penetration testing, credential attacks or scans of GitHub/provider infrastructure are authorized here. Static pattern scans can detect likely secrets; they are not exhaustive. No application third-party dependency inventory exists to scan for CVEs; test tooling is outside the shipped app. Auth/session/OAuth/CSRF/server-tenant tests are not runnable until those systems exist and must not be marked passed.

Before real-user launch: documented test authorization and environment scope; independent assessment of API/auth/OAuth/isolation/execution; dependency/secret scanning; tests for sensitive logs/downloads; fix critical/high findings and retest, triage any residual risks; establish monitoring, incident response, patching and recurring assessments. Passing tests does not prove zero vulnerabilities.


## Local reply foundation safeguards and limits

Implemented: explicit actor/workspace context checks, exact-revision approval with ten-minute expiry, invalidation on edits, structured input/error handling, cloned immutable versions, simulated executor deduplication, corrupt repository rejection, and refresh reconciliation from recorded receipts. Browser storage remains owner-editable and is not authentication, tenant enforcement or a trusted audit. Legacy completed replies stay read-only; historical approvals are not invented. New service history is additive and Reset intentionally clears both contexts.

Remaining: cross-tab/server concurrency control, atomic durable outbox/receipt reconciliation after process loss, server-enforced identity/authorization, provider idempotency and all real-account security controls. No real action, account, token, agent or worker was introduced. See [service contracts](../reply/CONTRACTS.md).
