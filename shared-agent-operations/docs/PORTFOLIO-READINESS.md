# Orbit portfolio readiness

> Living status record — 2026-10-10. Orbit is actively being developed. This document tracks evidence and gaps; it does not declare the project finished.

## Employer-facing snapshot

**Problem:** assistants and automation demos can obscure what changed, what was approved, and whether an external action actually occurred.

**Current solution:** Orbit keeps fictional requests, editable drafts, explicit decisions, version-specific approvals, local persistence, and simulated receipts in one review-first interface. Personal and Work contexts remain separate. Scripted output is the default; optional Ollama adapters can prepare inbox reply drafts and grounded workspace answers without approving, sending, or invoking tools.

**Technology:** dependency-free Node.js HTTP server, vanilla JavaScript, HTML/CSS, browser local storage, JSON file persistence, Node's built-in test runner, optional local Ollama HTTP API, and optional Ollama hosted API through backend-only credentials.

**What works now:**

- Responsive Executive Assistant UI with persistent Light, Dark, and Auto appearance modes.
- Separate fictional Personal and Work inbox, calendar, task, and workspace state.
- Work-only campaign workflows and Content Studio with immutable saved versions.
- Explicit review, approval expiry/invalidation, and idempotent simulated execution.
- Browser draft recovery and restart-safe server history.
- Scripted generation by default, plus opt-in Local AI and Cloud AI reply drafting and grounded Ask Orbit answers.
- Bounded inputs and outputs, cancellation, timeouts, provider-error redaction, conservative decline checks, and no silent provider fallback.

**Stable for the current demo scope:** generation, local persistence, approval
boundaries, and provider-error handling pass the 104-test regression suite. Cloud
generation remains optional and explicitly configured; Scripted remains the
default. This is a readiness statement for the fictional single-owner demo, not a
production-readiness claim.

**Current presentation layer:** the local `/showcase` route provides an
eight-decision engineering case study with Light, Dark, and Auto themes. It
connects the product problem to the generation boundary, grounding, review
safety, failure handling, test evidence, and an honest viability assessment.

**Remaining release hygiene:** capture a short screen recording and repeat the
published instructions from a clean checkout on a separate machine. Broader
accessibility testing and additional owner-authorized hosted-model compatibility
evidence remain optional follow-up work.

**Business value hypothesis:** the same review-first pattern could reduce ambiguity and duplicate execution in assistant workflows. No customer outcome, time-saving metric, or production usage has been measured.

## Skills demonstrated by current evidence

- State-machine and workflow design.
- Immutable versioning, optimistic concurrency, and idempotency.
- Browser and file persistence with recovery/failure handling.
- Server-side provider abstraction and credential isolation.
- Defensive validation, cancellation, timeout, and redacted error design.
- Responsive interface design, theme systems, and progressive enhancement.
- Automated unit, integration, HTTP, and mocked provider testing.
- Honest product boundaries and technical documentation.

## Evidence available

- Current screenshots: [overview](../screenshots/orbit-overview.png), [Personal dark theme](../screenshots/orbit-personal.png), and [Work light theme](../screenshots/orbit-work.png).
- Reproducible commands: `npm test` and `npm run demo`.
- Detailed current and historical results: [VERIFICATION.md](../VERIFICATION.md).
- Interview walkthrough: [SHOWCASE.md](../SHOWCASE.md) and [EMPLOYER-DEMO.md](../EMPLOYER-DEMO.md).
- AI configuration and safety boundary: [OPTIONAL-AI.md](../OPTIONAL-AI.md).

## Evidence still needed

- A short screen recording of the current Light/Dark UI and one complete review flow.
- A clean-checkout run on a separate machine using only the published instructions.
- Broader keyboard, screen-reader, zoom, and multiple-browser checks.
- Repeatable performance measurements if performance claims are ever desired.
- A public interactive preview only after hosting, authentication, storage, and secret-handling decisions are explicitly approved.
- Additional owner-authorized live hosted-model checks only when needed; mocked tests remain the normal regression path.

## Potential resume material — draft only

These are evidence-backed themes to refine later, not final resume claims:

- Built a dependency-free Node.js and vanilla JavaScript assistant prototype with exact-version review, approval invalidation, local recovery, and idempotent simulated execution.
- Added optional local and hosted Ollama reply drafting behind a server-side adapter with explicit opt-in, bounded generation, cancellation, timeouts, credential redaction, and approval safeguards.
- Maintained a 104-test regression suite covering workflows, grounded-answer validation, persistence failures, provider failures, workspace separation, and review boundaries.

Do not add customer impact, production scale, percentage improvements, or time savings unless independently measured.

## Cleanup candidates requiring review

- `executive/app.js` and `executive/styles.css` are large and could eventually be split by feature. That is a higher-risk refactor and should not be combined with active feature work without dedicated regression coverage.
- Current documentation contains valuable historical verification snapshots. Consolidate or archive them only after preserving provenance and updating incoming links.
- `executive/package.json` intentionally marks the retained reply-service area as CommonJS; it is not an abandoned duplicate of the root package manifest.
- Executive browser history and campaign server history remain separate by design. Unifying them is an architectural migration, not file cleanup.

## Current risks and boundaries

- Single-owner fictional demo; no production authentication or tenant isolation.
- Local plaintext history; no shared database, backup, or retention policy.
- No connected email, calendar, social, or publishing account.
- AI output is untrusted draft text and always requires review.
- Localhost is not a public recruiter link and may not be reachable from managed cloud preview browsers.
- Current development changes are not evidence of deployment or publication until reviewed and pushed separately.
