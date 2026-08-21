# LLMRunnerError

Class that represents structured runner construction and child-process
failures.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| name | STRING | Error class name, always `LLMRunnerError` |
| type | STRING | Symbolic error type |
| msg | STRING | Human-readable error message |
| message | STRING | Standard Error message, equal to `msg` |
| data | llmRunnerErrorData | Shallow-frozen structured error data |
| cause | ANY | Optional native cause passed to `Error` |

### Error Codes

| Code | Type | Description |
|------|------|-------------|
| 1001 | INVALID_OPTIONS | Runner config is invalid |
| 1002 | COMMAND_NOT_FOUND | Configured command could not be found |
| 1003 | COMMAND_FAILED | Configured command failed after spawning |

### CONSTRUCTOR :: STRING, STRING, ?llmRunnerErrorData -> llmRunnerError

Creates a structured runner error. The first string must be a known error
type. Unknown type strings throw a plain `Error`.

```ts
const error = new LLMRunnerError("COMMAND_FAILED", "Command failed.", {
    command: "tool",
    exitCode: 1
});
```

### llmRunnerError.log :: ?(llmRunnerError -> STRING) -> STRING

Writes formatted error details to `console.error` and returns the written
string.

```ts
error.log((value) => `${value.type}:${value.data.command}`);
```

### LLMRunnerError.formatLog :: llmRunnerError -> STRING

Formats error details as JSON without writing them.

```ts
const output = LLMRunnerError.formatLog(error);
```

### LLMRunnerError.is :: ANY -> BOOL

Returns true when the value is an `LLMRunnerError` instance.

```ts
if (LLMRunnerError.is(error)) {
    console.error(error.type);
}
```

### LLMRunnerError.isType :: STRING -> BOOL

Returns true when the string is a known runner error type.

```ts
LLMRunnerError.isType("COMMAND_FAILED");
```
