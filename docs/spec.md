# ctg-ai-agent-proc v0.1 Specification (Test Contract)

**Target:** TypeScript, ES modules, Node.js, `strict: true`

This document is the working contract. It restates the current implementation
contract as **numbered, testable requirements**, records which requirements the
hermetic conformance suite already asserts, and surfaces the gaps that still
need discussion before behavior can be pinned down.

Every requirement has an ID and a status:

| Status | Meaning |
| --- | --- |
| **Covered** | Asserted by a hermetic test suite today. |
| **Missing** | Contract is defined and stable, but no test asserts it. Should be added to the suite. |
| **Blocked** | Behavior exists in code but the contract is undecided. Testing it would freeze an accidental behavior. Resolved by the referenced gap in Part II. |

Test citations refer to files under `tests/conformance/` unless another suite
path is included.

If the code and this document disagree, update whichever side is intentionally
wrong before expanding behavior.

---

# Part I — Test Contract

## 1. Public Surface

The root package exports:

```ts
export {
    CTGAgentProc,
    CTGAgentProcError,
    LLMPrompt,
    LLMPromptError,
    LLMPromptTemplate,
    LLMPromptTemplateError,
    ClaudeRunner,
    CodexRunner,
    LLMRunner,
    LLMTokenMetric,
    LLMTokenMetricError,
    LLMRunnerError
};

export type {
    CTGAgentProcAgentFunction,
    CTGAgentProcAgentProps,
    CTGAgentProcConfig,
    CTGAgentProcErrorData,
    CTGAgentProcErrorLogFormatter,
    LLMPromptErrorData,
    LLMPromptErrorLogFormatter,
    LLMPromptOptions,
    LLMPromptTemplateConfig,
    LLMPromptTemplateDelimiter,
    LLMPromptTemplateErrorData,
    LLMPromptTemplateErrorLogFormatter,
    LLMPromptTemplateOptions,
    LLMPromptTemplateValue,
    LLMPromptTemplateValues,
    LLMRunnerErrorData,
    LLMRunnerErrorLogFormatter,
    LLMRunnerConfig,
    LLMRunnerRunConfig,
    LLMRunnerResult,
    LLMTokenMetricErrorData,
    LLMTokenMetricErrorLogFormatter
};
```

No other source modules are part of the public package contract.

| ID | Requirement | Status |
| --- | --- | --- |
| EXP-01 | The package root exports exactly the twelve runtime names above. | **Covered** — `exports.ts` "root exports public runtime names". |
| EXP-02 | The type exports above compile against the package entry point. | **Covered** — `tests/types/publicExports.ts`; run with `npm run test:types`. |

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
| RUN-03A | Optional constructor `prefixArgs` are copied and placed before subclass `DEFAULT_ARGS`, then constructor `args`. | **Covered** — `runner.ts` "constructor prefix args are copied" and "constructor prefix args precede subclass default args". |
| RUN-04 | Base `DEFAULT_ARGS` is an empty readonly array; subclasses may override it. | **Covered** — `runner.ts` "base default args are empty" and "subclass default args precede constructor args". |
| RUN-04A | Optional `timeout`, `maxBuffer`, and `env` config values are forwarded to `execFile`. Omitted `env` inherits the parent process environment; provided `env` is the complete child environment and is not merged or filtered by the library. | **Covered** — `runner.ts` "env override is forwarded as complete child environment", "timeout failures are wrapped", and "maxBuffer failures are wrapped". |
| RUN-04B | Invalid `timeout` / `maxBuffer` values throw `LLMRunnerError("INVALID_OPTIONS")`: `timeout` must be a non-negative finite integer, and `maxBuffer` must be a positive finite integer. | **Covered** — `runner.ts` "constructor rejects invalid timeout" and "constructor rejects invalid maxBuffer". |
| RUN-04C | Optional constructor `tokenMetric` must be an `LLMTokenMetric` instance. The runner stores it by reference as a metric dependency, separate from the frozen execution config, and uses it for `tokenCount(text)`. | **Covered** — `runner.ts` "custom token metric is stored by reference" and "tokenCount uses custom token metric". |
| RUN-04D | Invalid `tokenMetric` values throw `LLMRunnerError("INVALID_OPTIONS")`; when provided, `tokenMetric` must be an `LLMTokenMetric` instance. | **Covered** — `runner.ts` "constructor rejects invalid token metric". |
| RUN-04E | When omitted, `tokenMetric` defaults to a new base `LLMTokenMetric` instance. | **Covered** — `runner.ts` "default token metric is initialized". |

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
| RUN-09B | Child stdin is closed immediately after spawn. Runners do not use stdin for prompt delivery, and CLIs must observe EOF rather than an open pipe waiting for additional input. | **Covered** — `runner.ts` "child stdin is closed after spawn". |

### 2.3 Token Counting

```ts
async tokenCount(text: string): Promise<number>
```

| ID | Requirement | Status |
| --- | --- | --- |
| RUN-10 | Base implementation returns `Math.ceil(text.length / 4)`. | **Covered** — `runner.ts` "base tokenCount uses length over four approximation". |
| RUN-10A | `LLMTokenMetric` is a public concrete base class intended for subclassing. Its public `count(text)` method returns `Promise<number>` and delegates to protected `measure(text)` followed by protected `validateCount(measurement)`. `count()` is final by convention, not technically final in TypeScript. | **Covered** — `runner.ts` "base token metric uses length over four approximation", "custom token metric can validate rich measurements", and custom metric subclass tests. |
| RUN-10B | The base `measure(text)` implementation returns `Math.ceil(text.length / 4)`. | **Covered** — `runner.ts` "base token metric uses length over four approximation". |
| RUN-10C | `tokenMetric.count()` failures propagate unwrapped. | **Covered** — `runner.ts` "token metric failures propagate". |
| RUN-10D | Base `validateCount(measurement)` accepts only finite, non-negative integers and returns the validated number. | **Covered** — `runner.ts` "base token metric uses length over four approximation" and "base token metric rejects invalid measurements". |
| RUN-10E | Invalid metric measurements throw `LLMTokenMetricError("INVALID_COUNT")` with `data.measurement`. | **Covered** — `runner.ts` "base token metric rejects invalid measurements". |
| RUN-10F | Subclasses should override `measure()` for measurement logic and may override `validateCount()` when `measure()` returns a richer measurement shape. | **Documented** — Gap G-3. |

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
| RUN-14 | `LLMRunner.init()` without config is a compile-time error (base constructor requires `command`). | **Covered** — `tests/types/runnerInit.ts`; run with `npm run test:types`. |

## 3. Concrete Runners

### 3.1 ClaudeRunner

| ID | Requirement | Status |
| --- | --- | --- |
| CLR-01 | Default command is `claude`. | **Covered** — `claudeRunner.ts`. |
| CLR-02 | `DEFAULT_ARGS` are `--safe-mode --print`, placed before constructor args. | **Covered** — `claudeRunner.ts`. |
| CLR-03 | Per-run args are placed after constructor args and before the prompt. | **Covered** — `claudeRunner.ts`. |
| CLR-04 | `command`, `cwd`, `prefixArgs`, `args`, `timeout`, `maxBuffer`, `env`, and `tokenMetric` overrides are forwarded to the base class. | **Covered** — `claudeRunner.ts` command override tests, "forwards cwd override to base runner", "adds prefix args before safe mode defaults", and "forwards process controls to base runner". |

### 3.2 CodexRunner

| ID | Requirement | Status |
| --- | --- | --- |
| CXR-01 | Default command is `codex`. | **Covered** — `codexRunner.ts`. |
| CXR-02 | `DEFAULT_ARGS` are the sterile `exec` invocation (`exec --ignore-user-config --ignore-rules --ephemeral -c project_root_markers=[] -c project_doc_max_bytes=0 -c features.memories=false -c memories.use_memories=false`), placed before constructor args. | **Covered** — `codexRunner.ts`. |
| CXR-03 | Per-run args are placed after constructor args and before the prompt. | **Covered** — `codexRunner.ts`. |
| CXR-04 | `command`, `cwd`, `prefixArgs`, `args`, `timeout`, `maxBuffer`, `env`, and `tokenMetric` overrides are forwarded to the base class. | **Covered** — `codexRunner.ts` command override tests, "forwards cwd override to base runner", "adds prefix args before codex defaults", and "forwards process controls to base runner". |

### 3.3 CLI Parity

| ID | Requirement | Status |
| --- | --- | --- |
| PAR-01 | `ClaudeRunner.init().run(p)` is observably equivalent to `claude --safe-mode --print "p"` in a shell. | **Covered Live** — asserted by the opt-in `tests/parity/` suite when `CTG_AGENT_PROC_LIVE=1` and the Claude CLI/auth/model setup are available. |
| PAR-02 | `CodexRunner.init().run(p)` is observably equivalent to the sterile `codex exec ...` shell invocation. | **Covered Live** — asserted by the opt-in `tests/parity/` suite when `CTG_AGENT_PROC_LIVE=1` and the Codex CLI/auth/model setup are available. |

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

## 4A. LLMTokenMetricError

| ID | Requirement | Status |
| --- | --- | --- |
| TMERR-01 | `TYPES` is bidirectional for `INVALID_COUNT: 1001`. | **Covered** — `errorClass.ts` "token metric error types map is bidirectional". |
| TMERR-02 | Constructor assigns `name`, `type`, `msg`, `message`, `data`, and forwards `data.cause`. | **Covered** — `errorClass.ts` "token metric error constructor assigns public fields". |
| TMERR-03 | Constructing with an unknown type string throws. | **Covered** — `errorClass.ts` "token metric error constructor rejects unknown type". |
| TMERR-04 | `data` is frozen shallowly. | **Covered** — `errorClass.ts` "token metric error data is shallow frozen". |
| TMERR-05 | `is()` narrows correctly. | **Covered** — `errorClass.ts` "is narrows token metric errors". |
| TMERR-06 | `log()` default and custom-formatter behavior matches the runner and prompt error contracts. | **Covered** — `errorClass.ts` "token metric error log writes default output" and "token metric error log accepts custom formatter". |

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

`LLMPrompt` stores template operations as deferred `LLMPromptTemplateConfig`
data and instantiates `LLMPromptTemplate` only while resolving operations at
`run()` time.

| ID | Requirement | Status |
| --- | --- | --- |
| PRM-19 | `applyTemplate` transforms the prompt-so-far; `applyTemplateText` / `applyTemplateFile` transform the supplied text / file contents and append. | **Covered** — `prompt.ts` happy paths plus "applyTemplateFile read failures throw prompt error". |
| PRM-20 | Default delimiter is `[[ ]]`; custom delimiters are honored through `LLMPromptTemplate`. | **Covered** — `prompt.ts` "template supports custom delimiter". |
| PRM-21 | Delimiters containing regex metacharacters are escaped and treated literally through `LLMPromptTemplate`. | **Covered** — `prompt.ts` "template supports regex metacharacter delimiters". |
| PRM-22 | `strict: true` (default) lets `LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND")` propagate unchanged with `data.key` on an unresolved placeholder. | **Covered** — `prompt.ts` "strict template throws template error for unresolved placeholders". |
| PRM-23 | `strict: false` leaves unresolved placeholders unchanged. | **Covered** — `prompt.ts`. |
| PRM-24 | Extra template keys are ignored. | **Covered** — `prompt.ts` "template ignores extra keys". |
| PRM-25 | Number template values are stringified via `String()`. | **Covered** — `prompt.ts` "template stringifies number values". |
| PRM-26 | Repeated occurrences of the same placeholder are all replaced. | **Covered** — `prompt.ts` "template replaces repeated placeholders". |
| PRM-27 | Inherited object properties do not resolve placeholders (`hasOwnProperty` guard) — e.g. a `[[toString]]` placeholder with an empty template throws under strict mode rather than injecting `function toString() ...`. | **Covered** — `prompt.ts` "template does not resolve inherited object properties". |
| PRM-28 | Template delimiters must be a pair of non-empty distinct strings. Invalid delimiters throw `LLMPromptTemplateError("INVALID_OPTIONS")` when the deferred operation resolves. | **Covered** — `prompt.ts` "invalid template delimiters throw template error". |

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

## 7. LLMPromptTemplate

`LLMPromptTemplate` is an immutable, runner-independent template applicator.
It stores template values, delimiter config, and strict behavior, then applies
that config to any supplied text.

```ts
new LLMPromptTemplate(config?: LLMPromptTemplateConfig)
LLMPromptTemplate.init(config?: LLMPromptTemplateConfig): LLMPromptTemplate
template.apply(text: string): string
```

| ID | Requirement | Status |
| --- | --- | --- |
| PTM-01 | `DEFAULT_DELIMITER` is `[[ ]]`. | **Covered** — `promptTemplate.ts` "default delimiter replaces strict values". |
| PTM-02 | `init(config?)` returns a new `LLMPromptTemplate` equivalent to the constructor. | **Covered** — `promptTemplate.ts` "static init matches constructor behavior". |
| PTM-03 | Constructor values are copied into a frozen own-property object; mutating the caller's values object after construction does not affect rendering. | **Covered** — `promptTemplate.ts` "config is frozen and values are copied". |
| PTM-04 | Inherited value properties are ignored. | **Covered** — `promptTemplate.ts` "inherited value properties are ignored". |
| PTM-05 | Delimiter defaults to `[[ ]]`; custom delimiters are honored. | **Covered** — `promptTemplate.ts` "default delimiter replaces strict values" and "supports custom delimiter". |
| PTM-06 | Delimiters containing regex metacharacters are escaped and treated literally. | **Covered** — `promptTemplate.ts` "supports regex metacharacter delimiters". |
| PTM-07 | `strict` defaults to `true`; unresolved placeholders throw `LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND")` with `data.key`. | **Covered** — `promptTemplate.ts` "strict missing value throws template error". |
| PTM-08 | `strict: false` leaves unresolved placeholders unchanged. | **Covered** — `promptTemplate.ts` "non-strict missing value remains unchanged". |
| PTM-09 | Extra values are ignored. | **Covered** — `promptTemplate.ts` "extra values are ignored". |
| PTM-10 | Number values are stringified via `String()`. | **Covered** — `promptTemplate.ts` "number values are stringified". |
| PTM-11 | Repeated placeholders are all replaced. | **Covered** — `promptTemplate.ts` "repeated placeholders are all replaced". |
| PTM-12 | Placeholder keys are not trimmed. | **Covered** — `promptTemplate.ts` "placeholder keys are not trimmed". |
| PTM-13 | Template delimiters must be a pair of non-empty distinct strings. Invalid delimiters throw `LLMPromptTemplateError("INVALID_OPTIONS")` with `data.delimiter`. | **Covered** — `promptTemplate.ts` "invalid delimiter throws template error". |

## 8. LLMPromptTemplateError

| ID | Requirement | Status |
| --- | --- | --- |
| PTERR-01 | `TYPES` is bidirectional for `INVALID_OPTIONS: 1001`, `TEMPLATE_VALUE_NOT_FOUND: 1002`. | **Covered** — `errorClass.ts` "prompt template error types map is bidirectional" and `promptTemplate.ts` "error types map is bidirectional". |
| PTERR-02 | Constructor assigns `name`, `type`, `msg`, `message`, `data`, and forwards `data.cause`. | **Covered** — `errorClass.ts` "prompt template error constructor assigns public fields" and `promptTemplate.ts` "error constructor assigns public fields". |
| PTERR-03 | Constructing with an unknown type string throws. | **Covered** — `errorClass.ts` "prompt template error constructor rejects unknown type" and `promptTemplate.ts` "error constructor rejects unknown type". |
| PTERR-04 | `data` is frozen shallowly. | **Covered** — `errorClass.ts` "prompt template error data is shallow frozen" and `promptTemplate.ts` "error data is shallow frozen". |
| PTERR-05 | `is()` narrows correctly. | **Covered** — `errorClass.ts` "is narrows prompt template errors". |
| PTERR-06 | `log()` default and custom-formatter behavior matches the other structured error contracts. | **Covered** — `errorClass.ts` "prompt template error log writes default output" and "prompt template error log accepts custom formatter"; `promptTemplate.ts` error log tests. |

## 9. CTGAgentProc

`CTGAgentProc` is the orchestration layer over `hive-queue-js`.
It should subclass `HiveQueue` rather than wrap or reimplement queue
semantics. `HiveQueue` owns task routing, worker registration, CPS
continuation with `done()`, delegation with `send()`, queue halting, and shared
environment access. `CTGAgentProc` adds agent-specific runner and prompt
registries plus an `agent()` registration helper.

### 9.1 Upstream Queue Dependency

`hive-queue-js` v0.2.1 is consumed through its package name, `hive-queue`.
The package root exports the queue class plus public task/config/worker types,
including `HiveQueueWorkerProps`. `CTGAgentProcAgentFunction` extends
`HiveQueueWorkerProps` rather than duplicating Hive worker props.

Relevant upstream exports:

```ts
export { HiveQueue, HiveQueueError };

export type {
    HiveQueueWorkerProps,
    HiveQueueWorkerFunction,
    HiveQueueTask,
    HiveQueueConfig,
    HiveQueueEnv
};
```

### 9.2 Construction And Registries

Public shape:

```ts
class CTGAgentProc<Env = unknown> extends HiveQueue<Env> {
    runners: Map<string, LLMRunner>;
    prompts: Map<string, LLMPrompt>;

    runner(id: string, runner: LLMRunner): this;
    prompt(id: string, prompt: LLMPrompt): this;
    getPrompt(id: string): LLMPrompt;

    agent(
        agentID: string,
        runnerID: string,
        fn: CTGAgentProcAgentFunction<Env>
    ): this;

    static init<Env = unknown>(
        config?: CTGAgentProcConfig<Env>
    ): CTGAgentProc<Env>;
}

interface CTGAgentProcConfig<Env = unknown> extends HiveQueueConfig<Env> {
    runners?: Map<string, LLMRunner>;
    prompts?: Map<string, LLMPrompt>;
}
```

| ID | Requirement | Status |
| --- | --- | --- |
| AGP-01 | `CTGAgentProc` extends `HiveQueue`, preserving HiveQueue task routing, lifecycle, halting, and environment semantics. | **Covered** — `agentProc.ts` "constructor extends HiveQueue and initializes registries" and "agent receives Hive props and agent context". |
| AGP-02 | Constructor initializes `runners` and `prompts` maps when omitted. | **Covered** — `agentProc.ts` "constructor extends HiveQueue and initializes registries". |
| AGP-02A | Constructor accepts provided `runners` and `prompts` maps by reference. | **Covered** — `agentProc.ts` "constructor accepts provided registries". |
| AGP-02B | `CTGAgentProc.init(config?)` returns a `CTGAgentProc` instance. | **Covered** — `agentProc.ts` "static init returns CTGAgentProc". |
| AGP-03 | `runner(id, runner)` registers a named `LLMRunner` and returns `this`. | **Covered** — `agentProc.ts` "runner registers and returns processor". |
| AGP-04 | Duplicate runner IDs throw `CTGAgentProcError("RUNNER_ALREADY_BOUND")`. | **Covered** — `agentProc.ts` "duplicate runner id throws agent proc error". |
| AGP-05 | `prompt(id, prompt)` registers a named `LLMPrompt` and returns `this`. | **Covered** — `agentProc.ts` "prompt registers and returns processor". |
| AGP-06 | Duplicate prompt IDs throw `CTGAgentProcError("PROMPT_ALREADY_BOUND")`. | **Covered** — `agentProc.ts` "duplicate prompt id throws agent proc error". |
| AGP-07 | `getPrompt(id)` returns the registered prompt for `id`. | **Covered** — `agentProc.ts` "prompt registers and returns processor". |
| AGP-08 | `getPrompt(id)` throws `CTGAgentProcError("UNKNOWN_PROMPT")` for an unknown prompt ID. | **Covered** — `agentProc.ts` "unknown prompt throws agent proc error". |

### 9.3 Agent Registration

`agent(agentID, runnerID, fn)` registers a Hive worker under `agentID`. The
agent function receives the normal Hive worker props plus agent-specific
context.

Agent function shape:

```ts
type CTGAgentProcAgentFunction<Env = unknown> = (
    props: HiveQueueWorkerProps<Env> & {
        agentID: string;
        runnerID: string;
        runner: LLMRunner;
        getPrompt(id: string): LLMPrompt;
    }
) => Promise<void>;
```

| ID | Requirement | Status |
| --- | --- | --- |
| AGP-09 | `agent(agentID, runnerID, fn)` validates that `runnerID` is already registered and fails fast if it is not. | **Covered** — `agentProc.ts` "agent rejects unknown runner before worker registration". |
| AGP-10 | Unknown runner IDs passed to `agent()` throw `CTGAgentProcError("UNKNOWN_RUNNER")`. | **Covered** — `agentProc.ts` "agent rejects unknown runner before worker registration". |
| AGP-11 | `agent()` delegates worker registration to `HiveQueue.worker(agentID, wrappedFn)` and returns `this`. | **Covered** — `agentProc.ts` "agent registers a HiveQueue worker and returns processor". |
| AGP-12 | Duplicate `agentID` handling follows `HiveQueue.worker()` duplicate worker behavior. | **Covered** — `agentProc.ts` "agent delegates duplicate agent ids to HiveQueue worker behavior". |
| AGP-13 | The wrapped agent function receives all normal Hive worker props unchanged. | **Covered** — `agentProc.ts` "agent receives Hive props and agent context". |
| AGP-14 | The wrapped agent function receives `agentID`, `runnerID`, the registered `runner` instance, and `getPrompt(id)`. | **Covered** — `agentProc.ts` "agent receives Hive props and agent context". |
| AGP-15 | `runner` is injected as the registered `LLMRunner` instance rather than as a convenience wrapper. | **Covered** — `agentProc.ts` "agent receives Hive props and agent context". |
| AGP-16 | Prompt access inside agent functions goes through `getPrompt(id)` rather than exposing the raw prompt map. | **Covered** — `agentProc.ts` "agent receives Hive props and agent context". |
| AGP-17 | Agents can delegate tasks to other registered agents through the inherited Hive `send()`/`done()` continuation flow. | **Covered** — `orchestration/agentProc.ts` "delegates between registered agents". |
| AGP-18 | Multiple delegated agent tasks preserve HiveQueue FIFO task order. | **Covered** — `orchestration/agentProc.ts` "preserves delegated FIFO order". |
| AGP-19 | Agent functions can run a registered `LLMPrompt` with the injected registered `LLMRunner`. | **Covered** — `orchestration/agentProc.ts` "runs registered prompt with injected runner". |
| AGP-20 | `getPrompt()` lookup failures thrown during agent execution halt the queue with `CTGAgentProcError("UNKNOWN_PROMPT")`. | **Covered** — `orchestration/agentProc.ts` "prompt lookup failures halt with agent proc error". |
| AGP-21 | Agents can use inherited Hive `getEnv()`/`setEnv()` shared state to track retry counts across delegated attempts. | **Covered** — `orchestration/agentProc.ts` "stores retry count in env". |

### 9.4 CTGAgentProcError

`CTGAgentProc` has its own structured error class for registration and lookup
failures that are not native `HiveQueueError` cases.

Error types:

```text
RUNNER_ALREADY_BOUND
PROMPT_ALREADY_BOUND
UNKNOWN_RUNNER
UNKNOWN_PROMPT
```

| ID | Requirement | Status |
| --- | --- | --- |
| AGPERR-01 | `CTGAgentProcError` follows the existing structured error pattern used by runner, prompt, template, and token metric errors. | **Covered** — `errorClass.ts` agent proc error tests. |
| AGPERR-02 | Duplicate runner and prompt registration failures throw `CTGAgentProcError`, not `HiveQueueError`. | **Covered** — `agentProc.ts` duplicate runner/prompt tests. |
| AGPERR-03 | Unknown runner and prompt lookup failures throw `CTGAgentProcError`, not `HiveQueueError`. | **Covered** — `agentProc.ts` unknown runner/prompt tests. |

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

### G-2. Live CLI parity tests — resolved with opt-in coverage

The concrete runner defaults (`--safe-mode --print`; the sterile `codex exec`
config set) are covered by an opt-in live suite under `tests/parity/`. The
suite is gated by `CTG_AGENT_PROC_LIVE=1`, excluded from the default hermetic
`npm test` path, and validates observable CLI-boundary behavior against direct
Claude and Codex CLI invocations when the required CLI/auth/model setup is
available.

The suite also covers prompt-operation integration, filesystem side effects,
web-search parity, timeout behavior, version capture, runner selection, extra
runner args, and watchdog isolation. Completed machine-local runs are tracked
in `docs/ROADMAP.md` Phase 1.

Vendor CLI flag churn remains a standing maintenance risk. Future failures in
the live suite may indicate local setup drift, model variance, vendor CLI
changes, or a runner regression; the test output is intended to make those
cases diagnosable.

### G-3. Token counting strategy — resolved for v0.1

The base runner uses a default `LLMTokenMetric` instance whose public
`count(text)` method returns a validated token count. Runner instances may be
configured with a custom subclass instance:

```ts
export class LLMTokenMetric {
    async count(text: string): Promise<number>;
    protected async measure(text: string): Promise<unknown>;
    protected validateCount(measurement: unknown): number;
}
```

`count(text)` is final by convention, not technically final in TypeScript. It
delegates to protected `measure(text)` and then to protected
`validateCount(measurement)`.

Subclasses should override `measure()` for measurement logic. Subclasses may
override `validateCount()` when `measure()` returns a richer measurement shape,
such as a JSON object containing several token-related metrics.

The base `measure(text)` returns `Math.ceil(text.length / 4)`. The base
`validateCount()` accepts only finite, non-negative integers. Invalid
measurements throw `LLMTokenMetricError("INVALID_COUNT")`.

`LLMRunner.tokenCount(text)` remains the public runner counting method and
delegates to the configured metric. Metric errors propagate unchanged.

v0.1 does not add tokenizer dependencies or require exact model token counts.
Metric implementations are responsible for their own approximation/exactness
policy, including validating their own returned counts.

If subclassing becomes cumbersome for common use cases, future work may add a
function-backed metric subclass while preserving the class-based runner
contract.

### G-4. Summarization contract — resolved

The fixed base summary prompt wording is an implementation detail, not public
contract. `LLMRunner.summarize(text)` is an overridable convenience hook: it
invokes the same runner once with a summary-oriented prompt containing `text`
and returns `result` from `run()`.

Future consideration: a runner-level summary template could make this behavior
configurable without subclassing. If added, it should reuse the
`LLMPromptTemplate` abstraction rather than duplicating template behavior in
`LLMRunner`.

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

### G-7A. Child stdin disposition — resolved

`LLMRunner.exec()` closes child stdin immediately after spawning the runner
process. Prompt delivery remains argv-based: the prompt is always the final
argv element, and stdin is not used as an additional prompt channel.

This avoids mode changes in CLIs that inspect non-TTY stdin and wait for
additional piped input when the pipe remains open.

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

`CTGAgentProc` now has a testable public surface and is covered by conformance,
type, and orchestration suites. Local-model runner design remains future
roadmap work, with `OllamaRunner` tracked separately under Additional
Considerations.

---

# Part III — Suggested Test Backlog

Ordered so the suite hardens the *decided* contract first. All items are
hermetic (no live CLIs) unless noted.

1. **Maintain opt-in live parity and integration coverage** — PAR-01/02 are
   covered by the `CTG_AGENT_PROC_LIVE=1` suite, but this remains an ongoing
   maintenance area because external CLI flags, auth, and model behavior can
   drift.
