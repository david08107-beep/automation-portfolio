# Orbit — Executive Assistant preview 0.4.0

## Try Orbit

### Unified workspace preview

The entry point is the original **Orbit Executive Assistant**, including executive briefing, proactive recommendations, command center, Personal/Work spaces, inbox/reply editor, calendar review, tasks, document-sharing review, and the specialist visualization. **Workflows** and **Content Studio** are additive destinations in its navigation, not replacements for the assistant. They use the same campaign records, versions, approval controls, and simulated receipts. The campaign UI is mounted in an isolated shadow root on the same page, not an iframe.

Orbit source was retained from preserved commit `d15e6bf7cb0cf94c3fce79e8b43e24d524efdb77` in `executive/`. Local changes preserve the breadcrumb needed by navigation, announce context switches, and scope Reset Demo to the selected executive context. Asset paths and CSP allow local campaign requests. Original release branches are unchanged.

Personal and Work have explicit top-of-page buttons as their only workspace switcher; the redundant header dropdown is removed. Distinct headings/colors, inbox/calendar/task labels, and purpose descriptions identify the context. Personal contains family messages, appointments, bills, errands, and personal plans. Work contains professional emails, clients, projects, meetings, and business content.

Campaigns belong to Work Workspace. Business tools are hidden in Personal; a business deep link returns to Personal Overview with an explanation instead of changing context. Select Work explicitly to access them. Campaign code and records load only when a Work business area is opened. Context switching returns to Overview and preserves each context's saved changes.

Executive browser-local state and campaign server history remain separate; this is not a unified approval ledger or storage migration. Reset Personal demo resets only Personal executive data, and Reset Work demo resets only Work executive data. Neither clears the other context or campaign history. The guided assistant tour is available from Overview.

This is a same-owner, local demo separation—not authenticated account isolation. Both email sources are fictional. No real personal or employer inbox, calendar, or account has been connected.

AI OS operations-brief/triage recipes and capacity scheduler, and Marketing's standalone review-response/follow-up tools are still not imported. No connected accounts, live AI, deployment, or real sending has been added. `/campaigns` retains the smaller integration-only interface for diagnostics; it is no longer the main product.

### Start here

1. Open a terminal in `shared-agent-operations` (not the repository root).
2. Check that `node --version` reports Node.js 20 or newer. No `npm install`, API key, or account is required.
3. Run `npm start` and leave that terminal running.
4. Open [the working app](http://127.0.0.1:4317/) or [the six-step interview walkthrough](http://127.0.0.1:4317/showcase) in your browser.
5. Stop the server with Ctrl+C when finished. Saved history remains on this computer.

The walkthrough explains the workflow with illustrative examples; its Next step button does not create or edit a real request. Use the working app for hands-on testing. Localhost links work only on the computer running the server.

For the interview script and engineering summary, read [SHOWCASE.md](SHOWCASE.md). For current test evidence and historical baseline results, read [VERIFICATION.md](VERIFICATION.md).

### If setup fails

- `EADDRINUSE`: port 4317 is already occupied. Check whether Orbit is already running; do not start two processes against the same history file.
- Browser cannot connect: keep the server terminal open and use the exact `127.0.0.1` address above, not `localhost`.
- History cannot be read: stop and preserve `local-data/history.json`. Do not delete it to make startup work; inspect or restore a copy first.

### Use the working app

After approving the current saved draft, use **Copy reviewed draft** or **Download reviewed draft (.txt)**. Both include the request, saved campaign brief when available, version reference, and all three content assets. They verify the latest saved workflow first, reject local unsaved edits and changed versions, and label exports as sample content. Clipboard denial has a download fallback. Completed simulated requests remain exportable; cancelled or unreviewed requests are not. Copy/download do not publish or record a send.

Content Studio offers a guided campaign brief (business/service, audience, platform, tone, desired result, and optional details), or a free-form request. Unfinished fields stay in browser recovery; submitting saves a structured brief with the workflow and clears the composer. The saved brief is available in request details. Fields do not turn sample output into AI-generated content: generation remains a fixed fixture. No provider or paid service is connected.

Run `npm start` from this directory and open http://127.0.0.1:4317. Node 20 or newer is sufficient; no dependency installation is needed.

Orbit is the front door: Overview retains the original assistant. Content Studio keeps campaign briefs and drafts together; Workflows shows preparation, review, and completion. Campaign activity links back to its request. Executive inbox and scheduling actions use the original review dialogs, not the campaign form.

The server serves the retained Orbit browser application alongside the shared campaign workflow core with fixture adapters. It does not unify their storage, generate AI content, or load the full standalone AI OS/Marketing applications. Campaign output is fixed fictional sample content regardless of the request; the UI says so at the request and draft boundaries. Inbox, calendar, and publishing are not connected. The 0.2 baseline adapters remain available and independently tested.

One fictional Dave/Work context is assigned by the local server. This is not sign-in or production tenant authorization. When started with `npm start`, the local server saves workflow records, Marketing source snapshots, and simulated receipts to ignored `local-data/history.json`. They survive server restarts. Writes use a temporary file plus replacement; an unreadable existing history file stops startup instead of overwriting it. Use one server process per history file. This is local plaintext demo storage, without cloud backup or multi-user access controls.

Browser recovery copies preserve unfinished draft edits per request and original version, unsubmitted request text, priorities, and the current view. Navigation, Refresh, and reload keep those copies. A recovery copy never authorizes execution: submit changes as a new version and approve that exact version. If a different tab saved a newer server version, Orbit keeps the local edits separately and offers explicit restore or discard. If browser storage is unavailable, edits remain in the tab and closing it triggers a warning. Clearing browser site data removes recovery copies and priorities; clearing it does not remove server-saved history.

The server binds only to `127.0.0.1`, checks local Host and mutation Origin, accepts bounded JSON writes, and serves only explicitly allowlisted app and showcase assets. Local history is not exposed as a static asset. Do not expose the server as a production service.

To try it: enter a marketing request in Content Studio, choose **Ask Orbit**, edit the launch post, navigate to Activity and return, choose **Save changes for review**, approve that version, and choose **Preview approved send**. Edits invalidate earlier approval. Browser recovery edits block approval and execution until submitted. Completed work records one simulated receipt, with no provider action.

This package implements one dependency-free, fictional workflow across the verified Orbit, AI OS, and Marketing Agent baselines. Version 0.2 adds production-shaped adapters for the actual baseline service contracts while keeping every execution simulated. It does not merge or modify the preserved release branches and performs no network or provider action.

See the [reconciled integration plan](INTEGRATION-PLAN.md) for ownership, versioning, approval, and production hold decisions.

## Workflow

Draft saves require `baseVersionId`, naming the version the editor started from. Missing or outdated preconditions return `DRAFT_STALE` without changing saved history or approvals. The browser loads the newer saved version and keeps the older local edits separately for explicit comparison/restoration. Launch post, video script, and at least one calendar item must be non-empty before save, approval, or simulated execution; invalid legacy records cannot bypass those checks. Calendar input ignores empty lines. The diagnostic campaign-only Today view prioritizes failed requests. Explicit inbox and meeting-action requests entered in the campaign form are rejected with a capability explanation; this is a conservative preview guard, not an AI intent router.

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

The running dashboard uses explicit fixtures corresponding to the three application-service boundaries. The separate baseline adapter layer maps injected service contracts and is not loaded by `npm start`. Browser-local Orbit and AI OS state is not treated as authorization or durable audit. Marketing's local synthetic login is not reused as production identity. This package does not add authentication, OAuth, real accounts, a backend deployment, or a connector.

Before real accounts, select an identity provider, backend/database/job service, secrets strategy, provider OAuth applications/scopes, hosting/callback identities, retention policy, and authorized security assessment scope. Those remain owner decisions and are intentionally outside this change.
