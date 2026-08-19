# ctg-ai-agent-proc v0.1 Specification (Test Contract)

**Target:** TypeScript, ES modules, Node.js, `strict: true`

This document is the working contract. It restates the current implementation
contract as **numbered, testable requirements**, records which requirements the
hermetic conformance suite already asserts, and surfaces the gaps that still
need discussion before behavior can be pinned down.

Every requirement has an ID and a status:

| Status | Meaning |
| --- | --- |
| **Covered** | Asserted by the hermetic conformance suite today. |
| **Missing** | Contract is defined and stable, but no test asserts it. Should be added to the suite. |
| **Blocked** | Behavior exists in code but the contract is undecided. Testing it would freeze an accidental behavior. Resolved by the referenced gap in Part II. |

Test citations refer to files under `tests/conformance/`.

If the code and this document disagree, update whichever side is intentionally
wrong before expanding behavior.

---

# Part I — Test Contract

## 1. Public Surface

The root package exports:

```ts
export {
    LLMPrompt,
    LLMPromptError,
    ClaudeRunner,
    CodexRunner,
    LLMRunner,
    LLMRunnerError
};

export type {
    LLMPromptErrorData,
    LLMPromptErrorLogFormatter,
    LLMPromptOptions,
    LLMPromptTemplate,
    LLMPromptTemplateDelimiter,
    LLMPromptTemplateOptions,
    LLMPromptTemplateValue,
    LLMRunnerErrorData,
    LLMRunnerErrorLogFormatter,
    LLMRunnerConfig,
    LLMRunnerRunConfig,
    LLMRunnerResult
};
```

No other source modules are part of the public package contract.

| ID | Requirement | Status |
| --- | --- | --- |
| EXP-01 | The package root exports exactly the six runtime names above. | **Covered** — `exports.ts` "root exports public runtime names". |
| EXP-02 | The type exports above compile against the package entry point. | **Missing** — enforced only indirectly by `npm run check`; no test imports every exported type. |

## 2. LLMRunner

v0.1 is POSIX-first. Runners invoke CLI commands directly with Node
`execFile`; Windows `.cmd`/`.ps1` shim handling is out of scope for this
release.

### 2.1 Construction and Config

```ts
new LLMRunner(config: LLMRunnerConfig)
```

| ID | Requirement | Status |
| --- | --- | --- |
| RUN-01 | Stored config is a frozen object; mutating it throws or has no effect. | **Covered** — `runner.ts` "stored config is frozen". |
| RUN-02 | Constructor copies `config.args` into a new array: mutating the caller's array after construction does not change runner behavior. | **Covered** — `runner.ts` "constructor args are copied". |
| RUN-03 | Stored args are `subclass DEFAULT_ARGS` followed by constructor `args`. | **Covered** — `runner.ts` "subclass default args precede constructor args". |
| RUN-04 | Base `DEFAULT_ARGS` is an empty readonly array; subclasses may override it. | **Covered** — `runner.ts` "base default args are empty" and "subclass default args precede constructor args". |
| RUN-04A | Optional `timeout`, `maxBuffer`, and `env` config values are forwarded to `execFile`. Omitted `env` inherits the parent process environment; provided `env` is the complete child environment and is not merged or filtered by the library. | **Covered** — `runner.ts` "env override is forwarded as complete child environment", "timeout failures are wrapped", and "maxBuffer failures are wrapped". |
| RUN-04B | Invalid `timeout` / `maxBuffer` values throw `LLMRunnerError("INVALID_OPTIONS")`: `timeout` must be a non-negative finite integer, and `maxBuffer` must be a positive finite integer. | **Covered** — `runner.ts` "constructor rejects invalid timeout" and "constructor rejects invalid maxBuffer". |

### 2.2 Running Prompts

```ts
async run(prompt: string, config: LLMRunnerRunConfig = {}): Promise<LLMRunnerResult>
```

| ID | Requirement | Status |
| --- | --- | --- |
| RUN-05 | argv order is: `DEFAULT_ARGS`, constructor args, per-run args, prompt. The prompt is always the final argv element. | **Covered** — `runner.ts` "prompt is appended as final argv element" and "subclass default args precede constructor args". |
| RUN-06 | `LLMRunnerResult` has exactly the keys `result` (stdout) and `error` (stderr). | **Covered** — `runner.ts` "success result exposes result and error" and "success result captures stderr as error". |
| RUN-07 | `cwd` is forwarded to the child process; when omitted, native Node behavior applies. | **Covered** — `runner.ts` "cwd is forwarded to execFile" and "omitted cwd uses current process cwd". |
| RUN-08 | An empty-string prompt is still passed as the final argv element. | **Covered** — `runner.ts` "empty prompt is appended as final argv element". |
| RUN-09 | `run()` wraps native `execFile` failures in `LLMRunnerError`: missing commands become `COMMAND_NOT_FOUND`; other process failures become `COMMAND_FAILED`; partial stdout/stderr and optional signal diagnostics are preserved when available. | **Covered** — `runner.ts` "missing command failures are wrapped" and "non-zero command failures are wrapped with output". |
| RUN-09A | Prompts are delivered as the final argv element. Very large prompts may exceed OS argument-size limits; v0.1 does not preflight prompt size or switch to stdin delivery. | **Documented** — Gap G-6. |

### 2.3 Token Counting

```ts
async tokenCount(text: string): Promise<number>
```

| ID | Requirement | Status |
| --- | --- | --- |
| RUN-10 | Base implementation returns `Math.ceil(text.length / 4)`. | **Covered** — `runner.ts` "base tokenCount uses length over four approximation". |

### 2.4 Summarization

```ts
async summarize(text: string): Promise<string>
```

| ID | Requirement | Status |
| --- | --- | --- |
| RUN-11 | Base `summarize(text)` is a convenience hook that invokes the same runner once with a summary-oriented prompt containing `text`, and returns the `result` field from `run()`. Exact prompt wording is not part of the public contract. | **Covered** — `runner.ts` "base summarize invokes run once with text and returns result". |

### 2.5 Static Factory

```ts
static init<T extends LLMRunner>(this: new () => T): T
static init<C, T extends LLMRunner>(this: new (config: C) => T, config: C): T
```

| ID | Requirement | Status |
| --- | --- | --- |
| RUN-12 | `init()` on a subclass returns an instance of that subclass. | **Covered** — `runner.ts` "static init returns subclass instance". |
| RUN-13 | `init()` may be called with no arguments when the concrete constructor accepts omitted config. | **Covered** — `runner.ts`, `claudeRunner.ts`, `codexRunner.ts`. |
| RUN-14 | `LLMRunner.init()` without config is a compile-time error (base constructor requires `command`). | **Missing** — type-level only; could be asserted with a `@ts-expect-error` compile check. |

## 3. Concrete Runners

### 3.1 ClaudeRunner

| ID | Requirement | Status |
| --- | --- | --- |
| CLR-01 | Default command is `claude`. | **Covered** — `claudeRunner.ts`. |
| CLR-02 | `DEFAULT_ARGS` are `--safe-mode --print`, placed before constructor args. | **Covered** — `claudeRunner.ts`. |
| CLR-03 | Per-run args are placed after constructor args and before the prompt. | **Covered** — `claudeRunner.ts`. |
| CLR-04 | `command` and `cwd` overrides are forwarded to the base class. | **Covered** — `claudeRunner.ts` command override tests and "forwards cwd override to base runner". |

### 3.2 CodexRunner

| ID | Requirement | Status |
| --- | --- | --- |
| CXR-01 | Default command is `codex`. | **Covered** — `codexRunner.ts`. |
| CXR-02 | `DEFAULT_ARGS` are the sterile `exec` invocation (`exec --ignore-user-config --ignore-rules --ephemeral -c project_root_markers=[] -c project_doc_max_bytes=0 -c features.memories=false -c memories.use_memories=false`), placed before constructor args. | **Covered** — `codexRunner.ts`. |
| CXR-03 | Per-run args are placed after constructor args and before the prompt. | **Covered** — `codexRunner.ts`. |
| CXR-04 | `command` and `cwd` overrides are forwarded to the base class. | **Covered** — `codexRunner.ts` command override tests and "forwards cwd override to base runner". |

### 3.3 CLI Parity

| ID | Requirement | Status |
| --- | --- | --- |
| PAR-01 | `ClaudeRunner.init().run(p)` is observably equivalent to `claude --safe-mode --print "p"` in a shell. | **Blocked** — Gap G-2. Requires opt-in live tests. |
| PAR-02 | `CodexRunner.init().run(p)` is observably equivalent to the sterile `codex exec ...` shell invocation. | **Blocked** — Gap G-2. |

## 4. LLMRunnerError

| ID | Requirement | Status |
| --- | --- | --- |
| RERR-01 | `TYPES` is bidirectional for `INVALID_OPTIONS: 1001`, `COMMAND_NOT_FOUND: 1002`, `COMMAND_FAILED: 1003`. | **Covered** — `errorClass.ts` "types map is bidirectional". |
| RERR-02 | Constructor assigns `name`, `type`, `msg`, `message` (same text as `msg`), `data`, and forwards `data.cause` to `Error#cause`. | **Covered** — `errorClass.ts` "constructor assigns public fields". |
| RERR-03 | Constructing with an unknown type string throws. | **Covered** — `errorClass.ts` "runner error constructor rejects unknown type". |
| RERR-04 | `data` is frozen shallowly; nested arrays/objects such as `data.args` and `data.cause` are not recursively frozen or defensively copied. | **Covered** — `errorClass.ts` "runner error data is shallow frozen". |
| RERR-05 | `is()` narrows correctly for instances and rejects plain `Error`. | **Covered** — `errorClass.ts` "is narrows runner errors". |
| RERR-06 | `isType()` returns true for known types and false otherwise. | **Covered** — `errorClass.ts` "runner error isType checks known types". |
| RERR-07 | `log()` with no formatter writes `{name, type, msg, data}` JSON to `console.error` and returns the same string. | **Covered** — `errorClass.ts`. |
| RERR-08 | `log(formatter)` passes the error instance to the formatter and writes/returns its output. | **Covered** — `errorClass.ts`. |

## 5. LLMPrompt

`LLMPrompt` is a reusable, runner-independent prompt pipeline. It stores
operations and resolves them only when `run(runner)` is called. It does not
accept a runner in its constructor and does not expose a public `build()`.

Defaults: template delimiter `[[ ]]`, `strict: true`, `cache: false`.

### 5.1 Construction and Factory

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-01 | A non-empty constructor prompt is stored as the first append operation. | **Covered** — `prompt.ts` "constructor text and append are sent to runner". |
| PRM-02 | An empty/omitted constructor prompt stores no operation; running such a prompt sends `""` to the runner. | **Covered** — `prompt.ts` "empty prompt sends empty string to runner". |
| PRM-03 | `LLMPrompt.init(prompt?, config?)` returns a new `LLMPrompt` equivalent to the constructor. | **Covered** — `prompt.ts` "static init matches constructor behavior". |
| PRM-04 | All operation methods return `this` (chainable). | **Covered** implicitly — every test chains; no explicit identity assertion, which is acceptable. |

### 5.2 Append Operations

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-05 | `append(text)` appends literal text. | **Covered** — `prompt.ts`. |
| PRM-06 | `appendFile(path)` reads the file as UTF-8 at resolve time and appends its contents. | **Covered** — `prompt.ts` "appendFile appends file contents" and "appendFile reads file contents at run time". |
| PRM-07 | `appendFile` read failure throws `LLMPromptError("READ_FAILED")` with `data.path` and `data.cause`. | **Covered** — `prompt.ts` "appendFile failures throw prompt error". |

### 5.3 Summarize Operations

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-08 | `summarize()` replaces the prompt-so-far with `await runner.summarize(promptSoFar)`. | **Covered** — `prompt.ts`. |
| PRM-09 | `summarizeText(text)` appends the summary of the supplied text. | **Covered** — `prompt.ts`. |
| PRM-10 | `summarizeFile(path)` reads the file and appends the summary of its contents; read failure throws `READ_FAILED`. | **Covered** — `prompt.ts` "summarizeFile appends summarized file contents" and "summarizeFile read failures throw prompt error". |
| PRM-11 | Runner summarization failures propagate unwrapped. | **Covered** — `prompt.ts` "summarize failures propagate". |

### 5.4 Truncate Operations

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-12 | `truncate(maxTokens)` replaces the prompt-so-far with the longest prefix whose `runner.tokenCount()` is ≤ `maxTokens`. | **Covered** — `prompt.ts` (with a 1-char-per-token test runner). |
| PRM-13 | `truncateText` / `truncateFile` truncate the supplied text / file contents and append the result. | **Covered** — `prompt.ts` "truncateText appends truncated text", "truncateFile appends truncated file contents", and "truncateFile read failures throw prompt error". |
| PRM-14 | Negative `maxTokens` throws `LLMPromptError("INVALID_OPTIONS")` with `data.maxTokens`. | **Covered** — `prompt.ts` "invalid truncate maxTokens throws prompt error". |
| PRM-15 | `maxTokens: 0` is valid and yields the empty string. | **Covered** — `prompt.ts` "truncate allows zero maxTokens". |
| PRM-16 | `maxTokens` ≥ the full text's token count is a no-op (full text preserved). | **Covered** — `prompt.ts` "truncate preserves text within maxTokens". |
| PRM-17 | `maxTokens` must be a non-negative finite integer. Non-integer, `NaN`, and `Infinity` values throw `LLMPromptError("INVALID_OPTIONS")` with `data.maxTokens`. | **Covered** — `prompt.ts` invalid `maxTokens` tests. |
| PRM-18 | Runner token-count failures propagate unwrapped. | **Covered** — `prompt.ts` "token count failures propagate". |

### 5.5 Template Operations

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-19 | `applyTemplate` transforms the prompt-so-far; `applyTemplateText` / `applyTemplateFile` transform the supplied text / file contents and append. | **Covered** — `prompt.ts` happy paths plus "applyTemplateFile read failures throw prompt error". |
| PRM-20 | Default delimiter is `[[ ]]`; custom delimiters are honored. | **Covered** — `prompt.ts` "template supports custom delimiter". |
| PRM-21 | Delimiters containing regex metacharacters are escaped and treated literally. | **Covered** — `prompt.ts` "template supports regex metacharacter delimiters". |
| PRM-22 | `strict: true` (default) throws `LLMPromptError("TEMPLATE_VALUE_NOT_FOUND")` with `data.key` on an unresolved placeholder. | **Covered** — `prompt.ts`. |
| PRM-23 | `strict: false` leaves unresolved placeholders unchanged. | **Covered** — `prompt.ts`. |
| PRM-24 | Extra template keys are ignored. | **Covered** — `prompt.ts` "template ignores extra keys". |
| PRM-25 | Number template values are stringified via `String()`. | **Covered** — `prompt.ts` "template stringifies number values". |
| PRM-26 | Repeated occurrences of the same placeholder are all replaced. | **Covered** — `prompt.ts` "template replaces repeated placeholders". |
| PRM-27 | Inherited object properties do not resolve placeholders (`hasOwnProperty` guard) — e.g. a `[[toString]]` placeholder with an empty template throws under strict mode rather than injecting `function toString() ...`. | **Covered** — `prompt.ts` "template does not resolve inherited object properties". |
| PRM-28 | Template delimiters must be a pair of non-empty distinct strings. Invalid delimiters throw `LLMPromptError("INVALID_OPTIONS")`. | **Covered** — `prompt.ts` "invalid template delimiters throw prompt error". |

### 5.6 Join

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-29 | `join(prompt)` appends the resolved output of the other pipeline, built with the same runner. | **Covered** — `prompt.ts` "join appends resolved reusable prompt". |
| PRM-30 | The joined prompt's own cache settings apply during a join. | **Covered** — `prompt.ts` "join uses cached reusable prompt". |
| PRM-31 | Errors raised inside a joined prompt propagate to the outer `run()` caller as-is. | **Covered** — `prompt.ts` "join errors propagate". |
| PRM-32 | Direct or indirect join cycles are caller responsibility in v0.1. Callers must not create cyclic prompt graphs; behavior is undefined and may recurse until stack overflow. | **Documented** — Gap G-5. Cycle detection remains a future consideration. |

### 5.7 Running

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-33 | `run(runner, config?)` resolves all operations in order, passes the final string and runner invocation config to `runner.run(prompt, config)`, and returns the runner result unchanged. | **Covered** — `prompt.ts` "constructor text and append are sent to runner" and "run forwards runner invocation config". |
| PRM-34 | Operations resolve strictly in insertion order, including interleaved transform ops (e.g. append → applyTemplate → append → truncate). | **Covered** — `prompt.ts` "mixed operations resolve in insertion order". |
| PRM-35 | An unknown operation type at resolve time throws `LLMPromptError("UNKNOWN_OPERATION")` with `data.operationType`. | **Covered** — `prompt.ts` "unknown operations throw prompt error". |

### 5.8 Caching

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-36 | With `cache: true`, repeated `run()` calls reuse the resolved prompt and skip construction operations; the runner is still invoked each time. | **Covered** — `prompt.ts` "caching reuses resolved prompt without rerunning operations". |
| PRM-37 | Operations added after cache population take effect only after `resetCache()`. | **Covered** — `prompt.ts` (two tests). |
| PRM-38 | `resetCache()` clears the cache and returns `this`. | **Covered** — `prompt.ts` "resetCache reruns operations on the next run" and "resetCache returns prompt instance". |
| PRM-39 | `resetCache()` with caching disabled throws `LLMPromptError("INVALID_OPTIONS")`. | **Covered** — `prompt.ts`. |
| PRM-40 | A failed build does **not** populate the cache: after a mid-resolution failure (e.g. a runner `summarize()` that throws once), the next `run()` re-executes all operations. | **Covered** — `prompt.ts` "failed build does not populate cache". |
| PRM-41 | Concurrent first `run()` calls on one cached prompt do not share an in-flight build. Operations may execute more than once before the cache is populated. | **Documented** — Gap G-11. |

## 6. LLMPromptError

| ID | Requirement | Status |
| --- | --- | --- |
| PERR-01 | `TYPES` is bidirectional for `INVALID_OPTIONS: 1001`, `TEMPLATE_VALUE_NOT_FOUND: 1002`, `READ_FAILED: 1003`, `UNKNOWN_OPERATION: 1004`. | **Covered** — `errorClass.ts` "prompt error types map is bidirectional". |
| PERR-02 | Constructor assigns `name`, `type`, `msg`, `message`, `data`, and forwards `data.cause`. | **Covered** — `errorClass.ts` "prompt error constructor assigns public fields". |
| PERR-03 | Constructing with an unknown type string throws. | **Covered** — `errorClass.ts` "prompt error constructor rejects unknown type". |
| PERR-04 | `data` is frozen shallowly; nested arrays/objects are not recursively frozen or defensively copied. | **Covered** — `errorClass.ts` "prompt error data is shallow frozen". |
| PERR-05 | `is()` narrows correctly. | **Covered** — `errorClass.ts` "is narrows prompt errors". |
| PERR-06 | `log()` default and custom-formatter behavior (same contract as RERR-07/08). | **Covered** — `errorClass.ts`. |

---

# Part II — Gaps Requiring Discussion

These are the places where writing a test today would freeze behavior nobody
has actually decided on, plus contract holes surfaced while auditing code
against `spec.md` and the suite. G-1 through G-5 carry over from the previous
`spec.md` §8; G-6 through G-14 are newly surfaced.

### G-1. Runner process failure wrapping — resolved

`LLMRunner.exec()` wraps native `execFile` failures in `LLMRunnerError` so
callers do not depend on Node's native child-process error shape.

Missing executable failures where the native error code is `ENOENT` throw:

```text
COMMAND_NOT_FOUND
```

All other process invocation failures throw:

```text
COMMAND_FAILED
```

Wrapped process errors include:

- `command`: executable name/path
- `args`: copied argv passed to `execFile`
- `cwd`: configured working directory, when set
- `exitCode`: numeric process exit code, when available
- `signal`: signal name, when the child was terminated by signal and Node
  reports it
- `stdout`: partial stdout, when available
- `stderr`: partial stderr, when available
- `cause`: native error object

`signal` is diagnostic data, not a separate failure category. It identifies
signal-terminated child processes such as future timeout/cancel kills or
external termination. Callers must treat it as optional.

Invalid construction config is validated minimally: an empty or whitespace-only
`command` throws `LLMRunnerError("INVALID_OPTIONS", ...)`.

Non-zero exits reject as `COMMAND_FAILED` even when stdout was produced. Partial
stdout remains available as `error.data.stdout`.

### G-2. Live CLI parity tests (spec.md §8.2)

The concrete runner defaults (`--safe-mode --print`; the sterile `codex exec`
config set) have never been proven against installed CLIs. Needs: an opt-in
suite (env-var gated, excluded from `npm test`), and a decision on what
"parity" asserts — argv construction only, or observable output equivalence.
Note this includes verifying the flags even exist in current CLI versions;
vendor flag churn is a standing risk for frozen `DEFAULT_ARGS`.

Planned in `docs/ROADMAP.md` Phase 1 as opt-in live runner parity and
integration coverage, including prompt-operation flows for summarization and
truncation.

### G-3. Token counting strategy — resolved for v0.1

The base runner uses `Math.ceil(text.length / 4)` as a deterministic
approximate default. Subclasses may override `tokenCount(text)` for model-aware
counting. v0.1 does not add tokenizer dependencies or require exact model token
counts.

Future consideration: introduce an `LLMTokenMetric` abstraction that can be
passed through runner config. That would let prompt building call
`runner.tokenCount()` while allowing a runner instance to compose with different
token metrics without subclassing or committing the runner class to one
tokenizer strategy.

### G-4. Summarization contract — resolved

The fixed base summary prompt wording is an implementation detail, not public
contract. `LLMRunner.summarize(text)` is an overridable convenience hook: it
invokes the same runner once with a summary-oriented prompt containing `text`
and returns `result` from `run()`.

Future consideration: a runner-level summary template could make this behavior
configurable without subclassing. Defer for v0.1 because it would introduce new
template syntax, validation, inheritance, and concrete-runner policy decisions.
If this becomes public API, a dedicated `LLMPromptTemplate` abstraction may be
cleaner than duplicating template behavior across `LLMRunner` and `LLMPrompt`.

### G-5. Join cycle detection — resolved for v0.1

Direct and indirect join cycles are caller responsibility in v0.1. Callers must
not create cyclic prompt graphs; behavior is undefined and may recurse until
stack overflow.

Future consideration: detect direct and indirect cycles during private
construction and throw `LLMPromptError("INVALID_OPTIONS")`. If added, joining
the same non-cyclic prompt multiple times into one pipeline should remain legal.

### G-6. Prompt size vs argv limits — resolved for v0.1

The core runner model passes the prompt as the final argv element. OS argv
limits (~2 MB total on Linux, far less elsewhere, and per-argument caps) mean
large prompts — exactly what `appendFile`/`join` pipelines produce — will fail
at the `execFile` boundary with a wrapped native spawn failure such as `E2BIG`.
v0.1 accepts and documents this limitation.

Future consideration: support stdin-based prompt delivery per runner, or
preflight prompt size and throw a more specific typed error. This interacts
with vendor CLI stdin support and future runner-specific transport policy.

### G-7. execFile process controls — resolved

`LLMRunnerConfig` supports optional `timeout`, `maxBuffer`, and `env` fields
that are forwarded to `execFile`.

```ts
export interface LLMRunnerConfig {
    command: string;
    cwd?: string;
    args?: string[];
    timeout?: number;
    maxBuffer?: number;
    env?: NodeJS.ProcessEnv;
}
```

`timeout` is measured in milliseconds. When omitted, native Node behavior
applies, which is no timeout. When provided, it must be a non-negative finite
integer. Timeout failures are wrapped as `COMMAND_FAILED`; `signal` may be
present as optional diagnostic data.

`maxBuffer` is measured in bytes. When omitted, native Node behavior applies.
When provided, it must be a positive finite integer. Buffer-limit failures are
wrapped as `COMMAND_FAILED`, preserving stdout/stderr when Node provides them.

`env` is a full child-environment override. When omitted, Node inherits the
parent process environment. When provided, the library passes it directly to
`execFile`; it does not merge with `process.env` and does not filter keys.

### G-8. Prompt numeric validation — resolved

`maxTokens` must be a non-negative finite integer. Non-integer values, `NaN`,
and `Infinity` throw `LLMPromptError("INVALID_OPTIONS", ...)` with
`data.maxTokens`.

### G-9. Template delimiter validation — resolved

Template delimiters must be a pair of non-empty distinct strings. Invalid
delimiters throw `LLMPromptError("INVALID_OPTIONS", ...)`.

Placeholder keys are not trimmed: `[[ name ]]` looks up key `" name "`, not
`"name"`. Nested and unclosed delimiters retain the existing regex replacement
behavior and are not separately validated.

### G-10. Error `data` freezing depth — resolved

Both error classes freeze `data` shallowly. Nested arrays/objects such as
`data.args` and `data.cause` remain mutable after construction, and the
constructor does not defensively copy nested values.

### G-11. Cache semantics under concurrency and failure — resolved

Cached prompts do not share in-flight builds in v0.1. If two first `run()`
calls overlap before the resolved prompt has been cached, both calls may
execute construction operations, including live `summarize()` calls. Once a
build succeeds, later calls reuse the cached prompt.

Failed builds leave the cache empty and the next call re-executes construction
operations.

Future consideration: share an in-flight build promise when the first cached
build is already running.

### G-12. Windows / platform support — resolved for v0.1

v0.1 is POSIX-first. Runners invoke CLI commands directly with Node `execFile`;
Windows `.cmd`/`.ps1` shim handling is out of scope for this release.

Future consideration: add platform-specific spawning and Windows CI coverage if
Windows support becomes a release target.

### G-13. Public prompt rendering / dry-run — resolved for v0.1

There is deliberately no public `build()` in v0.1. Prompt construction may read
files and call runner methods such as `summarize()` and `tokenCount()`, so a
true dry-run is not well-defined: it would either be incomplete or perform the
same expensive work as a real build.

Future consideration: add explicit debug/inspection support, likely as an
inspectable operation log or a public render method with clear execution
semantics. Avoid a vague dry-run API.

### G-14. Local model runner & orchestration layer (spec.md §8.6–8.7)

`AgentProc` orchestration and local-model runner design are future roadmap
items with no testable public surface yet. Planned in `docs/ROADMAP.md` as
Phase 2 for `AgentProc`, with `OllamaRunner` tracked separately under
Additional Considerations.

---

# Part III — Suggested Test Backlog

Ordered so the suite hardens the *decided* contract first. All items are
hermetic (no live CLIs) unless noted.

1. **Type-level surface checks** — EXP-02 and RUN-14 need a dedicated test
   typecheck config or equivalent `tsc --noEmit` fixture coverage.
2. **Opt-in live parity and integration suite** — PAR-01/02 per G-2, gated
   behind an environment flag and excluded from `npm test`.
