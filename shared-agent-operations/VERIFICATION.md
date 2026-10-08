# Verification record — 2026-10-08

All checks used detached worktrees at the exact source commits listed in the package README. Generated files and test dependencies stayed in those detached verification copies.

| Scope | Result |
| --- | --- |
| Shared Agent Operations | 12/12 workflow and baseline-adapter contract tests passed; demo completed with one simulated receipt and zero external actions. |
| Orbit | 20/20 reply-service tests passed; both main/preview UI suites and both security-browser suites passed in installed Edge. |
| AI OS | 27/27 domain/storage tests passed; production build and portable artifact check passed. The full two-worker browser run passed 50/52 and timed out on the two variants of one cross-tab test; both variants passed when isolated with one worker. |
| Marketing Agent | TypeScript and production build passed; 16/17 service/HTTP tests passed on Windows. The remaining test completed its assertions but Windows denied deletion of its just-closed temporary SQLite directory. All three browser suites passed separately. |
| Dependency audit | Locked AI OS and Marketing installs reported zero known vulnerabilities. |

The AI OS result is treated as a concurrency-sensitive browser-runner flake, not a fully clean concurrent run. The Marketing result is treated as a Windows cleanup portability defect, not a domain assertion failure. Neither issue is hidden by this integration package, and neither release branch was changed.

Phase 2 adds contract-level verification for the AI OS `enqueue` port, Marketing `CampaignService` revision mapping, Orbit's draft/review/approval/simulated-execution sequence, restart-safe receipt reconciliation, and the fully wired baseline-adapter system. The adapters remain injected and no baseline release branch, account, deployment, or provider was changed.

Phase 3 local dashboard: 15/15 tests pass, including HTTP-level preparation, edit invalidation, rejection of stale approval, one simulated execution, cancellation, foreign Origin/Host checks, payload limits, and static asset restrictions. Manual browser verification passed preparation, unsaved-edit blocking, save as version 2, approval, and completed simulation. Responsive CSS is implemented; mobile viewport verification remains pending because the connected browser does not expose viewport resizing. All data is fictional and in memory; no real accounts, network providers, deployment, or full baseline-app merge was performed.
