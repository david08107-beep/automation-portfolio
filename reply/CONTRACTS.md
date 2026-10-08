# Reply application contracts — demo boundary v1

All operations are synchronous, take explicit plain-object inputs, and return `{ok:true,value}` or `{ok:false,error}`. No DOM, browser storage, authentication, model, connector, or worker is used by `core.js`. The browser adapter injects persistence; the Node memory repository makes the same workflow usable headlessly.

| Contract | Fields |
|---|---|
| Message | id, workspaceId, index, sender, to, subject, body, summary, recommendation, received, priority, prepared fixture draft |
| WorkspaceContext | `{id}`; `personal` / `work` are demo fixture namespaces, not authenticated tenants |
| ActorContext | `{id}`; UI uses `demo-dave`; this is explicit context, not proof of identity |
| ReplyDraft | id, messageId, workspaceId, actorId, currentRevision, versions, optional alternativeIndex |
| ReplyDraftVersion | immutable id, draftId, revision, messageId, workspaceId, actorId, body, to, subject, brief, settings, createdAt, status=`saved` |
| ReplyReview | id, draftId, versionId, revision, messageId, workspaceId, actorId, createdAt, status=`requested` |
| ReplyApproval | id, draftId, reviewId, versionId, revision, messageId, workspaceId, actorId, approvedAt, expiresAt, status=`approved` / `invalidated` / `executed` |
| ReplyExecution | id, idempotencyKey, draftId, versionId, approvalId, messageId, workspaceId, actorId, at, status=`Sent`, simulated=true, exact payload |
| ReplyActivityEvent | id, workspaceId, actorId, messageId, kind, at, and referenced draft/version/review/approval/execution IDs |
| StructuredError | code, message, retryable, details; values do not contain raw exception messages or credentials |

## Service methods

- `loadMessage({workspace,actor,messageId})` reads the injected fictional message catalog.
- `createReplyDraft(context + {body?,brief?,settings?,to?,subject?})` creates revision 1 or returns the existing draft.
- `reviseReplyDraft` / `saveReplyDraftVersion(context + {draftId,expectedRevision,body,brief?,settings?,to?,subject?})` append immutable revisions. Identical snapshots reuse the current version.
- `prepareReplyAlternative(context + {draftId,expectedRevision,brief,settings,to?,subject?})` uses deterministic templates in the core; adjacent alternatives differ.
- `requestReplyReview(context + {draftId,versionId})` reviews the current exact version.
- `approveReplyVersion(context + {draftId,reviewId})` approves that version for ten minutes.
- `executeApprovedReply(context + {draftId,approvalId})` verifies context, current revision, approval state/expiry, and existing execution before calling the demo adapter.
- `getReplyHistory(context)` returns cloned versions, reviews, approvals, executions and domain events.

Settings use goals clarify/confirm/decline, tones professional/warm/concise, and assessment positive/mixed/negative. Editing/restoring a version creates a new revision and invalidates old approvals. Earlier version objects are never updated by the service. Approval state is a separate record. Exact-version review and explicit approval are separate operations; the current Send Reply button calls them after collecting the body Dave is confirming, then simulates execution.

Errors: MESSAGE_NOT_FOUND, INVALID_INPUT, STALE_REVISION, APPROVAL_REQUIRED, APPROVAL_STALE, ALREADY_EXECUTED, PERSISTENCE_FAILED, EXECUTION_FAILED, WORKSPACE_MISMATCH.

## Repository and execution adapters

`repository.read()` returns `{schemaVersion:1,drafts,reviews,approvals,executions,activity}`. `repository.write(snapshot)` atomically replaces that repository's snapshot or throws. Both directions use clones. The service converts thrown I/O errors into structured persistence failures. The memory repository is atomic within a synchronous JavaScript process; this is not a concurrent server/database transaction protocol.

The browser adapter delegates to Orbit's existing workspace state/save function. Its success includes `durable:false` when browser storage is blocked/full or the guided demo is temporary; this preserves existing session-only behavior and visible warnings. It never claims those decisions survived refresh. Core state is additive under each workspace's `replyCore`, retaining the existing storage key and unrelated fields.

The executor receives the exact version, approval, current time, and key `workspace:draft:version`. It returns a simulated receipt or throws; `failNext()` exists only on the demo adapter for tests. Durable execution records reject repeats with ALREADY_EXECUTED and return the existing record. The adapter also reuses a receipt if persistence failed after simulation, preventing a second simulated send during an in-process retry. No real message is ever sent.

A process crash after an adapter receipt but before durable storage is NOT a solved distributed exactly-once guarantee. A future real connector requires a durable outbox/provider idempotency and reconciliation. Do not use this browser adapter as server authorization, tamper-proof audit, or an autonomous execution host.

## UI compatibility and migration

Immutable fixtures replace DOM-derived reply message data. Legacy saved drafts/history migrate on first save/edit/send without changing their content, brief, or settings. Their import receives new core revision identities and import timestamps; original content/settings are retained. Dashboard fields (`messages`, `drafts.reply`, `executions.reply`) remain compatibility projections for counts/activity; they are not a second agent API. Legacy completed replies remain read-only in the UI; old historical sends are not re-executed or fabricated as new approved service operations. Before exposing this adapter to a non-UI caller, migrate/reconcile legacy terminal actions into a durable service-level execution ledger; the current UI terminal guard is not an authorization boundary.

Corrupt core snapshots are retained and produce a visible persistence error rather than silently erasing valid history. Reset Demo deliberately clears both workspace contexts; guided demo snapshots/restores the entire state including replyCore. No migration of real data, backend services, or shared orchestration is implemented.
