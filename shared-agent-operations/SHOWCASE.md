# Orbit: interview showcase

Orbit is a local, review-first workflow prototype. It brings a campaign request, editable drafts, approval, simulated execution, and history into one workspace.

The original Orbit Executive Assistant is the main interface again. Its briefing, inbox, calendar, tasks, document review, and Personal/Work spaces remain. Workflows and Content Studio are additional navigation destinations. Campaign views share campaign records; executive decisions retain their independent browser-local history. See the package README for the exact integration boundaries.

The strongest part to demonstrate is the workflow engineering, not model novelty. Marketing output is fixed fictional sample content. Inbox, calendar, social, and publishing accounts are not connected. Optional Ollama adapters can prepare editable inbox reply drafts when explicitly enabled; they do not approve or send.

## Three-minute walkthrough

1. Start with `npm start` in `shared-agent-operations` using Node.js 20 or newer. Open `http://127.0.0.1:4317/`. This address works on your computer; it is not a public recruiter link.
2. Show the original executive briefing and inbox reply review first. Then open Content Studio and enter a fictional campaign brief: dog-training classes, local dog owners, Instagram, friendly tone, encourage enquiries. Select Ask Orbit. Explain that the brief is retained, but the generated assets remain fixed demo fixtures.
3. Open the draft. Edit the launch text to match that brief and save it. Show the new saved version.
4. Approve that exact saved version. Copy or download the reviewed draft. The export includes the request, content, version, and sample-content disclaimer.
5. Optionally run the simulated execution. Show its receipt and Activity. Nothing is posted or sent externally.
6. Reload to show saved history. Explain that browser scratch edits and authoritative saved versions are separate.

For a safety demonstration, make an unsaved edit and show that it cannot be treated as approved content. Do not approve unrelated existing requests or clear the user's history.

## What this demonstrates

- A usable front door for requests and decisions, rather than separate disconnected tools.
- Exact-version review: changes invalidate earlier approval.
- Optimistic concurrency: an older browser tab cannot silently overwrite a newer saved draft.
- Recoverable browser edits and persistent local workflow history.
- Idempotent simulated receipts and restart reconciliation.
- Server validation, loopback/same-origin checks, bounded payloads, and restricted static assets.
- Automated workflow, persistence, HTTP, recovery, campaign-brief, and export tests.

The flow is: Orbit interface → shared workflow core → injected sample adapters → version-specific approval → simulated receipt or local export. This integrates workflow contracts; it does not merge every baseline application into one production product.

## Interview explanation

“I built a review-first automation prototype with AI coding assistance. It keeps the request, draft versions, approval, and execution history together. My focus was preventing lost edits, stale approvals, and duplicate execution. I can walk through the implementation and tests. The current marketing generator is deliberately simulated; production AI and account integrations are future work.”

Discuss the code and tradeoffs you understand. Do not claim real customers, measured time savings, independent authorship, production AI, or connected-account capability without evidence.

## Limits and next steps

This is a single-owner local demo, not a production multi-user service. Local history is plaintext; use fictional data. It has no production authentication, public hosting, connected-account automation, or external publishing. Optional AI produces drafts behind the same review boundary. Browser checks are targeted usability checks, not a full accessibility certification.

Before public sharing: review the branch, verify the demo from a clean checkout, choose a safe hosting approach, remove private/demo history from any distributable artifact, and explicitly authorize publishing. A local walkthrough or screen recording can be used without introducing account integrations.
