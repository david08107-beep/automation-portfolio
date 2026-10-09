# AI Operations Dashboard / AI OS — v1.2.1-demo

Dave’s operations control center, built as a standalone simulation. Observe multiple processes, inspect the work of each agent, review prepared results, and explicitly authorize local completion. Owner: Dave; avatar: D. Separate from Orbit; its code, demo, tags, and publishing configuration are untouched.

**Fictional data. Deterministic execution. No real AI models, connected accounts, external APIs, sending, scheduling, or record changes.**

## Workplace purpose

AI OS demonstrates how an IT operations lead can coordinate request triage, operational briefs, and project updates in one review workspace. Start with software-request triage: inspect the proposed classification, review budget or security exceptions, edit the recommendation, and explicitly approve the local result. The other processes show how the same control center handles parallel work.

Its intended value is less status chasing and clearer human review. Time savings and recommendation accuracy are not established by this fictional demo. A future pilot should validate review time, accuracy, and missed exceptions using scoped real inputs before connecting services. The portfolio MVP is complete; that pilot is a separate project phase.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
cd ai/ai-operations-dashboard
npm ci
npm run dev
```

Use Vite's printed address on the machine running the app. No public preview has been published. Production output is a static site with relative asset paths:

```sh
npm run build
npm run preview
```

For a single-file demo that needs no server or dependencies once built:

```sh
npm run build:portable
```

Open `dist/ai-os-demo.html` in a modern browser and select **Load demo scenario**. The HTML includes the complete JavaScript and stylesheet and makes no external requests. Browser storage availability for local files varies; the app reports any session-only fallback. The managed cloud browser blocks `file://` navigation, so automated verification serves the exact single-file artifact over loopback HTTP and confirms there are no asset/API requests. Opening directly from disk is not verified in this environment.

## Explore the control center

1. Select **Load demo scenario** to create three fictional processes: a prepared operations brief, an executing project update, and failed software-request triage. It is offered only in an empty workspace and never overwrites existing work.
2. Watch the **agent fleet**: Planner, Analyst, Triage, and Writer. Assignments come directly from running tasks. Each agent runs at most one task; workflows wait for available capacity.
3. Inspect a **workflow** and its plan, task dependencies, progress, and execution timeline. The simulated clock starts or completes work every 1.8 seconds while the page is open.
4. Use the single **Workflows** queue to reach a prepared result or inspect a failure. Failures and older reviews come first; the summary cards filter and open matching work directly. Results are editable. The result or recovery action comes before collapsible plan details, so opening a review does not require scrolling past completed tasks. Confirmation displays the exact edited text and the intended local approval action. Completion requires Dave's explicit confirmation; no external action is offered or performed.
5. **Retry** a failed workflow to resume its failed task. Completed prerequisites are retained, and failed events stay in its history. **Cancel** stops execution and retains any prepared result. Failed downstream tasks are visibly blocked until retry or cancellation.
6. The **task board** tracks work across all processes. Filter by open, running, blocked, completed, or all tasks. Use the **activity stream** for all processes or the selected workflow. **Show older activity** reveals retained events in batches of 60.
7. **System status** distinguishes the local scheduler, available browser storage, actual demo workflow failures, and unconnected AI/integrations. It does not monitor live infrastructure.
8. Create additional workflows using the command input or suggestions. Choose the **Demo process** explicitly or use keyword routing. The planned process is shown before submission. Requests are not interpreted by a language model.
9. Reload to resume unfinished work and return to the selected workflow, filters, and process choice. **Reset demo** requires confirmation and clears only this app's saved workspace.

While awaiting review, **Generate alternative** retains the current exact draft and produces a different deterministic presentation for the same process. **Saved draft versions** shows the original request and process, safely rendered text, and a one-click restore action. Restoring also retains the draft it replaces and restores the process selection; it never approves the result. **Download draft** exports a plain-text file; **Copy draft** reports denied or unavailable clipboard access. These tools are also available for exporting approved results.

There are no goal/tone/profile controls or customer-feedback generation in AI OS. Content is tailored to its selected operational process; Marketing Agent sentiment-response behavior is outside this app’s scope.

The three demo outputs differ: a weekly operations brief, an unsent team-update draft, and a software-request triage recommendation. All underlying records are fictional.

## Structure and extension points

- `src/engine.js`: serializable domain state, process recipes, dependency-aware scheduler, one-task-per-agent capacity, decisions, failure recovery, migration, and input validation.
- `src/storage.js`: browser persistence adapter, best-effort stale-tab write guard, and session-only fallback when storage access fails.
- `src/ui.js`: rendering from domain state; fleet, tasks, decisions, counters, and system status share the same source of truth.
- `src/main.js`: UI events, stable confirmation dialog, edit auditing, focus management, live announcements, and scheduler timer.
- `src/dom.js`: keyed DOM reconciliation that preserves native editor Undo, selection, and scroll positions during background execution.
- `src/style.css`: responsive dark interface and reduced-motion support. No external fonts or image requests.

Browser storage uses `dave-ai-os-v1`, containing version-2 state. Existing version-1 workspaces migrate without replacing approved/edited results. Running task claims are released on reload and reassigned; completed work remains complete. Malformed saved data produces a visible warning and an empty workspace. The original data is not overwritten until a domain change or reset; browsing filters and process choices does not discard an unreadable snapshot. Storage failure is visible and the demo remains usable in session mode.

The state machine and storage adapter are boundaries for a future backend. Selected workflow, filters, process choice, and timeline visibility are saved alongside the domain state as validated view preferences. After an explicit retry, approval, or cancellation, the selected workflow stays visible even if its new status no longer matches the previous filter. The decision queue prioritizes failures, then oldest reviews; completed results offer a direct next-review action without automatic approval.

If another tab saves a change, this tab pauses execution and editing, closes stale approval dialogs, and offers an explicitly confirmed reload. Copy unsaved request text or result edits before reloading. Tabs do not merge or automatically synchronize; the snapshot check is a best-effort browser safeguard, not an atomic transaction. Use one tab for reliable demo operation.

Real execution jobs, authenticated ownership, server persistence, cross-process dependencies, integration health monitoring, and enforceable external-action authorization are **not implemented**. Tasks have dependencies within their own workflows. Browser data is not an authoritative audit log; multiple tabs do not synchronize; execution stops while the page is closed or suspended. Do not enter sensitive information into the demo.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:e2e
# Alternative if Chromium is already installed:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:portable
```

Engine and storage tests cover scheduling capacity, dependencies, distinct outputs, authorization boundaries, cancellation, retry, migration, reload, corrupt data, stale-tab writes, and unavailable storage. Browser journeys run at desktop and mobile sizes, including keyboard dialogs, edited approval previews, concurrent execution, filters, isolation of other projects' storage, whitespace validation, stale-tab reload/approval handling, and automated WCAG AA checks. Automated accessibility checks supplement keyboard and visual inspection; they do not establish full accessibility certification.

To capture actual preview screenshots after building the portable artifact:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/capture-preview.mjs
```

Screenshots are written to `dist/preview-*.png` using the fictional demo scenario.

Dave's [product direction and uploaded video reference](DESIGN_REFERENCE.md) are retained. The recording has not been inspected because it exceeds the environment's 32 MiB transfer limit; no claim of matching its footage is made.

The [final MVP acceptance record](FINAL_REVIEW.md) maps the requirements to verified behavior.

The [IT operations review](OPERATIONS_REVIEW.md) documents the operator journeys, confirmed issues, optimizations, and remaining limits.

## Integration and security foundation

See [INTEGRATION_PLAN.md](INTEGRATION_PLAN.md) for proposed compatible contracts, a single-shell architecture, provider decisions and phased delivery; [THREAT_MODEL.md](THREAT_MODEL.md) for trust boundaries and risks; and [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for executed checks and launch blockers. These are proposals for server capabilities, not implemented authentication or workspace protection.

Restoration now adopts only allowlisted model/view fields, validates workflow references and bounds untrusted payloads. Result editors are limited to 100,000 characters. Confirmation refuses local completion if the draft changed after its preview. Vite and esbuild were updated to address reported development-tool advisories.
