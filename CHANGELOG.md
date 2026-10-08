# Changelog

Release milestones describe the implemented capability baseline and current development scope. Historical entries are reconstructed from the existing application; no release dates, published packages, or Git tags are implied. The current identifier is `1.5.0`, within **V1 — Portfolio Prototype**. All account data is fictional and all external-impact actions are simulations.

## V1 maintenance — Guided portfolio walkthrough

- Added Try Orbit with daily briefing, edited explicit demo reply, and Personal inbox handoff.
- Isolated tour changes in memory; Finish, Exit, or refresh restores saved progress.
- Added accessible step controls and an exit inside the reply dialog; preserved the existing release identifier.

## V1 maintenance — Decision-ready CEO workflow

- Added actionable command-response cards for inbox, tasks, meetings, and prepared decisions.
- Added inline reminder/task editing, immediate Undo, and persistent reopening of handled messages without unsending or overwriting later task decisions.
- Returned dialog focus to the initiating response and preserved editor drafts during local updates.
- Unified overdue-task priority and honest deferred/declined/quiet-workspace summaries.
- Linked existing related tasks instead of encouraging duplicate work; reduced simulated processing delays while retaining agent orchestration.
- Clarified typed-command execution limits and paused monitoring; preserved explicit demo confirmations, isolated workspace state, and Reset.

## V1 maintenance — Interactive meeting briefs

- Added accessible meeting-detail panels for all scheduled Personal/Work meetings and local calendar entries.
- Included fictional agendas/attendees, existing schedule facts, state-aware Orbit preparation notes, and suggested focus.
- Made the separate Friday proposal reviewable without changing today’s schedule or attaching it to unrelated meetings.
- Linked proposal details to explicit calendar review and returned to the meeting panel after cancellation or decision.
- Preserved scheduling persistence, decline/defer/restore, workspace isolation, keyboard/reduced-motion behavior, and demo-only execution.

## V1 maintenance — Full task-list review

- Replaced task-action scroll jumps with an accessible full task-list dialog that highlights the selected task.
- Added All/Open/Due today/Completed filters, completion/reopening, and active-workspace local task inclusion.
- Added full-list entry points to On your radar and task-command responses; sidebar navigation remains unchanged.
- Preserved workspace-specific task persistence, counters, attention, and Reset demo.

## V1 maintenance — CEO workflow refinement

- Unified overview and command briefing priorities.
- Moved commands below the greeting and the workspace switcher into the persistent header.
- Collapsed supporting recaps, preparation facts, and repeated recommendations; added contextual response actions.
- Kept one visible review entry per approval and explicit final execution inside review.
- Added persistent Not needed, timed Defer, and Restore to attention for calendar/document suggestions; these outcomes never imply execution.
- Added editable title/owner/deadline for created tasks and future times for reminders/snooze.
- Compacted document reviews with expandable supporting details and sticky final controls.
- Kept the existing V1 release identifier; no real services or V2 features were introduced.

## v1.5 — Collapsible Navigation

Status: Completed — `1.5.0` (explicitly requested V1 refinement; acceptance criteria passed)

### Added

- Expanded, compact icon-rail, and fully hidden desktop/tablet sidebar states.
- Header toggle cycling Expanded → Compact → Hidden → Expanded, with action-specific accessible labels.
- Compact hover/focus tooltips and persistent active navigation highlighting.
- Independent `orbitSidebarState` browser preference, preserved across refresh, workspace changes, and Reset Demo.
- Native mobile drawer at 650px and below with workspace/status controls, focus containment, Escape/close/backdrop/destination dismissal, and focus return.
- Restrained collapse/content/drawer transitions with reduced-motion support and compact/mobile screenshots.

### Changed

- Main content expands when navigation is reduced; the sticky header keeps its restore/menu button reachable.
- Hash navigation from dashboard links synchronizes the active section.
- Mobile navigation uses an overlay rather than permanently occupying page space; desktop preference returns after resizing.

### Fixed

- Removed unnecessary permanent sidebar space for users preferring a wider workspace.
- Testing found compact tooltips did not appear for every focus path; they now respond to focus as well as hover.
- Adjusted anchor spacing so sticky navigation controls do not cover destination headings.
- Kept hidden controls inert and mobile closing/resizing from losing keyboard focus.

### Still Simulated

- No change to integrations. Email, calendar, sharing, provider permissions, agent reasoning, and background monitoring remain fictional/local simulations; no external services were connected.

### Validation

- All 17 requested navigation checks passed on index.html and preview.html, including five viewport widths, all desktop modes, preference/reset independence, workspace switching, compact navigation/tooltips, drawer dismissal/focus, resize restoration, reduced motion, no horizontal overflow, and no console errors/warnings.
- Supplemental checks passed for hidden-mode content/hash navigation and sticky restoration, mobile approvals/commands, and blocked-storage controls.
- Existing inbox and document-sharing acceptance flows were rerun with test helpers updated for the intentional mobile drawer pattern. See QA.md.

## v1.4 — Document Sharing & Delivery Context

Status: Completed — `1.4.0` (explicitly requested V1 extension; acceptance criteria passed)

### Added

- Contextual document card with recipient, delivery, and access overview and Review & Share entry action.
- Filename/title/PDF type, fictional Orbit Demo Drive source, actual prepared text preview, and Orbit preparation rationale.
- Workspace-specific recipient names and reserved demo email addresses.
- Email with cloud link, Email attachment, and Copy share link demo delivery options.
- View only, Can comment, and Can edit intended-access choices.
- Directly editable accompanying message, whole-payload Save Draft, and live What/Who/How/Access/Message summary.
- Compact Shared history with Eastern timestamp, recipients, delivery, access, and simulation status.
- Workspace-isolated full share payload persistence, reset restoration, and desktop/mobile captures.

### Changed

- Generic sharing review now explains destination, delivery, permissions, and prepared work before explicit Share Document confirmation.
- Confirmation updates attention, counts, briefing, and activity; completed reviews are immutable and duplicate execution is disabled.
- Document secondary action is Save Draft; the message is immediately editable.
- Explicitly requested V1.4 extends the prior V1 lock; product phase remains V1 and next major milestone remains v2.0 Hosted Web App.

### Fixed

- Unclear share destination/process now has visible context and an accurate final summary.
- Earlier message-only share history clearly labels unrecorded recipient/delivery/access details rather than inventing them.
- Testing exposed a recipient-list flex rule overriding its hidden flag; explicit hidden styles prevent suggested recipients from appearing as historical delivery details.
- Delivery notes clarify attachment permission limitations and copy-link simulation semantics.

### Still Simulated

- Cloud storage, PDF generation/upload, cloud share links, and clipboard-link generation.
- Email delivery, provider permissions, and external recipient delivery.
- Google Drive, OneDrive/SharePoint, Gmail, Outlook/Microsoft Graph integrations are future V3 work.

### Validation

- All 17 requested steps on index.html and preview.html: inspect context, edit/access/delivery, save/reopen, confirm Shared/history/attention/activity, refresh, independent workspaces, Reset Demo, no major console errors.
- Extra checks: Cancel and duplicate-save behavior, all delivery/access options, immutable completed review, 1440/768/390/320 layouts, Tab/Shift+Tab/Escape/focus return, older execution/draft migration, oversized-message validation, and blocked-storage session sharing.
- Existing inbox and approval/command/proactive regression suites passed. No external network requests or browser errors/warnings occurred in the main sharing acceptance flows.

## v1.3 — Interactive Inbox and Orbit Drafts

Status: Completed — `1.3.0` (V1 portfolio prototype; acceptance checks passed)

### Added

- Full message detail dialogs with sender, subject, received time, body, priority/state, Orbit summary, and recommendation.
- Reply composer, actual editable Orbit drafts, Edit Draft, Save Draft, and explicit simulated Send Reply.
- New, Important, Draft Ready, Draft Saved, Replied, Handled, Snoozed, and Reminder Created states.
- Contextual appointment/calendar actions, bill reminders/handling, reversible Snooze, work task creation, and follow-ups.
- Local artifacts visible in inbox and the appropriate calendar/task sections; local task/follow-up completion and counts.
- Workspace-specific message/draft/artifact/activity persistence and full Reset Demo restoration.
- Keyboard row activation, native accessible modal interactions, responsive layouts, and screenshots.
- Release tracking through `VERSION`, minor-release roadmap, and future implementation prompt guidance.

### Changed

- Priority Inbox now holds underlying messages and communication actions; Needs Your Attention remains a concise judgment queue.
- Pending email approval reviews open the relevant inbox composer, sharing the existing execution state and preventing duplicate sends.
- Confirmed replies update message state, attention, counters, activity, and briefing; the Personal lunch reply completes its linked task.
- Mark Handled resolves a local decision without manufacturing a Sent record; monitoring and recap respect that distinction.
- Release identifier advanced from `1.3.0-dev` to `1.3.0` after acceptance validation. The major phase remains V1.

### Fixed

- Testing found Edit Draft missing immediately after Save Draft in an already-open message; the control now appears without closing/reopening.
- Future calendar artifacts no longer increase today’s meeting count.
- Repeated saves and duplicate contextual artifact creation no longer add redundant events/records.
- Handled messages no longer trigger stale reply requests, and appointment/bill rows hide irrelevant reply controls.
- Read flags survive refresh alongside message states and drafts.

- Release-readiness audit preserved approved email recipient/subject metadata during reload and aligned normalization/composer limits at 10,000 characters; long replies retain their exact execution record.
- Inbox groups now contain native action buttons without nested button roles.
- Shared dialog focus containment prevents Tab/Shift+Tab from leaving either overlay.
- Enter in reply metadata fields cannot implicitly send, and saving cannot mutate a resolved message.
- Empty approval summaries accurately report locally handled messages without claiming a sent email.
- One shared reply-limit constant prevents future drift between state validation and composers.

### Still Simulated

- Email delivery and external inbox connections.
- Real reminders, notifications, calendar updates, and task-platform records; artifacts stay local.
- Background monitoring and real AI reasoning/research/draft generation.

### Validation

- Main page and self-contained preview: Alex open/draft/edit/save/reopen/send, reply and attention/count sync, appointment reminder/calendar creation, bill handling, refresh, workspace separation, reset, keyboard and modal layouts at 1440/768/390/320 pixels.
- Regression: blank reply validation, Cancel/retained saved draft, repeated-save prevention, Handled versus Sent, reversible/persisted Snooze, calendar/document execution, seven command cases, six automatic proactive signals, reduced motion, and blocked-storage session fallback.
- No browser page errors or external network requests in the regression flows. Details and limits are documented in `QA.md`.

### V1 release lock

- **READY FOR V2:** V1 release-readiness criteria passed after audit → test → fix → retest → document.
- `VERSION` remains `1.3.0`. Future feature development targets v2.0 Hosted Web App; no V2 code was implemented.
- Final validation includes all nine required commands plus unsupported requests in both workspaces on both entry pages (40 command cases), exact sequential specialist activation, 10,000-character draft/send persistence with exact recipient/subject/body, keyboard containment/return, navigation and modal actions at three widths, reset/isolation, malformed-storage recovery, and legacy business-state migration. See `QA.md` for full scope and limitations.

## v1.2 — Contextual Approvals and Action Workflows

Status: Completed (implemented capability milestone)

### Added

- Contextual Send Email, Approve & Reschedule, and Share Document confirmation actions.
- Email review with editable body and Save Draft; calendar time editing/validation; document message editing.
- Contextual local task completion/reopening.
- Simulated execution confirmations, exact saved execution payloads, activity updates, and persistent workspace-specific approval state.
- Reviewable completed actions with duplicate execution disabled.

### Changed

- Generic approval behavior became prepare → review/edit → explicit execution.
- Approval counts and attention summaries reflect completed decisions; completed records remain in history.

### Fixed

- Avoided double-counting the Personal lunch email and its linked follow-up task; explicitly sending the demo reply completes the linked local task.
- Preserved saved drafts and keyboard focus during background updates; completed actions leave the attention queue.

### Still Simulated

- Email sending, meeting rescheduling, attendee notifications, and document sharing; no external records are modified.

## v1.1 — Proactive Assistant Experience

Status: Completed (implemented capability milestone)

### Added

- Executive briefing, Since Your Last Check, Needs Your Attention, Orbit Already Handled, and focused recommendations.
- Interruption prioritization and six fictional proactive event scenarios per workspace.
- Local monitoring simulation with pause/resume, manual signal replay, specialist activation, and execution timeline.
- “What did you handle?” command and workspace-specific monitoring progress/persistence.

### Changed

- Assistant-led copy and priorities lead the page; supporting metrics, orchestration, and detailed history have reduced dashboard emphasis.
- Urgent tasks and explicit decisions are separated from informational preparation and lower-priority messages.

### Fixed

- Rechecked task state before escalation to prevent stale deadline alerts.
- Canceled interrupted/superseded workflows and old workspace callbacks to prevent mixed-context results.
- Kept informational updates quiet and prevented background preparation from taking focus or replacing command responses.

### Still Simulated

- Proactive monitoring is a bounded browser-timer scenario, not real account polling or a persistent background service.
- Agent understanding, prioritization, and preparation use deterministic local rules and fictional fixtures.

## v1.0 — Initial Portfolio Prototype

Status: Completed (implemented capability milestone)

### Added

- Orbit branding and premium responsive dashboard UI.
- Personal Workspace and Work Workspace with separate fictional inbox, calendar, tasks, approvals, and activity.
- AI Operations visualization with Inbox, Calendar, Task, Research, and Approval specialists.
- Command center with simulated intent routing.
- Browser localStorage, Reset Demo, workspace switching, and keyboard/reduced-motion support.

### Changed

- Established the baseline product experience; no earlier published release is asserted.

### Fixed

- No separately verified historical bugfix release is claimed for this baseline.

### Still Simulated

- All assistant intelligence, specialist orchestration, account events, and external outcomes. No real integrations or production infrastructure.

## Future major milestones

| Release | Name | Status | Completion boundary |
| --- | --- | --- | --- |
| v2.0 | Hosted Web App | Planned | Public hosted application, routing, backend/API foundation, server persistence, applicable authentication/sessions, deployment/environment configuration, logging, and audit history; integrations may stay simulated |
| v3.0 | Connected AI Assistant | Future | At least one authenticated external service working end-to-end with scoped permissions and explicitly approved actions; connection health, audit, retry/failure handling |
| v4.0 | Installable App | Future | Verified PWA installation first; desktop wrapper and mobile-specific experience only if useful/justified |

The detailed provider and infrastructure scope, acceptance gates, real/simulated boundaries, and versioning rules are maintained in [README.md](README.md). Each version should be considered complete before the next version begins.
