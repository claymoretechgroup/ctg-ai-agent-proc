# CodexRunner

Class that configures `LLMRunner` for sterile `codex exec` invocations. It
uses `codex` as the default command and disables user config, rules, memories,
and project document loading through default args.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _config | llmRunnerConfig | Inherited frozen child-process execution config |
| _tokenMetric | llmTokenMetric | Inherited token counting dependency |

### CONSTRUCTOR :: ?partialLlmRunnerConfig -> codexRunner

Creates a Codex runner. Any provided process-control or argument fields are
forwarded to `LLMRunner`; omitted `command` defaults to `codex`.

```ts
const runner = new CodexRunner({
    cwd: "/some/project"
});
```

### CodexRunner.init :: ?partialLlmRunnerConfig -> codexRunner

Static factory inherited from `LLMRunner`. Returns a `CodexRunner` instance.

```ts
const runner = CodexRunner.init({
    args: ["--model", "gpt-5-codex"]
});
```

### codexRunner.run :: STRING, ?llmRunnerRunConfig -> PROMISE<llmRunnerResult>

Runs `codex exec` with the sterile default args and the prompt as the final
argv element. Per-run args are placed after constructor args and before the
prompt.

```ts
const result = await runner.run("Inspect this repository.");
```

### codexRunner.tokenCount :: STRING -> PROMISE<INT>

Returns the token count reported by the configured token metric.

```ts
const count = await runner.tokenCount("hello world");
```

### codexRunner.summarize :: STRING -> PROMISE<STRING>

Runs a summary-oriented prompt through the same runner and returns stdout.

```ts
const summary = await runner.summarize(longText);
```
