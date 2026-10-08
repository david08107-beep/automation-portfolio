# Public demo deployment

The dedicated `gh-pages` branch serves this dashboard at the site root. It includes only fictional dashboard assets, supporting documentation, screenshots, and the simulated walkthrough. It does not include other portfolio projects. The existing `main` branch is unchanged by this deployment.

Expected URL after GitHub Pages is enabled:
https://david08107-beep.github.io/automation-portfolio/

GitHub setup (once): repository Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: gh-pages → Folder: / (root) → Save. GitHub then builds the static site. Deployment can take a few minutes. Repository/plan eligibility still applies if this repository is private.

Git and direct public asset requests are available in the current maintenance environment. A pushed branch alone does not establish a completed deployment: verify that public HTML, CSS, JavaScript, preview and reply modules match the intended commit. Do not change the existing Pages configuration or preserved baseline tag.

To validate after activation: open the public URL, click Try Orbit, run a briefing, edit and explicitly send the demo reply, switch to Personal, then Finish. Saved progress should return. `/walkthrough.html` serves the recording. All account actions remain fictional simulations.

Changes in this cloud checkout are not automatically changes in main. Future deployments must explicitly publish updated files to gh-pages.
