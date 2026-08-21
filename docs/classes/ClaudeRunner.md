# ClaudeRunner

Class that configures `LLMRunner` for the Claude CLI. It uses `claude` as the
default command and adds `--safe-mode --print` before constructor args.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _config | llmRunnerConfig | Inherited frozen child-process execution config |
| _tokenMetric | llmTokenMetric | Inherited token counting dependency |

### CONSTRUCTOR :: ?partialLlmRunnerConfig -> claudeRunner

Creates a Claude runner. Any provided process-control or argument fields are
forwarded to `LLMRunner`; omitted `command` defaults to `claude`.

```ts
const runner = new ClaudeRunner({
    cwd: "/some/project"
});
```

### ClaudeRunner.init :: ?partialLlmRunnerConfig -> claudeRunner

Static factory inherited from `LLMRunner`. Returns a `ClaudeRunner` instance.

```ts
const runner = ClaudeRunner.init({
    args: ["--model", "some-model"]
});
```

### claudeRunner.run :: STRING, ?llmRunnerRunConfig -> PROMISE<llmRunnerResult>

Runs the Claude CLI with the prompt as the final argv element. Per-run args are
placed after constructor args and before the prompt.

```ts
const result = await runner.run("Return exactly CLEAN.");
```

### claudeRunner.tokenCount :: STRING -> PROMISE<INT>

Returns the token count reported by the configured token metric.

```ts
const count = await runner.tokenCount("hello world");
```

### claudeRunner.summarize :: STRING -> PROMISE<STRING>

Runs a summary-oriented prompt through the same runner and returns stdout.

```ts
const summary = await runner.summarize(longText);
```
