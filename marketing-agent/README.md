# Marketing Agent — AI Workspace

The existing dog-care marketing dashboard now uses a local Campaign Service for campaign creation, version saves, archive, restore, and history import. The charcoal/blue UI, deterministic brand-aware templates, campaign assets, customer-care workflows, manual results, and exports remain.

## Run the transactional app

Requires Node 24 or newer (built-in SQLite).

```bash
npm ci --cache .cache/npm
npm run build
npm start
```

Open `http://127.0.0.1:3003`. `PORT` changes the port; `CAMPAIGN_DB` changes the SQLite path (default `.data/campaigns.sqlite`). Run commands from this folder. The server binds to localhost.

The app automatically signs into synthetic Alice. The header can switch between synthetic Alice and Bob, each with a separate owned workspace. The fixture credentials are `alice` / `local-alice` and `bob` / `local-bob`. These credentials are public, intentionally synthetic, and **unsuitable for real users or public deployment**. Session cookies are opaque, HttpOnly, and SameSite Strict. The server derives the actor from the session and independently verifies workspace ownership.

`marketing-agent-demo.html` is a standalone, labeled **offline preview** with in-memory campaigns. It demonstrates the same templates and interface; it does not provide authenticated persistence. Serving `dist/` alone does not provide the Campaign Service.

## Verification

```bash
npm run check
```

This runs strict TypeScript checking, the production build, 17 service/persistence/HTTP tests, the existing browser regression suite, the new Campaign Service browser suite, and the standalone demo check. Browser checks start their own server and temporary SQLite database, then clean up. They require Chromium at `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. To run the original suite against a running server, use `APP_URL=http://127.0.0.1:3003 node checks/browser.cjs` with a fresh test database.

No lint command is configured. `npm test` runs compiled tests; build first after changing TypeScript.

## Campaign data and recovery

Campaigns and versions are authoritative in SQLite. Every write validates its input, checks ownership and expected revisions, and commits the domain changes and idempotency response in one transaction. The browser updates saved state only after success. Retries with the same key and request replay the original response; changing the request with that key is rejected. Stale saves retain the user's edit and ask them to inspect the latest library entry. Archive and restore change one campaign flag atomically rather than moving records between storage keys.

Uncommitted editor drafts use per-tab, per-workspace `sessionStorage`, preventing tabs from overwriting one shared working object. Reloading the same tab recovers its draft. Closing the session can lose uncommitted drafts: use **Save version** or export them. Saved-version objects and editable assets use separate copies.

Legacy `ff-history` and `ff-archived-history` are imported into Alice's synthetic workspace on startup. Valid campaign and version identifiers are preserved where available. Records without campaign IDs get stable fingerprint IDs. Malformed records and conflicting IDs produce explicit reports; they do not overwrite existing campaigns. Valid records can import while malformed records are reported. The original browser keys are never deleted or rewritten. A migration notice offers an export containing the original raw strings, including malformed JSON. Submitted records and import reports are also journaled in SQLite. Repeated imports do not duplicate the same record. Another browser/device must export its history and submit it separately; this is not a cloud synchronization system.

Profiles, currency preferences, and manual results remain browser-local and are outside this transactional slice. Their browser caches are workspace-scoped for demo convenience, not server-enforced security. Existing Alice profile/results can read the original keys. Manual results still have local-storage concurrency and multi-key undo limitations; do not treat them as an authoritative financial ledger. Results track manual inquiries, bookings, booked value, completed-sale revenue and spend, not measured attribution or profit. Currency selection filters rather than converts amounts.

## Content and scope

`ContentGenerator` wraps the existing two-alternative template generator. No AI model, provider connector, publishing automation, OAuth, routing, agent tools, approval engine, or background workflow was added. Templates still require factual briefs and human review, especially for serious customer concerns. Campaign generation includes strategy, a launch post, three scripts and captions, filming notes, and a seven-day calendar. Copy and campaign/CSV exports remain available.

## Hosting and future integration

The existing Site project ID in `.openai/hosting.json` is unchanged. Its static hosting setting cannot run this new Node/SQLite backend. A persistent server deployment and production authentication design must precede publication of the transactional app. Nothing was published, and no new Site was created.

The DOM-free service is a tested candidate for a future authorized Campaign tool boundary. It is not yet a production authorization boundary for the shared Agent Operations Layer. This milestone stops here. See [CAMPAIGN-SERVICE.md](CAMPAIGN-SERVICE.md) for the architecture, original failure causes, and verification report, and [BUSINESS-REVIEW.md](BUSINESS-REVIEW.md) for the earlier workflow review.
