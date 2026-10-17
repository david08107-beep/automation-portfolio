# AI OS — senior engineering / IT operator review

This review uses the existing deterministic demo and fictional records. It does not establish real AI, integration, security, or production operations readiness. All changes remain inside AI OS.

## v1.0.2 follow-up review

Two tabs open on the same empty workspace could independently save requests, leaving only the second request in storage. The persistence adapter now compares its last saved snapshot before each write and detects storage events from other tabs. A stale tab pauses, closes obsolete approval dialogs, keeps local text copyable, and requires confirmation to reload the latest save. This is a best-effort local safeguard; concurrent writes are not atomic and tabs do not merge workspaces.

A whitespace-only request previously failed silently. It now gets a native validation message and accepts subsequent valid input. The displayed version comes from the package manifest. Regression coverage includes stale writes, explicit reload, interrupted approvals, paused scheduling, and accessible conflict feedback at desktop and mobile sizes.

## Operator journeys exercised

- Queue an operations brief alongside a project update; inspect assigned agents, dependencies, and progress while editing a prepared brief.
- Review the software-request triage output, including the elevated-access exception REQ-112. Approving the recommendation never grants access, installs software, or approves an external request.
- Choose the request-triage process explicitly for a custom security-related request rather than relying on ambiguous keywords.
- Inject a failure after the Planner completes, filter to failed work, retry, and verify that completed planning is not repeated.
- Edit and approve one result, then move directly to the next result; require a separate contextual confirmation for every approval.
- Reload during execution and during review; recover the selected workflow and filters without losing edited results.
- Cancel work, reset the demo, handle missing/corrupt browser storage, use keyboard controls, and inspect desktop/mobile/narrow layouts.

## Confirmed problems and fixes

| Observed issue | Correction |
| --- | --- |
| A background tick replaced the result editor, discarding its native Undo history and scroll state. | Reconcile keyed DOM nodes rather than replacing the workspace. Preserve the existing editor when its workflow and value are unchanged. Browser tests exercise native Undo across execution ticks. |
| Retrying from the Failed filter left an empty queue while the selected job was executing. | Explicit transitions reveal the selected workflow when the previous filter would exclude its new state. |
| Retry discarded completed tasks and repeated planning. | Resume the failed task and downstream tasks; retain completed prerequisites and the full event history. |
| Custom command keywords could select an unintended process without a clear pre-submission plan choice. | Add an explicit demo-process selector and visible process preview. Suggestions choose their own process; keyword routing remains available and labeled. |
| Reload could switch away from Dave's current review. | Validate and persist selected workflow, filters, process choice, and timeline preference alongside domain state. |
| Finishing a review required finding the next result elsewhere. | Offer Review next result, with a fresh confirmation for that result. Failure items are prioritized; reviews are ordered oldest first. |
| Text composition suspended every agent's scheduler. | Continue scheduling and saving domain progress during composition; defer visual updates until composition ends. |
| View preference writes could overwrite an unreadable saved snapshot. | Keep that snapshot untouched when only browsing filters or choosing a process. |
| Rebuilding or leaving an editor could miss or misattribute edit events. | Track dirty edits by the editor's workflow ID; flush before review/navigation and on page exit. |

## Measured checks

In the same two-workflow editing scenario, one scheduler tick previously removed **390 DOM nodes**. With keyed reconciliation it removed **1**, and the result textarea kept its identity. Native Undo with an inserted text transaction restores the prior result after the background tick. This measures DOM churn for that scenario, not total render time, CPU use, or a general speedup percentage.

A domain stress run queued **24 mixed workflows**. All reached awaiting-review in **27 scheduler ticks**, no agent was double-booked, and **zero workflows were automatically approved**. Its serialized domain state was approximately **87 KB**. Task durations and records are simulated; tick counts are not production throughput estimates.

The regression suite now contains **15 engine/storage tests** and **38 desktop/mobile browser checks**, including seeded-dashboard/dialog WCAG AA scans, native editor behavior, composition, filters, recovery, and reload context. The production build and the single-file artifact smoke test are also checked. See README for commands. Automated accessibility checks do not substitute for testing with assistive technologies.

## Remaining optimization opportunities

1. **Ground real work in structured inputs.** The current three process templates produce canned fictional outputs. Real operations need scoped data sources, ownership, evidence, and tested input contracts before connecting AI or granting action permissions.
2. **Replace local persistence for sustained use.** The current adapter serializes the workspace synchronously, guards stale writes on a best-effort basis, and does not synchronize or merge tabs. A backend needs authenticated ownership, transactional decisions, durable jobs, and server-side authorization. Profile IndexedDB or debounced snapshots only if larger local-demo workloads justify them; immediate result saving currently protects edits.
3. **Scale the views when the workload demands it.** Current scroll regions still render their full workflow/task collections. Pagination or virtualization should follow real workload measurements and preserve accessible navigation. Activity initially shows 60 events, with explicit access to older batches; saved history remains complete.
4. **Measure actual job durations before changing agent capacity.** The scheduler uses one-task-per-agent capacity and a simple simulated clock. Agent pools, priorities, backpressure, timeouts, and idempotent external retries need real job characteristics and integration contracts.

Real AI, accounts, external actions, authentication, server persistence, live infrastructure monitoring, and cross-process dependencies remain unimplemented. The uploaded video remains unreviewed because it exceeds the transfer limit. Orbit and existing publishing configuration remain protected. No public deployment is claimed.

## v1.2.0 click review

| Element | Operator judgment and change |
| --- | --- |
| Needs your decision list | Repeated the queue and sent the operator past completed-task details. Removed; the queue prioritizes the same decisions. |
| Workflow queue | Useful single source for selection, status, and triage. Review/recovery rows now open the actual action directly. |
| Summary cards | Useful counts, previously indirect navigation for reviews/failures. Now filter and open matching work in one click. |
| Plan and execution track | Useful during execution; secondary during review/recovery. Collapse them below the action for those states. |
| Agent fleet | Useful monitoring across processes. Retained below the workspace rather than interrupting task completion. |
| Generate/restore draft confirmations | Extra clicks for reversible actions that retain prior drafts. Removed. |
| Approval/reset/cancellation confirmations | Useful deliberate boundaries. Retained with contextual copy. |
| Task board and activity | Useful cross-process status and traceability. Retained with filters and direct workflow navigation. |

Direct-action visibility and keyboard focus are regression-tested on desktop and mobile. No backend, integration, hosting, or external-action scope was added.
