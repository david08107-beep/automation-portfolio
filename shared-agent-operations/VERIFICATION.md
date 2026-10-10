# Verification record — 2026-10-10

## Current review

Light/Dark workflow-theme regression: the reply editor exposed a real CSS
specificity conflict in Light mode—its dialog used the new light surface while
legacy textareas and selects retained dark backgrounds. The shared theme boundary
now covers reply and approval fields, native select options, history and More
menus, task/meeting details, dynamic response editors, close controls, and the
guided tour. Browser and automated verification results are recorded below after
the final run: a fresh Chromium profile passed scripted generate/edit/save,
cancel/reopen, reload persistence, simulated send, duplicate-send prevention,
Personal/Work isolation, approval cancellation, Light/Dark/Auto persistence, and
desktop/mobile layout checks with no console errors. Reply, approval, task,
meeting, and tour surfaces were checked in both Light and Dark. At 390 × 844 the
document and reply dialog had no horizontal overflow. Automated contrast scans
checked 188 visible text/control targets with the reply open in each explicit
theme, with no result below 4.5:1. The complete 104-test suite and command-line
demo passed; the demo
reported `simulated: true` and `externalActions: 0`. Browser resource tracking
recorded zero reply-generation or assistant-query requests, so no model inference
or Ollama allowance was used. JavaScript syntax checks and `git diff --check`
also passed.

V1.7 reply-shortcut maintenance: the message-level AI action no longer assumes
Local AI when only Cloud AI is configured. It opens the shared reply editor,
keeps Scripted selected, lists the enabled provider choices, and makes no provider
request until the user selects a mode and chooses Generate reply. An isolated
Chromium run confirmed zero generation requests from opening the shortcut or
selecting Cloud, then passed scripted edit/save/send, single-execution persistence
after reload, Light/Dark/Auto switching, and Scripted Ask Orbit with no console
errors. The complete 104-test suite and command-line demo passed; the demo reported
`simulated: true` and `externalActions: 0`. No live inference was used.

V1.7 grounded Ask Orbit implementation: 104/104 automated tests pass. New mocked
coverage verifies local structured output, hosted backend authentication, bounded
workspace context, known citations, invalid/extra output rejection with one retry,
prompt-injection separation, missing credentials, authentication/model/rate-limit
errors, timeout/cancellation, credential redaction, Personal/Work separation,
origin enforcement, unchanged workflow persistence, and `canExecute: false`.
`npm run demo` completed with `simulated: true` and `externalActions: 0`; JavaScript
syntax checks and `git diff --check` passed. A local status request confirmed
Scripted as the default with optional providers disabled in this process. Fresh
Chromium QA through the DevTools protocol passed at 1440 × 1000 and 390 × 844:
the response-mode selector and Send control were visible, Work switching and Dark
theme applied, the scripted What changed? request completed, approval boundaries
remained visible, neither viewport had horizontal overflow, and Chromium reported
no page or console errors. One owner-authorized V1.7 acceptance test then used
the backend credential after a read-only balance/model preflight. The stale
configured model was not available, so inference was stopped before use; the
authenticated model list confirmed `gemma4:31b`, included allowance was positive,
and purchased balance was zero. Exactly one bounded Gemma request succeeded on
its first attempt with a validated `task-0` citation, `suggestedView: "tasks"`,
and `canExecute: false`. The included balance changed by approximately `$0.00006`;
purchased balance and purchased spend remained `$0`. Usage aggregation had not
yet posted the request, consistent with Ollama's documented reporting delay. No
deployment, push, approval, or execution occurred. An isolated server status
check with Cloud enabled and `gemma4:31b` then reported Cloud `enabled: true`,
`configured: true`, while preserving `defaultMode: "scripted"`; this status check
made no inference request.

Final no-cost environment check: the running managed environment reported
configuration revision 11, all three Cloud AI backend settings were present, and
the local capability endpoint reported Cloud `enabled: true` and
`configured: true` with Scripted still the default. This check did not list models,
read balances, or make an inference request.

Professional UI and portfolio-readiness pass: the current interface was exercised in Chromium at 1440 × 1000 and 390 × 844. Light, Dark, and system-following Auto modes applied and persisted; Personal/Work switching was repeated twice; the Work-only shadow workspace inherited the theme; scripted reply preparation stayed editable and unsent; draft saving reported browser persistence; and the approval review boundary remained visible. Both viewport widths had no horizontal document overflow, the browser reported no console or page errors, and an automated visible-text contrast scan reported no remaining results below its WCAG AA 4.5:1 threshold. Current screenshots were recaptured from the working application. The full 95-test suite, `npm run demo`, JavaScript syntax checks, and `git diff --check` passed. This is targeted browser evidence, not a full accessibility certification.

Hosted Ollama Cloud implementation: 95/95 automated tests pass, the command-line
demo completes with `simulated: true` and `externalActions: 0`, all edited
JavaScript passes `node --check`, and `git diff --check` passes. New mocked tests
cover explicit cloud opt-in, backend bearer authentication, exact hosted model
configuration, success, invalid/unchanged output, missing credentials,
authentication failure, unavailable models, rate limits, provider outages,
timeout, cancellation, credential/error redaction, Personal workspace context,
HTTP routing, and the existing approval-required boundary. Default startup served
the app with Scripted selected and both AI modes disabled; a credential-free
cloud-opt-in startup reported `AI_CREDENTIALS` without contacting inference.
Read-only access to the current hosted model list at `https://ollama.com/api/tags`
succeeded. A backend API-key binding was later confirmed with the read-only
balance endpoint, without exposing the key: included credits were available and
the purchased-credit balance was zero. The owner then authorized one live test,
but its first adapter attempt failed with `EAI_AGAIN` before reaching Ollama
because Node's built-in `fetch` was not using the managed session proxy. A
read-only model-list check confirmed that `NODE_USE_ENV_PROXY=1` corrects that
environment path. The owner authorized two corrected, single-call acceptance
requests. Ollama recorded exactly two requests totaling 593 input tokens, 131
cached input tokens, 768 output tokens, and `$0.00028` of usage. Both drew from
included free usage while purchased balance remained zero. Each response exhausted
the 384-token cap without passing the strict draft JSON validator, so no draft,
approval, or execution was created. The second request explicitly set the
documented `think: false` option, but `gpt-oss:20b` ignored it and returned 1,930
characters of thinking with no reply content. Read-only hosted metadata explains
why: this model supports only `low`, `medium`, and `high` thinking and defaults to
`medium`. The free-account model `gemma4:31b` supports `false` and defaults to it,
so it is now the recommended compatibility target. One owner-authorized Gemma
request then succeeded on its first provider call: `done_reason` was `stop`, no
thinking text was returned, 46 output tokens produced a valid editable reply,
and the adapter reported `requiresReview: true` in 619 ms. Projecting that exact
body into an isolated reply service created no approval or execution, and direct
execution failed with `APPROVAL_REQUIRED`. Across all three provider requests,
Ollama reported `$0.00034` of usage drawn from included free usage; purchased
balance remained zero. Cloud generation remains disabled after testing.

Environment note: the restricted Windows sandbox rerun could not write temporary history files. The same final suite was rerun outside that sandbox and passed 62/62, including all persistence tests. All package JavaScript also passed syntax checks.

Final 0.4.0 handoff: all 62 tests and the command-line demo pass; the demo reports zero external actions. Browser QA completed the full three-step guided tour: Work daily briefing, review and simulated approval of Sarah's reply, Personal inbox, and Finish & restore progress. The browser reported no console errors during this walkthrough and confirmed original workspace progress was restored. Documentation now leads with the Executive Assistant and explicitly distinguishes the local demo from connected production capabilities. Source publication is on the integration feature branch; no deployment or standalone release update is included.

Header cleanup: removed the redundant workspace dropdown and its menu handlers. Personal/Work buttons drive the existing scoped switch logic directly; guided-demo cues now target those buttons. All 62 tests pass, including an assertion that the dropdown/menu markup is absent. Browser checks confirmed both buttons switch the displayed inbox and context. No data reset or deployment occurred.

Personal/Work distinction: 62/62 automated tests pass, including separate email fixture identities, explicit context purposes, Work-only business gating, and resetting either context without changing the other. On an isolated preview, groceries completed in Personal stayed completed after switching to Work and back/reloading; Work budget completion remained independent. Reset Personal restored its task while preserving the completed Work budget task. A Personal business deep link remained Personal and explained the Work-only boundary. At 390 × 844 both context buttons fit (148px each), and the document had no horizontal overflow. No existing main-preview tasks, replies, approvals, or campaigns were reset or changed by these tests. This is targeted local-demo verification, not real account/security isolation.

Executive Assistant restoration: 58/58 automated tests pass (38 integration/core checks plus the original 20 reply-service checks). The original Orbit app and reply modules are retained from the preserved gh-pages commit. Browser QA on an isolated in-memory server created a campaign, edited its launch post, navigated to the original overview and reply editor, returned with edits intact, saved version 2, approved that version, and recorded one simulated send. Original Work inbox/reply review was functional; no real email was sent. Content Studio at 390 × 844 showed no document or shadow-content horizontal overflow; the viewport was restored. Existing main-preview campaigns remained untouched.

This is targeted verification, not an exhaustive retest of every executive dialog, every AI OS recipe, or full accessibility. The guided tour was subsequently verified in the final handoff above. Executive and campaign approval histories remain separate. Sections below describe earlier iterations.

Unified workspace iteration: 37/37 tests pass, including restoration of Content Studio selection and draft recovery. Browser navigation confirmed Today capability cards, a three-lane workflow board, and the same saved version in Content Studio. At 390 × 844, Workflows and Content Studio had no horizontal overflow; keyboard navigation focused the page heading. These are targeted checks, not a full device audit. Standalone feature sets and release branches remain untouched; no deployment occurred.

An isolated in-memory browser test also passed Content Studio brief submission, edit recovery across navigation to Workflows, saving version 2, exact approval, one simulated completion, and the same read-only edited result when returning to Content Studio. The main preview's eight existing requests and pending decisions were not changed.

36/36 automated tests passed in the working folder and in a source-only copy excluding ignored local history. The command-line demo completed with `externalActions: 0` in both copies. All repository JavaScript passed `node --check`; `git diff --check` passed. New regressions cover split-chunk Unicode requests, inherited-property route rejection, escaped legacy Marketing history, and malformed/unavailable browser storage. Setup instructions, troubleshooting, project status labels, and the interview-first plan were clarified. No existing saved request or hosted release was changed.

Older sections below are historical snapshots, not additional current passes or current setup instructions. The original baseline applications were not re-tested in this review. This is not a production security audit or full accessibility certification; the recording is still outstanding.

## Prior local checks

Recording preparation follow-up: 33/33 tests pass, including a fresh ephemeral-server check of the three showcase assets, their MIME/CSP headers, restricted document/history paths, and an unchanged empty workflow repository after viewing. README now links the showcase and states its local-only limitations. A timed 90-second recording script was prepared; no video was captured because this session exposes no supported recorder and no installed video encoder was found. This check is not a full clean-checkout installation test. No merge, push, deployment, or real external execution occurred.

Interview-readiness follow-up: 32/32 automated tests pass. Browser verification confirmed the skip link focuses main content, keyboard activation of Today focuses the page heading, and the active navigation control exposes aria-current. At a 390 × 844 viewport, Today and My requests had no horizontal document overflow; Today was visually inspected. The viewport was restored afterward. Added responsive wrapping and touch-target adjustments plus an honest interview walkthrough. This is targeted verification, not a complete keyboard, screen-reader, or device audit. No existing request was approved, cancelled, or executed in this follow-up. Changes remain local; no merge, push, or deployment was performed.

Earlier local iteration: 32/32 automated tests passed. Added regression coverage for stale/missing draft-save preconditions, empty/whitespace content at save/approval/execution, explicit unsupported connected-task requests, guided campaign validation/recovery, HTTP brief persistence, and exact-reviewed-version export. Browser checks verified concurrent stale-save rejection with newer content preserved, local edit recovery, empty save rejection, failure priority, capability explanations, structured brief reload/submission, and reviewed export. Copy showed its success message (clipboard readback was unavailable in this browser session); a downloaded text file was inspected and contained the saved version, request, all content assets, and sample-content disclaimer. Export is local-only and does not create a send. Mobile viewport testing was pending at that time; the later targeted checks above supersede that limitation. Complete keyboard/screen-reader testing remains pending. No AI provider, account connection, merge, deployment, or preserved release change occurred.

## Historical baseline checks

The baseline checks in the table below used detached worktrees at the exact source commits listed in the package README. Generated files and test dependencies stayed in those detached verification copies. These results are preserved as historical evidence, not freshly verified in the current file review.

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

Orbit assistant iteration 0.3.1: 24/24 tests passed, superseding the in-memory-only startup behavior above. Recovery tests cover multiple independent request edits, reload, priorities/request notes, view selection, storage failures, malformed entries, and independent browser-tab records. Local history tests cover edited versions across restarts, exact approval after restoration, receipt reconciliation after a failed final save and restart, preservation of an unreadable existing file, and rollback when disk replacement fails. Browser checks confirm that Review next draft opens the expected request, recovery edits survive Refresh/view changes/reload, and recovered edits cannot bypass review. Ask Orbit creates a request in the same review surface. A newly saved version 2 was verified after a real server restart; all six demo requests remained available. The five earlier fictional trial requests were copied into ignored local history before restarting the preview. The standalone demo still reports completion with zero external actions; `git diff --check` passed. Mobile viewport testing remains pending.
