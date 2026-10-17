# AI OS v1.2.1-demo — integration and security foundation

## v1.2.1 foundation

- Document compatible identity/profile/workflow/result/review/audit/connection contracts and module boundaries without merging projects or adding authentication.
- Add an integration plan, threat model and security validation record with explicit real-user release gates.
- Allowlist restored model/view fields and bound untrusted data; retain corrupt snapshots until an explicit change/reset.
- Bind local approval to the exact previewed draft and reject duplicate terminal decisions.
- Update Vite to 7.3.7 and the locked esbuild dependency to 0.28.2; npm audit reports zero advisories at review time.
- Preserve fictional execution and existing hosting configuration.

## v1.2.0 usability review

- Remove the duplicate Needs your decision list. Prioritize failures and older reviews in the single workflow queue.
- Open results/recovery directly from queue items and summary cards; place the actual action before collapsible plan details.
- Move the execution workspace before the agent fleet so monitoring does not block work.
- Generate/restore drafts in one click while retaining prior text. Keep explicit approval, cancellation, and reset confirmations.
- Add desktop/mobile checks for action visibility, direct summary navigation, plan access, and retry focus.

## v1.1.0 review tools

- Generate a distinct deterministic alternative while retaining the exact current draft.
- Restore saved draft versions with original request/process context, confirmed replacement, and retained edits.
- Safely escape saved history text; use a bounded mobile history panel and an accessible close button.
- Download exact plain-text drafts and surface clipboard denial/unavailability.
- Validate saved draft metadata and recover through the existing invalid-storage warning.
- Preserve simulation-only behavior and explicit approval. No profile, tone, customer-feedback, or hosting features were invented.

## v1.0.4 purpose polish

Clarify the workplace purpose in the landing copy and README: coordinate IT requests and operational updates, review exceptions, and approve prepared results. Retain all three processes and the broader control center. No new integrations or unmeasured time-saving claims.

## v1.0.3 completion

- Make all retained activity browsable in batches of 60, with a visible event count and filter reset. Previously only the latest 60 events were accessible.
- Add a keyboard skip link into the main workspace.
- Complete the MVP acceptance review and refresh the portable demo and actual browser screenshots.

## v1.0.2 review fixes

- Reproduced a lost-workflow bug when two tabs saved independent workspaces. Added a best-effort snapshot guard: stale tabs pause scheduling and editing rather than overwrite the latest save.
- Close stale approval dialogs and require confirmation before reloading the latest workspace. Unsaved edits remain available to copy before reload.
- Give whitespace-only requests clear native validation feedback that clears when valid text is entered.
- Display the exact release version from the package manifest.
- Add engine and desktop/mobile regressions for these cases, including accessibility checks on the paused workspace.

The tab guard does not merge workspaces or provide atomic concurrency. Use a single tab for this browser demo.

## Delivered

- A multi-process operations overview with running, review, recovery, and completed counts.
- Four simulated agents with real assignments from the demo scheduler. Each agent holds one task at a time.
- Three distinct processes and outputs: operations brief, unsent project update, and software-request triage.
- Task ownership, within-workflow dependencies, state-driven execution tracks, and retained execution timelines.
- A shared approvals/recovery queue with direct access to prepared results or failures.
- Editable results and confirmation showing exactly what Dave approves locally.
- Failure injection, visibly blocked downstream tasks, retry, and cancellation.
- Filterable task board and activity stream across processes.
- Honest local-runtime diagnostics and visible browser-storage failures.
- Browser persistence, original-state migration, resumed execution, and a confirmed isolated reset.
- Responsive layout, keyboard focus management, live state announcements, and reduced-motion support.
- Static production build and a self-contained single-file demo artifact.

## Fixes made during validation

- Prevented concurrent workflows from double-booking agents.
- Kept approval dialogs stable while unrelated workflows execute.
- Preserved edits, keyboard focus, and panel scroll positions during scheduler updates.
- Made long approval previews keyboard-scrollable.
- Added strict restoration validation to diagnose corrupt or inconsistent task state.
- Made browser-storage failures visible and usable through a session-only fallback.
- Escaped request, result, activity, and restored identifier content before rendering.

## Verification and limits

Verified: production build, 19 engine/storage tests, 48 desktop/mobile browser checks (including automated WCAG AA checks of the seeded dashboard and confirmation dialog), and the single-file artifact smoke test all passed. Desktop and mobile layouts were visually reviewed. See README for reproducible commands.

This release is entirely simulated. It has no real models, external APIs, accounts, authentication, server persistence, or external actions. Tasks depend on earlier tasks within the same workflow; cross-process dependencies are not implemented. Browser storage is not a secure or authoritative audit log and tabs do not synchronize.

The single-file artifact is verified over loopback HTTP without asset/API requests. Direct file navigation is blocked by the managed cloud browser and is not verified here. No public preview has been published; hosting remains dependent on usable deployment/API access. Orbit, other projects, existing publishing configuration, and preserved tags are unchanged. The uploaded video remains unreviewed because it exceeds the transfer limit.

## IT operator review improvements

- Retain native editor Undo and scroll during background execution through keyed DOM updates.
- Resume failed tasks while preserving completed prerequisites.
- Keep retried/approved/cancelled work visible when a filter would hide its new state.
- Persist the selected workflow and view preferences across reloads.
- Show the chosen demo process before creating a request; allow explicit override of keyword routing.
- Prioritize failures and older review items; offer a direct, individually confirmed next review.
- Continue simulation scheduling during text composition without replacing the active input.
- Audit edits against their actual workflow and preserve corrupt snapshots while changing view preferences.

See [OPERATIONS_REVIEW.md](OPERATIONS_REVIEW.md) for measured results and remaining optimization opportunities.
