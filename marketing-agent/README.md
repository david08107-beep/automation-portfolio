# Fetch & Flourish Marketing Agent

A polished, responsive marketing workspace for a local dog-care business. The prototype turns business context into on-brand social posts, campaign concepts, review responses, weekly content calendars, and customer follow-ups.

## Features

- Five focused marketing workflows
- Reusable business profile and brand voice
- One-click generation, regeneration, and copy
- Local creation history stored in the browser
- Responsive interface with labeled controls; full accessibility audit pending
- Zero-build static deployment

## Run locally

Serve `dist/` with any static web server, for example:

```bash
npx serve dist
```

Then open the local URL shown in your terminal.

## Notes

This first version uses a template-based, profile-aware content engine without API keys. Social posts randomly select one of two templates; other workflows use one template. The review response does not interpret the pasted review, and tone/goal fields do not rewrite every template. Treat all output as a draft requiring manual fact-checking, not AI reasoning or confirmed business facts.

Profiles and up to 20 drafts are stored in this browser. Malformed stored records fall back to safe defaults, and history text is escaped before rendering. If storage or clipboard access is unavailable, the app reports the limitation. Clearing site data removes saved profiles/history; use fictional data for interviews. Live model integration, account access, and production security would require separate implementation and approval. This folder is not the preserved revisioned-service baseline listed in the shared operations README.

