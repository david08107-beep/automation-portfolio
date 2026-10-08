# Executive Assistant integration plan — proposed contract 0.1

This is a project-local proposal, not an agreed shared implementation. Inspection found only `ai/executive-assistant-dashboard/` in this checkout; no AI OS, Marketing Agent, shared contracts, backend, or identity-provider configuration was available. Review their actual models before promoting this document into a shared package. Do not create competing sign-in systems.

## Current boundary

Local reply foundation: `reply/core.js` now exposes a DOM-independent service through an injected repository/demo executor. Explicit message fixtures and a browser adapter bridge existing workspace storage and UI. [Reply contracts](../reply/CONTRACTS.md) define immutable revisions, review/approval, idempotency and structured results. Only this workflow is extracted; remaining handlers are not agent APIs. Overall Agent Operations readiness remains HOLD.


Orbit is HTML/CSS/vanilla JS with fictional Dave/D identity. `personal` and `work` select fixtures, not tenants. Commands use deterministic routing and timers. State is browser-local under `orbit.executive-assistant.workspaces.v1`; navigation has a separate preference key. Local approvals, message drafts/history, tasks and activity can be edited by the browser owner. They are not authoritative authorization or audit records.

Hosting is the existing GitHub repository `david08107-beep/automation-portfolio`, Pages branch `gh-pages`, root folder. There is no separate hosting project ID in this checkout. Preserve the published `v1.5.0-demo` tag and current Pages branch. New work stays local until explicitly authorized for publication. The inspected checkout is on `work` at `f5697a2`, with untracked `ai/` work; preserve it and do not reset or merge blindly.

## Proposed shared records

Every record has `schemaVersion`, server-generated `id`, server-derived `workspaceId`, UTC timestamps, and a revision where editable. Never authorize using a workspace ID or owner field supplied by a client. Examples are shape descriptions, not browser-trusted permissions.

| Record | Proposed fields and ownership | Orbit mapping |
|---|---|---|
| User | `id`, IdP subject mapping, displayName; no provider tokens | Dave is a fixture, not an authenticated user |
| Membership | workspaceId, userId, role; server-enforced | Personal/Work tabs are not memberships |
| Profile | workspaceId, ownerId, locale, timeZone, preferredTone, review preferences, revision | Dave identity, local reply settings; no editable shared profile exists yet |
| Command | id, moduleId, requestText, profileRevision, correlationId, status | Route and response text; generation timers are transient |
| Workflow | commandId, planRevision, steps, status, resultRefs | Existing orchestration sequence; ephemeral execution timeline |
| Draft/result | workflowId, kind, version, brief, body, settings, sourceRefs, profileRevision | Message-specific draftHistory; retain exact original snapshots |
| Prepared action | workflowId, operation, canonical payload, payloadVersion, risk, requiredScopes, state | reply/meeting/report IDs are local; namespace/import them rather than treating them as global IDs |
| Review | preparedActionId, payloadVersion, decision, actorId, confirmationTime, expiry | Local explicit review; not a signed or trustworthy authorization |
| Execution | preparedActionId, authorizedVersion, idempotencyKey, state, provider receipt | `executions` are fictional success records only |
| Audit event | actor, workspace, object/version references, operation, outcome, correlationId | Activity is mutable local UI history, not a compliance log |
| Connection | workspaceId, ownerId, provider, scope names, status, expiresAt, credentialRef | Absent; credentialRef never resolves to a token in a browser response |

Proposed module IDs: `executive-assistant`, `ai-os`, `marketing-agent`. Confirm compatibility with the other projects before adopting them. Workflow states: queued, running, awaiting-review, completed, failed, cancelled; prepared actions additionally support deferred, rejected, expired, superseded. Separate draft readiness from execution completion. Declining/defer does not mean executed. A mixed/negative assessment must not be silently converted into unconditional approval.

## One app, one handoff

A single command requests a campaign. Orbit gathers priorities and proposes a plan; AI OS schedules authorized analysis/preparation; Marketing returns versioned drafts; the common review queue lets the user edit, approve or reject the exact result. The execution service then verifies membership, scope, review version, expiry, and idempotency before any provider operation. Modified drafts invalidate prior confirmation. Users see one command and one audit history; modules exchange object references through the backend, not separate sign-ins or browser-storage copies.

## Phased delivery

1. Reconcile these contracts with actual AI OS/Marketing models. Add contract tests in an authorized shared location; retain a demo adapter for this project. Do not rename persisted Orbit keys casually.
2. Select one IdP with MFA/passkeys; deploy server sessions and tenant authorization. Use IdP MFA enrollment/recovery; OAuth connections are distinct from app MFA. Choose backend/database/region and retention policy before moving any real data.
3. Implement authenticated workflow/draft/review APIs, immutable versions, server audit, authorization tests, idempotency, and failure/retry handling. Migrate only explicitly chosen data; browser state is untrusted input.
4. Add OAuth connectors with scoped consent and revocation. Use authorization code + PKCE, validated redirect/state, OIDC nonce where applicable; handle callback failures, disconnect, expiry and revoked tokens. Connector write scopes and final execution require explicit user authorization.
5. Run the integrated security assessment and remediation/retest gate before admitting real user data.

GitHub Pages cannot host server sessions or safely hold credentials. Preserve the existing public demo and hosting identity; selecting a backend service or changing deployments requires a separate explicit decision. Do not pretend browser-only controls implement authentication, MFA, encrypted token storage, rate limits, or tenant security.

## Data and operations

Tokens live only in backend encrypted storage/managed secrets, with rotation and limited service access. API responses redact credentials. Use TLS, secure HttpOnly cookies with appropriate SameSite, CSRF/origin checks for cookie-authenticated writes, short sessions and reauthentication for sensitive actions. Enforce authorization on reads, searches, exports, streams, objects and revisions, not just buttons. Minimize retrieved account content and provider scopes. Establish user export/deletion, retention, backups and deletion propagation. Keep audit metadata useful without putting bodies, tokens, authorization headers, or MFA codes into logs.

Real launch remains blocked on backend/IdP/database decisions, credentials supplied through secure configuration, explicit authorization for integrations, shared-contract agreement, and tested server enforcement. None is implemented by this static demo.
