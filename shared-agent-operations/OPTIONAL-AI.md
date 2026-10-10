# Orbit V1.6 — Optional AI Reply Generation

The integrated preview package remains 0.4.0; this additive Orbit milestone is V1.6.
Scripted alternatives remain the default. No model or other software is installed
by the app, and no paid provider, credentials, account connection or sending is added.

## One checkout on Windows

Install Git for Windows and Node.js 20+ once if they are not already available.
In Command Prompt:

```cmd
cd /d "%USERPROFILE%\Documents\AI"
git clone https://github.com/david08107-beep/automation-portfolio.git
cd automation-portfolio\shared-agent-operations
start-local-ai.cmd
```

Use a new checkout next to old ZIP folders; the clone does not import their saved
history. The browser origin is unchanged, so browser-local executive state remains
available. Campaign history is tied to each folder's ignored `local-data` file.
Keep the old folder until you have checked any history you want to retain.

The launcher checks Node/Ollama commands, enables local AI for this process,
starts Orbit, and opens your browser after the status endpoint responds. It does
not install software, pull models, sign in, or update Git automatically.
Windows launcher execution has not been verified in this Linux environment.

For future updates, stop Orbit with Ctrl+C and use the same checkout:

```cmd
cd /d "%USERPROFILE%\Documents\AI\automation-portfolio"
git pull --ff-only
cd shared-agent-operations
start-local-ai.cmd
```

If Git reports conflicts or local changes, stop and inspect them; do not reset or
force an update. Download `llama3.2` only once with `ollama pull llama3.2`.
No npm install is required. To use the scripted demo, run `node server.mjs` from
a fresh Command Prompt without the AI environment flags.

## Run

From `shared-agent-operations`, run `node server.mjs` for the default demo.
If Ollama and a suitable model already exist on the same computer, opt in explicitly:

```sh
ORBIT_OLLAMA_ENABLED=true ORBIT_OLLAMA_MODEL=llama3.2 node server.mjs
```

On Windows PowerShell, from the same folder:

```powershell
$env:ORBIT_OLLAMA_ENABLED = "true"
$env:ORBIT_OLLAMA_MODEL = "llama3.2"
node server.mjs
```

Ollama must already be running on the same computer as this Node server. Installing
Ollama on a personal PC does not make it available to a separate cloud server.
Do not expose Ollama publicly to bridge that gap. For local testing, run both
Orbit and Ollama on the PC. No installer is executed by these commands.

Open the server's printed local address, open an inbox message, then choose
**Generate with local AI** in the reply editor. The control is enabled only when
the server reports opt-in; this status does not assert that the model is installed. Edit the reply brief and settings
before generation. Review/edit the resulting body; sending still requires the
existing explicit confirmation and remains a demo simulation. Saving an AI draft
creates a revision and invalidates older approvals. Disabling the flag restores
scripted-only operation. On a static hosted demo the optional server route is
unavailable; scripted alternatives continue to work.

## Boundaries

`src/reply-generation.js` calls only the fixed loopback Ollama endpoint. Browser
input cannot choose a provider URL or model. Redirects are forbidden. Message,
brief, settings and previous draft are sent to the local model only after clicking
the optional control. JSON output must contain only a bounded, non-empty `body`
and differ from the previous draft. No tool execution is supported. Returned text
is assigned to the textarea and saved through the existing Reply Application Service.

A 15-second deadline includes response-body reading, with a 64 KB response cap.
Provider errors are redacted. Failures preserve the editor; scripted generation
remains available. Pending results are discarded if the message/workspace changes,
the editor closes, or editable fields change. Revision checks also reject stale saves.

Model content remains untrusted and can be inaccurate or influenced by message
text despite prompt instructions. Schema validation is not a factual-quality or
prompt-injection guarantee. This remains a single-owner, local fictional demo,
not authenticated production infrastructure. No provider errors or prompts are logged.

## Verification

`node --test test/*.test.js executive/tests/reply-service.cjs`

Mocked tests cover default-off behavior, invalid inputs, fixed endpoint, valid
output, malformed/oversized/unchanged output, provider failures, timeout, HTTP
origin checks and the existing unapproved-execution boundary. No Ollama is needed.
A real-model run and manual browser checks remain separate acceptance steps.

Follow-up verification: 69/69 automated tests passed, including default-off and
opt-in capability status without contacting Ollama. Closing the reply editor
aborts the browser request and prevents its late result from being applied.
Manual browser cancellation behavior and live model quality remain unverified.

## Direct reply action

Open an inbox message and choose **Generate AI reply**. This opens the editor
and starts optional generation in one action. Review Orbit Draft remains available
for scripted replies. Disabled AI shows a clear explanation without changing a draft.
Cancelling the editor also discards a pending AI result.

Release verification: 70/70 automated tests passed. The local-only adapter also
rejects `:cloud` models and replies exceeding the editor limit. Syntax checks and
Git whitespace checks passed; a focused secret-pattern scan found no matches.
The Windows launcher and live model generation remain unverified on this Linux host.

## Settings reliability fix

Incoming message context excludes the prewritten fixture reply. Explicit goal
instructions take priority over the brief and assessment: positive feedback with
a decline goal acknowledges the proposal without accepting it. One retry is
allowed for invalid or unchanged output, within the same 15-second deadline.
Unchanged and malformed replies now report distinct errors. All 73 automated
tests passed; actual local-model quality for these settings remains to be checked.

## Editor stability

Reply fields, scripted regeneration, history restoration, save and send are
temporarily disabled during local generation. Cancel and close remain available
and restore the previous control states. The edit check compares only editable
values, not history metadata or platform line endings. All 76 tests passed,
including regression checks for actual edits and control restoration; live browser
confirmation remains pending.

## Reply quality checks

Model-generated literal newline escapes are normalized to plain-text line breaks.
Decline requests require explicit refusal and reject common postponement wording;
this conservative English heuristic is not a semantic-quality guarantee. One
repair attempt stays within the existing request deadline. No scripted fallback
is silently substituted for AI output. All 83 mocked/regression tests passed,
including the screenshot-style postponement and escaped-newline cases. Live model
verification remains blocked until the environment can access Ollama downloads.

## Formatting and responsiveness follow-up

Model output normalization handles repeated escaped newline/tab markers and bare
backslash-space paragraph separators from the reported email. It preserves
Windows-path tokens rather than removing all backslashes. The original saved
draft is not silently rewritten; regenerate to receive corrected text.

Requests ask for replies under 80 words, cap output at 384 tokens, and retain the
model in Ollama memory for 10 minutes. A token cap can produce incomplete JSON,
which is rejected rather than shown as a successful draft. First-use load time
still depends on hardware. The editor now shows elapsed seconds and generation
state, with cancellation still available. The existing 15-second total deadline
and one-repair limit are unchanged. All 85 automated tests passed; real speed
improvement and visual progress behavior remain unverified on the user PC.

## Simplified generation controls and timing

Choose Scripted demo or Local AI, then use the single **Generate reply** button.
Scripted demo remains the default, and Local AI is unavailable without server
opt-in. **More** contains draft history, download, copy and timing details.
Cancel, Save Draft and Send Reply remain separate; generation never confirms
execution. The direct message action still selects Local AI and starts generation.

Busy feedback is painted before synchronous draft/history persistence. After a
successful local generation, More shows total elapsed time, editor preparation,
number of attempts, and model load/generation durations when Ollama supplies them.
Model load/generation durations describe the final attempt; total time includes
any retry. Only non-negative finite numeric provider timings are returned.
These diagnostics do not establish a measured speed improvement on the user PC.
All 87 automated tests passed; manual layout/keyboard and local hardware timing
checks remain outstanding.
