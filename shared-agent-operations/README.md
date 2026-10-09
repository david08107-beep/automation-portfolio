# Shared Agent Operations — baseline adapters 0.2

This package implements one dependency-free, fictional workflow across the verified Orbit, AI OS, and Marketing Agent baselines. Version 0.2 adds production-shaped adapters for the actual baseline service contracts while keeping every execution simulated. It does not merge or modify the preserved release branches and performs no network or provider action.

See the [reconciled integration plan](INTEGRATION-PLAN.md) for ownership, versioning, approval, and production hold decisions.

## Workflow

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
