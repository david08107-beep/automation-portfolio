# Reconciled Shared Agent Operations plan

## Decision

Proceed with one fictional integration workflow and keep real account connections, deployment, and production identity on hold. GitHub branches remain the source baselines; this branch adds an adapter-level simulation without changing or merging any release branch.

## Ownership and mapping

| Shared concern | Owner | Baseline mapping | Reconciled rule |
| --- | --- | --- | --- |
| Request and brief | Orbit | Fictional Dave plus Personal/Work contexts | Orbit supplies context only; its browser workspace is not tenant authorization. |
| Scheduling and workflow state | AI OS | Existing scheduler and review queue | AI OS owns the shared workflow state and cannot mark completion before execution succeeds. |
| Campaign generation | Marketing Agent | `CampaignService` and revisioned SQLite records | The adapter records campaign and version revisions, then freezes the exact output. `updateCampaignVersion()` cannot mutate an already approved shared payload. |
| Review | AI OS shell | Existing exact-preview UI check | Approval names the current immutable shared result ID and payload digest. Any edit creates a new version and invalidates approval. |
| Simulated execution | Orbit | Reply service approval/idempotency pattern | Execution revalidates workspace, source revisions, payload digest, and approval, then records one idempotent simulated receipt. |
| Activity | Shared operations layer | Three separate local histories today | One workflow ID and correlation ID own a single ordered activity trail. Browser histories remain non-authoritative projections. |

## State boundary

The simulation uses `queued/running/awaiting-review/completed/failed/cancelled` workflow semantics. Draft readiness, approval, and execution are separate facts. Completion follows a successful simulated receipt only. A retry uses the same idempotency key, so a persistence failure after the receipt cannot create a second execution.

Every prepared result stores:

- the shared result ID and version number;
- Marketing campaign ID/revision and version ID/revision;
- a digest of the Marketing source at preparation time;
- an immutable review payload and its own digest;
- the actor/workspace context and shared workflow/correlation IDs.

Changing the Marketing source revision or content makes the prepared result stale. Editing in the review surface creates a new immutable shared result while preserving its source references. Both cases require a fresh exact-version approval.

## Verified simulation cases

- happy path from brief through one simulated send;
- stale approval and edit invalidation;
- source change before approval and after approval;
- cancellation and wrong-workspace access;
- generation failure and safe preparation retry;
- execution failure without premature completion;
- persistence failure after execution and retry without duplication.

## Hold before real accounts

The following require explicit owner decisions and separate implementation authorization:

1. Identity provider and MFA/passkey policy.
2. Backend, database, durable job/outbox service, and hosting region.
3. Provider OAuth applications, callback identities, least scopes, and token storage.
4. Production session, membership, tenant authorization, retention, export/deletion, backup, monitoring, and incident-response policies.
5. Real connector semantics and reconciliation for unknown provider outcomes.
6. Authorized security assessment, remediation, and retest before real-user launch.

## Phase 2 adapter milestone

The 0.2 adapter layer now targets the verified service shapes instead of fixtures alone:

1. AI OS scheduling uses its exported `enqueue` boundary and an injected state repository.
2. Marketing preparation uses `CampaignService` with actor/workspace context and a stable shared-workflow idempotency key.
3. Marketing source checks reload the authoritative campaign and compare both campaign and version revisions.
4. Orbit execution uses its existing immutable draft, review, approval, and simulated execution sequence.
5. The shared operation passes workflow, correlation, actor, and workspace metadata into adapters and rejects mismatched contexts.

These are injected application ports, not copied release code. Connecting them to hosted services remains blocked on the identity, database, OAuth, retention, and security decisions listed above.

GitHub Pages and the browser-local demos cannot supply those controls. No fixture login, browser workspace, local approval, or simulated receipt may be promoted as production authority.

## Phase 3 local interface milestone

Version 0.3 adds one local dashboard over the shared simulation core: brief entry, workflow selection, review queue, editable immutable versions, exact approval, simulated execution, cancellation, and ordered activity. Three role labels express the existing ownership mapping. This shell uses fixture adapters; the original applications and their stores are not loaded or migrated. It is a visible integrated workflow demonstration, not a finished consolidation of all three products.

Browser requests use a loopback-only Node server with a server-assigned fictional context. Workflow state lives in memory and resets on server restart. The server serves allowlisted assets, rejects foreign Host/Origin values for local actions, and does not implement production identity, provider OAuth, durable jobs, or hosting.

Next work: connect the shell to the preserved application ports with an explicit module composition design, choose the production services listed in the hold section, then implement durable storage and authenticated boundaries. Real account connections and deployment remain separate approved milestones.
