# Orbit — Executive Assistant preview 0.3.1

## Try Orbit

After approving the current saved draft, use **Copy reviewed draft** or **Download reviewed draft (.txt)**. Both include the request, saved campaign brief when available, version reference, and all three content assets. They verify the latest saved workflow first, reject local unsaved edits and changed versions, and label exports as sample content. Clipboard denial has a download fallback. Completed simulated requests remain exportable; cancelled or unreviewed requests are not. Copy/download do not publish or record a send.

Today offers a guided campaign brief (business/service, audience, platform, tone, desired result, and optional details), or a free-form request. Unfinished fields stay in browser recovery; submitting saves a structured brief with the workflow and clears the composer. The saved brief is available in request details. Fields do not turn sample output into AI-generated content: generation remains a fixed fixture. No provider or paid service is connected.

Run `npm start` from this directory and open http://127.0.0.1:4317. Node 20 or newer is sufficient; no dependency installation is needed.

Orbit is the front door: Today shows the next draft needing review, browser-saved priorities, and a natural-language request form. My requests keeps each request, assistant response, draft, review, and history together. Preparation roles are behind a progress disclosure instead of an agent-management interface. Activity links back to the associated request.

The server runs the shared workflow core with fixture adapters. It does not load the complete baseline applications, connect their storage, generate AI content, or merge their full feature sets. Campaign output is fixed fictional sample content regardless of the request; the UI says so at the request and draft boundaries. Inbox, calendar, and publishing are not connected. The 0.2 baseline adapters remain available and independently tested.

One fictional Dave/Work context is assigned by the local server. This is not sign-in or production tenant authorization. When started with `npm start`, the local server saves workflow records, Marketing source snapshots, and simulated receipts to ignored `local-data/history.json`. They survive server restarts. Writes use a temporary file plus replacement; an unreadable existing history file stops startup instead of overwriting it. Use one server process per history file. This is local plaintext demo storage, without cloud backup or multi-user access controls.

Browser recovery copies preserve unfinished draft edits per request and original version, unsubmitted request text, priorities, and the current view. Navigation, Refresh, and reload keep those copies. A recovery copy never authorizes execution: submit changes as a new version and approve that exact version. If a different tab saved a newer server version, Orbit keeps the local edits separately and offers explicit restore or discard. If browser storage is unavailable, edits remain in the tab and closing it triggers a warning. Clearing browser site data removes recovery copies and priorities; clearing it does not remove server-saved history.

The server binds only to `127.0.0.1`, checks local Host and mutation Origin, accepts bounded JSON writes, and serves four allowlisted web assets. Local history is not exposed as a static asset. Do not expose the server as a production service.

To try it: enter a marketing request on Today, choose **Ask Orbit**, edit the launch post, navigate to Activity and return, choose **Save changes for review**, approve that version, and choose **Preview approved send**. Edits invalidate earlier approval. Browser recovery edits block approval and execution until submitted. Completed work records one simulated receipt, with no provider action.

This package implements one dependency-free, fictional workflow across the verified Orbit, AI OS, and Marketing Agent baselines. Version 0.2 adds production-shaped adapters for the actual baseline service contracts while keeping every execution simulated. It does not merge or modify the preserved release branches and performs no network or provider action.

See the [reconciled integration plan](INTEGRATION-PLAN.md) for ownership, versioning, approval, and production hold decisions.

## Workflow

Draft saves require `baseVersionId`, naming the version the editor started from. Missing or outdated preconditions return `DRAFT_STALE` without changing saved history or approvals. The browser loads the newer saved version and keeps the older local edits separately for explicit comparison/restoration. Launch post, video script, and at least one calendar item must be non-empty before save, approval, or simulated execution; invalid legacy records cannot bypass those checks. Calendar input ignores empty lines. Today prioritizes failed requests. Explicit inbox and meeting-action requests are rejected with a capability explanation; this is a conservative preview guard, not an AI intent router.

1. Orbit establishes a fictional campaign brief.
2. AI OS schedules the preparation tasks and owns the workflow state.
3. Marketing prepares campaign assets and supplies precise campaign/version revisions.
4. Dave reviews one frozen payload identified by a SHA-256 digest.
5. Orbit records one idempotent simulated send.
6. AI OS marks the workflow complete only after that execution succeeds.

The workflow has one ID, one review boundary, and one activity trail. Editing creates a new frozen result and invalidates prior approval. A mutable Marketing source revision is rejected before approval or execution. Workspace mismatch, cancellation, generation failure, persistence failure, execution failure, and retry without duplicate execution are covered by tests.

## Baseline adapter layer

`src/baseline-adapters.js` maps the shared workflow to the verified application boundaries without copying their implementations:

- `AiOsEngineAdapter` calls the AI OS `enqueue(state, request, type)` contract and persists the resulting scheduled state.
- `MarketingCampaignServiceAdapter` calls `CampaignService.createCampaign/getCampaign/listCampaigns`, reuses an actor/workspace-scoped idempotency key, and returns exact campaign and version revisions.
- `OrbitReplyServiceExecutorAdapter` projects the already-approved shared payload through Orbit's draft, review, approval, and execution services, then accepts only a `simulated: true` receipt.
- `createBaselineAdapterSystem` wires those ports into `SharedAgentOperations`; the baseline modules remain injected so their release branches stay untouched.

The adapters reject actor/workspace mismatches and unsafe non-simulated receipts. They do not authenticate a user, connect an account, publish content, or turn browser state into authorization.

## Verified source baselines

| Project | Branch | Commit | Version |
| --- | --- | --- | --- |
| Orbit | `gh-pages` | `d15e6bf7cb0cf94c3fce79e8b43e24d524efdb77` | `1.5.0` |
| AI OS | `ai-os-baseline-v1.2.1-demo` | `f1ed525ed7b19959d8d6d651116688192ff8396b` | `1.2.1-demo` |
| Marketing Agent | `marketing-agent-baseline-v0.2.0` | `eb2434cf4604627f56ca49a5d1f3959b5edb72f2` | `0.2.0` |

## Run

```sh
npm test
npm run demo
```

Node 20 or newer is sufficient. There are no package dependencies or secrets. The test suite includes the original workflow scenarios plus contract tests for the three baseline adapters.

## Boundary

The adapters are explicit fixtures corresponding to the three existing application-service boundaries. Browser-local Orbit and AI OS state is not treated as authorization or durable audit. Marketing's local synthetic login is not reused as production identity. This package does not add authentication, OAuth, real accounts, a backend deployment, or a connector.

Before real accounts, select an identity provider, backend/database/job service, secrets strategy, provider OAuth applications/scopes, hosting/callback identities, retention policy, and authorized security assessment scope. Those remain owner decisions and are intentionally outside this change.
