# Automation Portfolio

A collection of AI automation, n8n, and Microsoft Power Automate Desktop projects. This repository is where I document and publish my automation work: what each project does, how it is built, and how to run or reproduce it.

> **Status:** Portfolio in progress. Runnable prototypes and documentation-only projects are labeled separately.

---

## Featured Projects

| Project | Platform | What it does | Status |
|---------|----------|--------------|--------|
| [File Renaming Automation](power-automate-desktop/file-renaming-automation/) | Power Automate Desktop | Documents structured renaming, validation, error handling, and logging. | Documented as built/tested; export not included |
| [Orbit / Shared Agent Operations](shared-agent-operations/SHOWCASE.md) | Node.js local prototype | Keeps campaign briefs, draft versions, exact-version approval, local export, and simulated receipts together. Includes an interview walkthrough. | Local demo; fixed sample content |

### Try the Orbit interview demo

With Node.js 20 or newer, run `npm start` from `shared-agent-operations`, then open `http://127.0.0.1:4317/showcase`. Use `npm test` for the regression suite. The walkthrough is illustrative and does not modify saved requests. Localhost is not a public recruiter link. No live AI provider or external publishing account is connected. See the [showcase guide](shared-agent-operations/SHOWCASE.md) for the live-app demonstration and limitations.

<!-- Add a row to the table above when a project is ready to show. -->

---

## Skills & Tools

**Automation platforms**
- n8n (workflow automation)
- Microsoft Power Automate Desktop

**AI**
- LLM-powered workflows and prompt design

**Focus areas**
- IT support and service desk automation
- Business process automation

<!-- Add specific tools (APIs, integrations, languages) here once they appear in a published project. -->

---

## Project Structure

```
automation-portfolio/
├── README.md
├── n8n/                      # n8n workflows (exported JSON + notes)
│   └── <project-name>/
├── power-automate-desktop/   # Power Automate Desktop flows and docs
│   └── <project-name>/
├── marketing-agent/          # Static, template-based marketing prototype
└── shared-agent-operations/  # Orbit local workflow prototype and tests
```

Each project folder should contain:
- `README.md` describing the problem, how it works, setup steps, and known limitations
- The workflow export or source files
- Screenshots or sample inputs/outputs where useful

The PAD folder currently contains documentation, not an importable flow. The n8n folder is a work-in-progress description without a workflow export. The two web prototypes are separate projects; neither provides live AI generation in this checkout.

---

## Current Work

I am currently building out this portfolio with n8n, Power Automate Desktop, and AI automation projects. Updates will be posted here as projects reach a working state.

---

## Contact

- GitHub: [@david08107-beep](https://github.com/david08107-beep)

<!-- Add email and/or LinkedIn here if you want them public. -->
