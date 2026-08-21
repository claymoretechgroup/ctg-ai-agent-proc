# LLMPrompt

Class that implements a reusable prompt builder. Prompt instances store
operations and resolve them only when `run(runner)` is called.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _config | llmPromptOptions | Frozen prompt builder config |
| _operations | [llmPromptOperation] | Ordered prompt operations |
| _cachedPrompt | ?STRING | Cached resolved prompt when caching is enabled |

### CONSTRUCTOR :: ?STRING, ?llmPromptOptions -> llmPrompt

Creates a prompt builder. A non-empty initial string is stored as the first
append operation. An empty or omitted string stores no operation.

```ts
const prompt = new LLMPrompt("Review this file:\n");
```

### LLMPrompt.init :: ?STRING, ?llmPromptOptions -> llmPrompt

Static factory that creates an `LLMPrompt` instance.

```ts
const prompt = LLMPrompt.init("Review:\n", {
    cache: true
});
```

### llmPrompt.append :: STRING -> SELF

Appends literal text to the prompt at resolve time. Chainable.

```ts
const prompt = new LLMPrompt()
    .append("Review this change.");
```

### llmPrompt.appendFile :: STRING -> SELF

Appends UTF-8 file contents at resolve time. Read failures throw
`LLMPromptError("READ_FAILED")`. Chainable.

```ts
const prompt = new LLMPrompt("Review:\n")
    .appendFile("src/index.ts");
```

### llmPrompt.summarize :: VOID -> SELF

Replaces the prompt-so-far with `runner.summarize(promptSoFar)` at resolve
time. Chainable.

```ts
const prompt = new LLMPrompt(longText)
    .summarize();
```

### llmPrompt.summarizeText :: STRING -> SELF

Appends the summary of the supplied text at resolve time. Chainable.

```ts
const prompt = new LLMPrompt()
    .summarizeText(longText);
```

### llmPrompt.summarizeFile :: STRING -> SELF

Reads a UTF-8 file and appends its summary at resolve time. Read failures throw
`LLMPromptError("READ_FAILED")`. Chainable.

```ts
const prompt = new LLMPrompt()
    .summarizeFile("notes.md");
```

### llmPrompt.truncate :: INT -> SELF

Truncates the prompt-so-far to the longest prefix within the token budget.
Invalid budgets throw `LLMPromptError("INVALID_OPTIONS")`. Chainable.

```ts
const prompt = new LLMPrompt(longText)
    .truncate(4_000);
```

### llmPrompt.truncateText :: STRING, INT -> SELF

Truncates supplied text to the token budget and appends it. Chainable.

```ts
const prompt = new LLMPrompt()
    .truncateText(longText, 500);
```

### llmPrompt.truncateFile :: STRING, INT -> SELF

Reads a UTF-8 file, truncates its contents to the token budget, and appends the
result. Read failures throw `LLMPromptError("READ_FAILED")`. Chainable.

```ts
const prompt = new LLMPrompt()
    .truncateFile("notes.md", 500);
```

### llmPrompt.applyTemplate :: ?llmPromptTemplateValues, ?llmPromptTemplateOptions -> SELF

Applies template values to the prompt-so-far at resolve time. Chainable.

```ts
const prompt = new LLMPrompt("Hello [[name]].")
    .applyTemplate({ name: "Ada" });
```

### llmPrompt.applyTemplateText :: STRING, ?llmPromptTemplateValues, ?llmPromptTemplateOptions -> SELF

Applies template values to supplied text and appends the result. Chainable.

```ts
const prompt = new LLMPrompt()
    .applyTemplateText("Hello [[name]].", { name: "Ada" });
```

### llmPrompt.applyTemplateFile :: STRING, ?llmPromptTemplateValues, ?llmPromptTemplateOptions -> SELF

Reads a UTF-8 file, applies template values to its contents, and appends the
result. Read failures throw `LLMPromptError("READ_FAILED")`. Chainable.

```ts
const prompt = new LLMPrompt()
    .applyTemplateFile("template.txt", { name: "Ada" });
```

### llmPrompt.join :: llmPrompt -> SELF

Resolves another prompt with the same runner and appends its result. Chainable.

```ts
const prompt = new LLMPrompt("A")
    .join(new LLMPrompt("B"));
```

### llmPrompt.run :: llmRunner, ?llmRunnerRunConfig -> PROMISE<llmRunnerResult>

Resolves all stored operations, sends the resulting prompt to the runner, and
returns the runner result.

```ts
const result = await prompt.run(runner);
```

### llmPrompt.resetCache :: VOID -> SELF

Clears the resolved prompt cache. Throws `LLMPromptError("INVALID_OPTIONS")`
when caching is not enabled. Chainable.

```ts
prompt.resetCache();
```
