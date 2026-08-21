# LLMRunner

Class that invokes an LLM CLI with a prompt as the final argv element. Concrete
subclasses provide default commands and default args.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _config | llmRunnerConfig | Frozen child-process execution config |
| _tokenMetric | llmTokenMetric | Token counting dependency used by `tokenCount()` |

### CONSTRUCTOR :: llmRunnerConfig -> llmRunner

Creates a runner for the configured CLI command. The command must be a
non-empty string. Constructor args are copied and stored with subclass default
args in the final argv order.

```ts
const runner = new LLMRunner({
    command: "my-llm-cli",
    cwd: "/some/project",
    args: ["--json"]
});
```

### LLMRunner.init :: llmRunnerConfig -> llmRunner

Static factory that creates an `LLMRunner` instance. Base `LLMRunner.init()`
requires config because the base constructor requires `command`.

```ts
const runner = LLMRunner.init({
    command: "my-llm-cli"
});
```

### llmRunner.run :: STRING, ?llmRunnerRunConfig -> PROMISE<llmRunnerResult>

Runs the configured command and returns captured stdout and stderr as
`{ result, error }`. The prompt is always appended as the final argv element.

```ts
const result = await runner.run("Summarize this project.", {
    args: ["--verbose"]
});
```

### llmRunner.tokenCount :: STRING -> PROMISE<INT>

Returns the token count reported by the configured `LLMTokenMetric`. The base
metric uses `Math.ceil(text.length / 4)`.

```ts
const count = await runner.tokenCount("hello world");
```

### llmRunner.summarize :: STRING -> PROMISE<STRING>

Runs a summary-oriented prompt through the same runner and returns stdout.
Exact summary prompt wording is not part of the public contract.

```ts
const summary = await runner.summarize(longText);
```
