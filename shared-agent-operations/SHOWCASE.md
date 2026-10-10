# Orbit: engineering case study

Orbit is a local, review-first Executive Assistant prototype. The working app is
the product demonstration; `/showcase` is the employer-facing explanation of
the engineering and product decisions behind it.

The strongest story is not model novelty. It is the boundary between AI-assisted
preparation and owner-controlled decisions: generated replies remain editable,
saved versions are explicit, approvals bind to exact content, duplicate
execution is prevented, and every external action remains simulated.

## Open the case study

1. From `shared-agent-operations`, run `npm start` with Node.js 20 or newer.
2. Open `http://127.0.0.1:4317/showcase` on that computer.
3. Use Next, Previous, the Left/Right arrow keys, or Home/End to navigate.
4. Check Light, Dark, and Auto. The same saved appearance is shared with Orbit.
5. Select **Open app** to inspect the working fictional workflow.

No account, package installation, model download, or API key is required. The
address is local and cannot be sent to a recruiter as a public link.

## Eight-decision interview story

1. **Problem:** AI automation becomes risky when decisions and evidence vanish
   inside a response.
2. **Experience:** one Personal/Work workspace turns scattered requests into a
   visible decision queue.
3. **Generation:** Scripted remains the default; Local AI and Cloud AI are
   explicit, replaceable options behind one server boundary.
4. **Grounding:** generated workspace answers cite only validated fictional fact
   IDs and cannot invoke tools.
5. **Review:** replies move through generate, edit, save, review, and explicit
   confirmation; generation never authorizes sending.
6. **Reliability:** versioning, stale-state checks, idempotency, and receipt
   reconciliation protect failure paths.
7. **Evidence:** the current test suite and demo verify these boundaries without
   live inference or external actions.
8. **Viability:** the pattern is useful, but a business still needs customer
   discovery, pricing evidence, production identity, storage, and integrations.

The page supplies a concise “What to say” prompt for each decision. Use those as
talking points, not a script to memorize.

## Working-app demonstration

After the case study, open Orbit and show one complete reply flow: switch to the
Work inbox, open a message, generate or keep the Scripted draft, edit it, save the
draft, choose Send Reply, inspect the exact confirmation, and confirm the
simulated action. Then switch to Personal to demonstrate context separation.

For the deeper workflow example, open Content Studio, prepare a fictional
campaign, edit and save a new version, approve that exact version, and optionally
run simulated execution. A later edit invalidates the earlier approval; an old
tab cannot overwrite the latest saved version.

## Claims supported by the repository

- Review-first state transitions and exact-version approval.
- Optimistic concurrency and duplicate-execution prevention.
- Browser draft recovery and restart-safe local workflow history.
- Server-side Local/Cloud provider abstraction with backend-only credentials.
- Structured validation, bounded input/output, cancellation, timeout, and
  redacted provider errors.
- Responsive Light/Dark/Auto interface and targeted browser checks.
- Automated workflow, persistence, HTTP, reply, grounding, provider, and
  approval tests.

## Honest boundaries

This is a fictional, single-owner local prototype, not a production multi-user
service. No real email, calendar, social account, or customer data is connected.
Local history is plaintext. Campaign sample content is fixed. Optional AI only
prepares editable drafts and grounded answers when explicitly configured and
selected. There is no public hosting, production identity, tenant isolation,
shared database, measured customer outcome, or profitability evidence.

Before public sharing: verify a clean checkout, choose a secure hosting and data
model, remove private local history from distributable artifacts, and explicitly
authorize publication. A local screen-share or recording can demonstrate the
current project without expanding those boundaries.
