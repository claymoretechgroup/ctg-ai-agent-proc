# ctg-ai-agent-proc Roadmap

This document tracks outstanding work after the v0.1 core contract decisions.

## Phase 1. Opt-In Live Runner Parity And Integration

Add an opt-in suite that compares concrete runners against direct CLI calls and
proves prompt operations compose with real CLI-backed runners:

- `ClaudeRunner.init().run(p)` vs `claude --safe-mode --print "p"`.
- `CodexRunner.init().run(p)` vs the sterile `codex exec ...` invocation.
- Live `summarize()` / `truncate()` prompt-operation flows against concrete
  runners.
- Real CLI-boundary error handling for missing commands, bad arguments,
  timeouts, and available stdout/stderr diagnostics.

This suite should be gated by an environment variable and excluded from the
default hermetic `npm test` path because CLI installation, CLI version, model
availability, auth state, and vendor flag churn are machine-specific.

Detailed design notes are archived in
[live-parity-testing.md](../archive/live-parity-testing.md).

### Completed Live Checks

- Claude parity passed on this machine with Claude Code `2.1.236` using
  `CTG_AGENT_PROC_LIVE_CLAUDE_ARGS='["--model","sonnet"]'`.
- Claude prompt integration passed on this machine with Claude Code `2.1.236`
  using `CTG_AGENT_PROC_LIVE_CLAUDE_ARGS='["--model","sonnet"]'`.
- Claude parity passed on this machine with Claude Code `2.1.236` using
  `CTG_AGENT_PROC_LIVE_CLAUDE_ARGS='["--model","opus"]'`.
- Claude prompt integration passed on this machine with Claude Code `2.1.236`
  using `CTG_AGENT_PROC_LIVE_CLAUDE_ARGS='["--model","opus"]'`.
- Claude repeatability passed on this machine for three consecutive Claude Code
  `2.1.236` runs using
  `CTG_AGENT_PROC_LIVE_CLAUDE_ARGS='["--model","sonnet"]'`.
- Claude repeatability passed on this machine for three consecutive Claude Code
  `2.1.236` runs using
  `CTG_AGENT_PROC_LIVE_CLAUDE_ARGS='["--model","opus"]'`.
- Codex parity passed on this machine with `codex-cli 0.148.0` using default
  Codex model/settings.
- Codex prompt integration passed on this machine with `codex-cli 0.148.0`
  using default Codex model/settings.
- Codex parity passed on this machine with `codex-cli 0.148.0` using
  `CTG_AGENT_PROC_LIVE_CODEX_ARGS='["-c","model_reasoning_effort=\"high\""]'`.
- Codex prompt integration passed on this machine with `codex-cli 0.148.0`
  using
  `CTG_AGENT_PROC_LIVE_CODEX_ARGS='["-c","model_reasoning_effort=\"high\""]'`.
- Codex filesystem side-effect parity passed on this machine with
  `codex-cli 0.148.0`, proving direct Codex and `CodexRunner` can each generate
  `agent-output.txt` with exact sentinel content in isolated temp workspaces.
- Expanded Claude Sonnet parity passed on this machine with Claude Code
  `2.1.237`, covering stdout parity, prompt integration, filesystem read/write,
  and web search using `CTG_AGENT_PROC_LIVE_CLAUDE_ARGS='["--model","sonnet"]'`.
- Expanded Claude Opus parity passed on this machine with Claude Code
  `2.1.237`, covering stdout parity, prompt integration, filesystem read/write,
  and web search using `CTG_AGENT_PROC_LIVE_CLAUDE_ARGS='["--model","opus"]'`.
- Expanded Codex default parity passed on this machine with `codex-cli 0.148.0`,
  covering stdout parity, prompt integration, filesystem read/write, and web
  search.
- Expanded Codex thinking-level parity passed on this machine with
  `codex-cli 0.148.0` for `model_reasoning_effort` values `low`, `medium`, and
  `high`, covering stdout parity, prompt integration, filesystem read/write,
  and web search.
- Expanded Codex 5.4 parity passed on this machine with `codex-cli 0.148.0`
  using `CTG_AGENT_PROC_LIVE_CODEX_ARGS='["--model","gpt-5.4"]'`, covering
  stdout parity, prompt integration, filesystem read/write, and web search.
- Codex default repeatability passed on this machine for three consecutive
  expanded `codex-cli 0.148.0` runs, covering stdout parity, prompt integration,
  filesystem read/write, and web search.
- Timeout parity passed on this machine for Claude Code `2.1.237` and
  `codex-cli 0.148.0`, proving direct CLI baselines and concrete runners settle
  under a 1ms configured process timeout in the controlled live timeout worker.

### Non-Blocking Watch Items

- **Non-blocking:** Continue watching real-world long-running generation tasks
  for process-tree cancellation issues; the controlled 1ms live timeout path now
  passes.

### Strategy

Parity tests should answer one question: does the concrete runner invoke the
same CLI behavior a user would get from the documented direct shell command?
Live integration tests should answer a second question: do higher-level prompt
operations still work when their runner calls are real CLI invocations?

- Keep the suite opt-in, e.g. `CTG_AGENT_PROC_LIVE=1`, and separate from the
  hermetic conformance suite.
- Verify the required CLI is installed before running assertions. Missing CLIs
  should skip or fail with a clear setup message, not look like library
  regressions.
- Use small deterministic prompts that ask for constrained output where
  possible. Avoid tests that depend on model creativity or long responses.
- Compare observable behavior at the `LLMRunnerResult` boundary: stdout maps to
  `result`, stderr maps to `error`, and process failures surface consistently.
- Validate concrete default argv against the documented shell command, but avoid
  freezing unrelated CLI implementation details.
- Record CLI versions in test output so failures caused by vendor flag changes
  are diagnosable.
- Keep auth/model/network assumptions explicit. A parity failure may indicate
  local setup, vendor CLI drift, or a real runner regression; test output should
  make those cases easy to separate.
- Keep prompt validation and exact truncation mechanics in the hermetic suite.
  The live suite should cover real runner composition and real CLI-boundary
  errors.

### Comparison Candidates

Preflight checks:

- CLI executable is available.
- CLI version is captured in test output.
- Required auth/model setup is available, or the suite exits with a clear setup
  message.

Direct runner parity:

- A minimal constrained prompt through `ClaudeRunner` produces the same
  observable success/failure shape as the equivalent `claude --safe-mode
  --print` command.
- A minimal constrained prompt through `CodexRunner` produces the same
  observable success/failure shape as the equivalent sterile `codex exec`
  command.
- Successful direct and runner calls both map stdout to `result` and stderr to
  `error`.
- Known-bad CLI arguments fail both ways; the runner failure should be wrapped
  as `LLMRunnerError("COMMAND_FAILED")` while preserving available stdout/stderr
  diagnostics.

Prompt-operation live integration:

- `LLMRunner.summarize(text)` completes through each concrete runner and returns
  a non-empty summary-like result. Because exact summarization output is
  model-dependent, compare against semantic invariants such as containing key
  source concepts rather than exact text.
- `LLMPrompt.summarize()` / `summarizeText()` / `summarizeFile()` complete
  through each concrete runner and feed their summary into the final prompt run.
  These are integration checks, not exact-output parity checks.
- `LLMPrompt.truncate()` / `truncateText()` / `truncateFile()` complete through
  each concrete runner using the runner's `tokenCount()` behavior, then execute
  the final prompt. The truncation algorithm should stay covered hermetically;
  live tests should only prove the operation composes with real runners.

Avoid exact output equality unless the chosen CLI and prompt can make the output
deterministic enough to avoid routine false failures.

### Candidate Prompts And Fixtures

Direct parity prompts:

- Exact text:
  `Reply with exactly: CTG_PARITY_OK`
- Numeric constrained output:
  `Reply with only the number: 4`
- Punctuation and newline preservation:
  `Reply with exactly this text, preserving punctuation: CTG parity: commas, "quotes", apostrophes, and newlines.\nLine two.`
- Structured JSON:
  `Return exactly this JSON with no markdown: {"status":"ok","source":"ctg-ai-agent-proc"}`

Structured-output prompts:

- Fixed object shape:
  `Return only valid JSON matching this shape: {"status":"ok","items":["alpha","beta"],"count":2}`
- Extraction object:
  `Return only valid JSON with keys "project", "version", and "purpose" from this text: ctg-ai-agent-proc v0.1 validates CLI runner parity.`
- Boolean classification:
  `Return only valid JSON matching {"passes": boolean, "reason": string}. The answer passes if this sentence mentions runner parity.`

For structured-output checks, parse JSON and assert required keys/types/values
instead of comparing raw formatting.

Candidate file fixtures:

- Small text fixture: a short paragraph about `ctg-ai-agent-proc`, runner
  parity, and the v0.1 release target. Useful for `appendFile()` and
  `summarizeFile()`.
- Structured fixture: a small JSON document such as
  `{"project":"ctg-ai-agent-proc","version":"0.1","features":["runner","prompt"]}`.
  Useful for file loading plus structured extraction prompts.
- Truncation fixture: a deterministic paragraph with `ALPHA` near the beginning,
  filler in the middle, and `OMEGA` near the end. Useful for proving truncation
  composes with real runners without making the live suite own the truncation
  algorithm.
- Template fixture: a short prompt containing placeholders such as `[[project]]`
  and `[[version]]`. Useful for live `applyTemplateFile()` composition.

Summarization and truncation prompts should assert broad invariants:

- Summaries are non-empty and mention key source concepts.
- Truncated prompt flows produce the expected constrained final answer.
- File-backed operations read the intended fixture and compose into the final
  runner call.

## Phase 2. AgentProc Design

Design the orchestration layer before implementation:

- `AgentProc` orchestration over `hive-queue-js`.
- Worker registration, task routing, retry policy, continuation/halt semantics,
  and prompt construction as a task step.

This is roadmap work, not a v0.1 release blocker.

## Additional Considerations

These are likely future classes or abstractions. They should be designed
separately from the immediate `AgentProc` work.

### OllamaRunner

Design local-model runner support separately from `AgentProc`:

- CLI vs HTTP transport.
- Model selection.
- Timeout and process/transport policy.
- How local runners compose with future token metrics and prompt templates.

### LLMPromptTemplate

Consider extracting prompt templating into its own abstraction if template
behavior needs to be shared by `LLMPrompt`, runner-level summarization, or other
future APIs.

### LLMTokenMetric

Consider introducing an independent token metric abstraction that can be passed
through runner config, allowing one runner instance to compose with different
token-counting strategies without subclassing.

## Phase 3. Release-Final Compile-Time Tests

Add a dedicated type fixture and `tsc --noEmit` check for the public TypeScript
surface:

- `EXP-02`: every exported public type compiles from the package entry point.
- `RUN-14`: base `LLMRunner.init()` without config is rejected at compile time.

This should run with the normal release validation path, alongside `npm run
check`, `npm test`, and `npm run build`.
