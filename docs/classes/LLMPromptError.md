# LLMPromptError

Class that represents structured prompt construction and resolution failures
owned by `LLMPrompt`.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| name | STRING | Error class name, always `LLMPromptError` |
| type | STRING | Symbolic error type |
| msg | STRING | Human-readable error message |
| message | STRING | Standard Error message, equal to `msg` |
| data | llmPromptErrorData | Shallow-frozen structured error data |
| cause | ANY | Optional native cause passed to `Error` |

### Error Codes

| Code | Type | Description |
|------|------|-------------|
| 1001 | INVALID_OPTIONS | Prompt operation options are invalid |
| 1002 | TEMPLATE_VALUE_NOT_FOUND | Template value was not found for a placeholder |
| 1003 | READ_FAILED | Prompt file read failed |
| 1004 | UNKNOWN_OPERATION | Stored prompt operation type is unknown |

### CONSTRUCTOR :: STRING, STRING, ?llmPromptErrorData -> llmPromptError

Creates a structured prompt error. The first string must be a known error type.
Unknown type strings throw a plain `Error`.

```ts
const error = new LLMPromptError("READ_FAILED", "Read failed.", {
    path: "prompt.txt"
});
```

### llmPromptError.log :: ?(llmPromptError -> STRING) -> STRING

Writes formatted error details to `console.error` and returns the written
string.

```ts
error.log((value) => `${value.type}:${value.data.path}`);
```

### LLMPromptError.formatLog :: llmPromptError -> STRING

Formats error details as JSON without writing them.

```ts
const output = LLMPromptError.formatLog(error);
```

### LLMPromptError.is :: ANY -> BOOL

Returns true when the value is an `LLMPromptError` instance.

```ts
LLMPromptError.is(error);
```

### LLMPromptError.isType :: STRING -> BOOL

Returns true when the string is a known prompt error type.

```ts
LLMPromptError.isType("READ_FAILED");
```
