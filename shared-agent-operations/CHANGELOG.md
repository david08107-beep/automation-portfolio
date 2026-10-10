# Local preview changes

## Unreleased — active development

- Add V1.7 grounded optional-AI answers to Ask Orbit through the existing Local/Cloud generation adapter. Scripted remains the default; model answers are limited to a bounded fictional workspace snapshot and must cite validated fact IDs.
- Add explicit Ask Orbit mode selection, responsive generation feedback, cancellation, and clear no-fallback/no-action states. Model output cannot invoke tools, approve work, or execute an action.
- Add optional hosted Ollama reply drafting through the server-side generation adapter, while preserving Scripted as the default and Local AI as an opt-in mode.
- Keep cloud credentials backend-only; add bounded output, timeout/cancellation, redacted provider errors, model/rate-limit handling, and tests proving generated text cannot approve or execute.
- Refresh Orbit with a neutral professional visual system and persistent Light, Dark, and Auto themes across the Executive and Work-only views.
- Refresh portfolio screenshots and current documentation without changing the preserved v1.5.0 demo baseline or enabling real external actions.
- Expand the current regression suite to 104 passing tests.

## 0.4.0 — 2026-10-09

- Restore the original Orbit Executive Assistant as the main interface, retaining its briefing, command center, inbox/reply editor, calendar, tasks, document reviews, and guided demo.
- Add Workflows and Content Studio within Orbit; preserve the existing campaign history and exact-version approval behavior.
- Make Personal and Work explicit: different purpose labels, inbox/calendar/task names, context colors, and separate saved executive changes.
- Keep business campaign tools Work-only, reject Personal business deep links without silently switching context, and load campaign records only when needed.
- Remove the duplicate workspace dropdown; Personal/Work buttons are the only switcher.
- Reset only the selected executive context, without clearing the other context or campaign history.
- Include original reply-service regressions and new context-separation coverage in the combined test command.

At the 0.4.0 release, this was a fictional local demo only with no live AI, connected accounts, real sending, public deployment, unified executive/campaign storage, or full standalone AI OS/Marketing feature import. Preserved release branches are unchanged.
