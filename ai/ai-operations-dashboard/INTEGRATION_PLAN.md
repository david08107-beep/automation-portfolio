# Integration foundation — AI OS

Status: proposal for a future integrated system, plus local demo hardening. No authentication, backend, OAuth, shared contract package, or cross-app integration is implemented by this document.

## Inspected boundaries

The confirmed project is `ai/ai-operations-dashboard/` in `david08107-beep/automation-portfolio`. Its implementation is Vite/vanilla JS: `engine.js` owns serializable workflow state, `storage.js` local persistence, `ui.js` escaped rendering, and `main.js` interaction and the simulated scheduler. Existing state format is version 2 under `dave-ai-os-v1`. No applicable AGENTS.md was found. Git initially reports this app as untracked; tracked portfolio files have no changes.

Executive Assistant and Marketing Agent implementations are not present in this checkout. No existing shared contracts or hosting project/site ID were found. Do not infer their models or create a competing shared package. Reconcile this proposal against their actual models when available. Native Git read verifies remote `gh-pages` and `v1.5.0-demo`; preserve both. Previous read-only Pages inspection reported deployment from `gh-pages` root; this task does not change or revalidate live hosting. No Site, deployment, tag, or account connection is created.

## One product, distinct responsibilities

Use one application shell with sign-in, workspace selection, command input, connections, review queue, and activity. Executive Assistant owns priorities/context/delegation; AI OS owns orchestration, task/agent execution, the unified review queue, and audit coordination; Marketing Agent owns campaign briefs, generation, revision, and marketing results. A marketing request creates one workflow and routes its result to the same review surface, without navigating to another app. Keep the current single-queue AI OS interaction; do not duplicate review navigation.

Implement module adapters behind the shell rather than copying workflows into three separate stores. Existing demos stay isolated and fictional while contracts are reconciled. A release may ship the demo unchanged before any integrated shell exists.

## Proposed contracts and compatibility mapping

Use schema-versioned JSON contracts reviewed by all modules before creating a shared package. IDs are opaque server-issued identifiers; provider subjects are mapped to internal user IDs. Server membership, not a browser-supplied ID, determines access. ISO UTC timestamps come from the server for durable records.

| Contract | Proposed fields / invariant | Existing AI OS adapter |
| --- | --- | --- |
| User | `id`, display name, established-provider subject mapping held server-side | Dave / D are presentation fixtures, not authenticated identity. |
| Workspace / membership | `workspaceId`, `userId`, role and allowed capabilities; authorized server lookup | Local storage has no tenant isolation. Never interpret its keys as a workspace security boundary. |
| Profile / preferences | Versioned record, owner scope (`user` or `workspace`), domain namespace, validated values, optimistic revision | `view.selected`, filters, `process`, timeline visibility stay local preferences. Marketing tone/brand and executive priorities belong to separate namespaces of one profile service; none currently exists. |
| Command | `id`, `workspaceId`, `requestedBy`, `request`, module/domain, structured inputs, profile revision, creation time | `w.request` maps to request; `w.type` maps to existing recipe inputs (`brief`, `update`, `backlog`). Preserve original brief and settings snapshot. |
| Workflow | `id`, command reference, workspace, state, revision, tasks, outcome references | Keep `queued`, `running`, `awaiting review`, `completed`, `failed`, `cancelled` as wire states initially; display strings can differ. `w.created` maps to creation time; `step` is derived progress. Review approval and external execution outcomes must remain distinct. |
| Task / agent run | IDs, workflow, dependency IDs, assigned agent, state, attempt, timing, error code | `w.tasks` retains current pending/running/completed/failed/blocked/cancelled semantics. A backend replaces the page timer with durable leases/jobs. |
| Result / draft version | `resultId`, workflow, immutable `versionId`, parent, original inputs/profile revision, content type (`text/plain` initially), author/source, creation time | `w.result` maps to selected content; `w.drafts` become immutable versions rather than array indexes. Migrated legacy versions receive IDs in the adapter; edited text is retained. |
| Review | `reviewId`, workflow/result version, reviewer, decision, time, expected workflow revision | Current explicit local decision maps to a local-demo review only. Approval must bind to an exact immutable version, with server revalidation. |
| Execution action | `actionId`, workspace/workflow, review/version reference, typed action, connection reference, resource IDs, recipients/changes, required scopes, expiry, idempotency key, execution status | No current external action. Use distinct `send`, `share`, `reschedule`, `publish`, `modify_record` types; approval of a draft never implies any of them. |
| Activity / audit | event ID, workspace, actor, workflow/action, event type, server timestamp, correlation ID, safe summary, before/after version references | `state.activity` and timeline map through an adapter. Browser history is mutable; it is not a trusted audit trail. Never copy raw drafts/tokens into general logs. |
| Account connection | `connectionId`, workspace/owner, provider, consented scope identifiers, status, expiry/last refresh metadata | Client receives safe metadata only. Backend holds encrypted credential references; tokens and secrets never appear in this contract or localStorage. |

Do not silently promote browser data into authoritative workspace records. An explicit import must identify the destination workspace, validate schema/size, require membership, record provenance `local_demo`, and omit fabricated user/audit authority. Unknown fields are dropped. Contract migration must preserve old drafts and labels; it must not auto-execute approved demo work.

## Backend and sign-in design requirements

Choose an established OIDC authentication provider supporting MFA/passkeys, managed recovery, and organizational policy. Reuse an existing provider if the other modules already have one. No homemade passwords, MFA-code collection, authentication, or cryptography. Use supported SDKs/libraries for OIDC, OAuth PKCE/state/nonce, sessions, token encryption, and verification.

Use a backend-for-frontend with Secure, HttpOnly, appropriately scoped SameSite cookies; rotate sessions after authentication/privilege changes, enforce idle/absolute expiry and revocation. Validate issuer/audience/nonce and restrict redirect destinations. Require CSRF tokens plus Origin checks on cookie-authenticated mutations; no state-changing GET requests. OAuth callbacks need one-use expiring state bound to the session/workspace and PKCE; use exact registered redirect URIs. Cross-origin integrations need explicit CORS policy, not wildcard credentials.

Every API/job/export checks current user membership and action capability in the server's workspace scope. Scope database queries and storage keys to that workspace; enforce row-level policies where supported, and test both API and worker paths. Browser-provided owner IDs, connection IDs, actor names, or approvals are untrusted. Deny cross-workspace references. Durable workflow transitions and action claiming use transactions and version checks; client simulations provide none of these protections.

Connect each provider with minimum scopes only when a requested workflow needs them. Show the account, scopes, purpose, and expected actions at consent; require separate consent for upgrades. Store provider tokens only in a backend secret store or encrypted database using managed key services. Restrict service access, rotate credentials, avoid tokens in URLs/logs, and revoke/disconnect with provider support. Disconnection disables future jobs and refreshes immediately; handle in-flight actions explicitly and record their outcome. Do not delete audit facts needed to explain a prior external action.

## Contextual action boundary and duplicate prevention

1. Prepare immutable result and a typed, exact action proposal. The review UI shows destination account, recipients/resource, changes, and scope of the operation.
2. Dave explicitly confirms that action/version. Draft edits, changed destinations/scopes, stale resource versions, expired consent, or changed membership invalidate it.
3. Server validates session/CSRF, ownership, connection, scope, review/version, current external resource state and expected revision. Persist a one-use action intent and audit event transactionally.
4. Worker claims the action once using server uniqueness and idempotency records; use provider-supported idempotency when available. Never rely on disabling a browser button.
5. Record safe outcome identifiers. A timeout with unknown delivery state requires reconciliation, not blind retry; exactly-once delivery is not universally guaranteed by providers.
6. Separate `approved` from `executed`, `failed`, `unknown`, and `revoked` action outcomes. A local demo `completed` does not mean an email was sent.

## Deployment, privacy, and operations requirements

TLS for app/API/provider connections; managed protection at rest for databases, object storage, backups and tokens. Separate production and development secrets. Production host must set CSP (prefer nonces/hashes and no eval), frame-ancestors, HSTS once HTTPS/subdomain implications are reviewed, X-Content-Type-Options, Referrer-Policy, and a restrictive Permissions-Policy. These headers are not configured in the present demo. The single-file artifact and its inline code require an explicit CSP plan; do not weaken CSP globally to accommodate it. Never expose Vite's development server as production hosting.

Apply schema/size limits, request/job/user/workspace rate limits, bounded queues, upload/content-type checks, scoped error responses, and SSRF restrictions for imported URLs/tools. Treat model/tool output as untrusted content and instructions: retrieved documents must not grant actions or scopes. Keep action execution deterministic and policy checked outside model prompts. Plain-text rendering remains the default; sanitized rich text requires a vetted library and security tests.

Minimize profile/context data, record purpose and retention, implement workspace export/deletion controls with authorized confirmation and backup expiry policy, and disclose provider retention. Exports/downloads contain intentionally selected content only; users must be warned before exporting confidential data on shared devices. Redact logs structurally; tokens, authorization headers, raw prompts, session IDs, and personal content are excluded by default. Use correlation IDs and error classes for diagnosis. Set retention for draft versions and audit records according to customer/legal needs rather than inventing a duration now.

## Delivery sequence and decisions

1. Independently completed here: inspect local models; document adapters/threats; strengthen restore/approval boundaries; audit dependencies; test demo. No credentials needed.
2. Retrieve Executive Assistant/Marketing source and their existing contracts/auth/hosting metadata with authorization. Reconcile names and schema ownership. Keep project/site identities and Orbit baseline unchanged.
3. Select/reuse auth provider, backend/database/job service, secret/key service, provider OAuth apps and least scopes, hosting/domain/callback identities, retention/access policy. This needs owner decisions and server configuration; do not request tokens in chat.
4. Implement shared contracts and backend authorization/session/action services in an authorized broader repository change. Test integration using synthetic tenants, provider sandboxes and mocked tokens.
5. Add a single shell and adapters incrementally. Preserve working demos behind clearly labeled simulation mode; no silent data/account migration.
6. Before any real-user launch, commission an authorized assessment of the integrated system with written scope (app/API/jobs/auth/OAuth/infrastructure), remediation, retesting, and release approval. Never test third-party infrastructure without authorization.

Blocked before real accounts/data: provider/backend decisions and secrets, reconciled cross-app contracts, authoritative authorization/audit, safe OAuth lifecycle, production host security configuration, operational retention/monitoring, and the authorized security assessment. No claim that local tests prove an absence of vulnerabilities.
