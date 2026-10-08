# Trusted Campaign Service vertical slice

## Original failure causes and scope

The inspected starting point was `dist/app.js`, with UI handlers, `createAssets()`, validation, storage helpers, campaign/history versioning, rendering, and results submission in one browser script. The existing `checks/browser.cjs` passed on that baseline but did not exercise injected write failures, two tabs, or workspace isolation.

| Failure | Exact cause | Repair |
| --- | --- | --- |
| Startup crash | Working-state loader accepted an object containing null tool entries; field loading dereferenced the null entry. | Defensive shape checks for the container, individual briefs, and asset maps; preserve legacy source. |
| Concurrent overwrite | Tabs cached and rewrote the complete shared `ff-working` object and history arrays without concurrency checks. | Per-tab scratch state; campaign persistence moved to SQLite with expected revisions. |
| Partial undo duplicated records | Undo wrote live history and archive history separately; failure of the second storage write left the record in both. | Campaign archive/restore toggles one row in a transaction. Manual results undo remains outside the slice. |
| Failed version reported saved | `saveVersion()` modified the shared in-memory version collection before attempting local persistence; later duplicate detection saw the uncommitted version. | Apply service responses only after commit; preserve retry key after retryable failure. |
| Saved-library edit falsely reported saved | During new browser testing, opening history aliased the editor asset map to the saved snapshot. Editing changed both before comparison. | Clone editable assets and preserve the reopened campaign's grouping key. |

No other repository project was edited. The existing implementation was extracted and adapted, not recreated. Synthetic identities and an actual local server are intentional: untrusted browsers cannot provide a server authorization boundary themselves.

## Files

- `src/domain/contracts.ts`, `validation.ts`: explicit contracts and runtime request validation.
- `src/content/template-generator.ts`: extracted existing deterministic content generation behind `ContentGenerator`.
- `src/application/campaign-service.ts`: DOM-free application operations.
- `src/infrastructure/sqlite-repository.ts`: SQLite transactions, ownership records, sessions, campaigns, versions, idempotency and import journals.
- `src/server/http.ts`, `main.ts`: local authentication, same-origin JSON transport, server-derived actors and static UI delivery.
- `src/ui/app.js`, `campaign-client.js`, `index.html`, `styles.css`: preserved UI adapted to asynchronous service responses, tab-local drafts, synthetic identities and import/conflict notices.
- `tests/campaign-service.test.ts`, `http.test.ts`: 17 tests.
- `checks/browser.cjs`: existing assertions adapted to asynchronous calls and authoritative history.
- `checks/campaign-browser.cjs`: service integration and offline demo checks.
- `scripts/build.mjs`, `browser-check.mjs`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`: reproducible build/test setup and ignored runtime data.
- `dist/app.js`, `index.html`, `styles.css`, `marketing-agent-demo.html`: generated output.
- `README.md`, `CAMPAIGN-SERVICE.md`: operation, migration and milestone documentation.

The entire project was already untracked against this checkout's repository HEAD, so Git cannot provide a meaningful per-file baseline diff for it. `.openai/hosting.json` remains unchanged.

## Architecture and domain contracts

```text
Existing UI → CampaignClient → authenticated HTTP adapter
                              → CampaignService
                              → SQLiteRepository → SQLite
                              → ContentGenerator → existing templates
```

The standalone offline demo selects a separate in-memory preview adapter and labels its weaker guarantees. The transactional app never falls back silently to browser history when the server is unavailable.

- **Campaign**: stable ID, owned workspace, kind, validated brief, profile snapshot, revision, archived flag, creator and timestamps, versions.
- **CampaignVersion**: stable ID, parent campaign ID, independent revision, named string assets, template selection, label, creator and timestamps.
- **Workspace**: ID, owner actor ID, display name. Database ownership is authoritative.
- **Actor**: ID and name. HTTP derives it from a valid, unexpired opaque session. Internal callers must supply a trusted authenticated context; accepting client-supplied ActorContext would defeat authorization.
- **Result**: explicit future contract for manual business outcomes. Not a service execution result and not migrated to server storage in this slice.
- **Revision**: validated positive safe integer. Campaign revision advances for any campaign/version mutation; version revision advances for an in-place version update.
- **StructuredError**: code, user-facing message, retryability, optional conflict details. `ServiceResult<T>` is an explicit success/value or failure/error union.

Operations are `createCampaign`, `getCampaign`, `listCampaigns`, `saveCampaignVersion`, `updateCampaignVersion`, `archiveCampaign`, `restoreCampaign`, and `importHistory`. They accept validated structured input and explicit actor/workspace context, never DOM elements. Archived campaigns reject edits until restored.

SQLite uses foreign keys, WAL, a busy timeout, UUID IDs and unique constraints. Each operation authorizes inside a transaction. Writes use `BEGIN IMMEDIATE`, compare expected revisions, and store an actor/workspace-scoped idempotency response with the domain changes. In-place version updates check both campaign and version revisions. Reusing a key for another normalized request gives `IDEMPOTENCY_CONFLICT`. Exact committed retries replay the original response even if later edits have advanced the campaign. Save of identical content adds no version. Persistence exceptions return a retryable error; failed transactions retain no success ledger entry.

## Migration behavior and risks

The HTTP importer accepts at most 2,000 records per batch and the transport caps JSON at 5 MB. Every record is validated before writes; `pack` and `calendar` map to `campaign`. Malformed records, dates, asset maps, versions, and IDs receive indexed structured errors. Stable available campaign and version IDs survive; missing campaign IDs use a content fingerprint. ID collisions are reported without replacement. Distinct current assets absent from older snapshots are preserved as an additional imported version. Archives retain their archived flag.

Valid records and their fingerprint tracking, complete submitted source and report, and idempotency response commit atomically. A database failure aborts the whole batch; record validation errors allow a partial-valid import with explicit rejection reporting. Original browser active/archive history remains untouched and exportable, including malformed JSON. Successful legacy working-state recovery copies into tab storage without rewriting the legacy source.

Changed legacy records with an already imported stable ID are reported as conflicts instead of merged. Invalid legacy IDs cannot be preserved. Server imports normalize timestamps and some legacy labels/defaults, while original source remains retained for recovery. There is no automatic deletion, eviction, or background import worker.

## Verification

`npm run check` runs:

1. Strict TypeScript: passed.
2. Production server/frontend/standalone demo build: passed.
3. Service/persistence/HTTP tests: 17 passed, zero failures.
4. Existing browser suite: passed, including grouped templates, edited versions, recovery, campaign assets, customer care, archive/restore, safe rendering, legacy import, exports, manual results, currency separation and six viewport widths.
5. New browser suite: passed for malformed startup/import, committed response loss and safe retry, failed-save recovery, concurrent stale edit rejection with local edits retained, independent tab briefs and reloads, workspace isolation, reopened template alternatives, and labeled offline demo.

Failure tests inject an exception immediately before transaction commit and inspect the database, then retry. Persistence tests open multiple database connections and reopen the file. HTTP tests check missing/forged/expired sessions, credentials, cross-origin writes, client actor spoofing, client workspace validation, and concurrent requests. Browser tests intercept failed responses both before a write and after server commit. Temporary test databases are isolated and cleaned up. No lint configuration is present.

## Remaining risks and future tool-boundary readiness

The campaign service meets the local vertical-slice guarantees. It is suitable as the application-service foundation for a future authorized Campaign tool after that caller supplies a trusted identity and workspace. No authorized agent tool or shared operations layer was implemented.

It is **not ready for production or real users**: fixture credentials are deliberately public, local cookies are not a deployed TLS/authentication design, and the loopback server needs persistent hosted storage, backup/restore procedures, account provisioning, and a production session lifecycle. The server uses synchronous SQLite suitable for this local slice; production throughput and retention of idempotency/import journals remain undecided. Restoring a backup must preserve ledger and domain records together.

Browser profile/preferences/results remain local, readable by scripts on that origin, and have their prior non-transactional limitations. Draft session storage is not durable after closing a browser session. Idempotency keys retained by the browser client are in memory; an ambiguous request followed by a process/tab loss requires refresh/reconciliation or caller reuse of the original key. Server replay guarantees themselves survive restart. Switching fixture identities changes the shared same-origin cookie, so other open tabs may need to sign in again; ownership enforcement still denies their stale workspace context.

The preserved Site configuration serves static assets only. Publishing the authenticated app requires a deliberate backend deployment design; the existing Site ID is retained and no publication occurred. No model, connector, autonomous publisher, OAuth, routing, agent tools, approvals or workers were added.
