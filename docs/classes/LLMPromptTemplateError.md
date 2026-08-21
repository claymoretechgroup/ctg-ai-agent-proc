# LLMPromptTemplateError

Class that represents structured template configuration and placeholder
resolution failures.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| name | STRING | Error class name, always `LLMPromptTemplateError` |
| type | STRING | Symbolic error type |
| msg | STRING | Human-readable error message |
| message | STRING | Standard Error message, equal to `msg` |
| data | llmPromptTemplateErrorData | Shallow-frozen structured error data |
| cause | ANY | Optional native cause passed to `Error` |

### Error Codes

| Code | Type | Description |
|------|------|-------------|
| 1001 | INVALID_OPTIONS | Template delimiter config is invalid |
| 1002 | TEMPLATE_VALUE_NOT_FOUND | Template value was not found for a placeholder |

### CONSTRUCTOR :: STRING, STRING, ?llmPromptTemplateErrorData -> llmPromptTemplateError

Creates a structured template error. The first string must be a known error
type. Unknown type strings throw a plain `Error`.

```ts
const error = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
    key: "name"
});
```

### llmPromptTemplateError.log :: ?(llmPromptTemplateError -> STRING) -> STRING

Writes formatted error details to `console.error` and returns the written
string.

```ts
error.log((value) => `${value.type}:${value.data.key}`);
```

### LLMPromptTemplateError.formatLog :: llmPromptTemplateError -> STRING

Formats error details as JSON without writing them.

```ts
const output = LLMPromptTemplateError.formatLog(error);
```

### LLMPromptTemplateError.is :: ANY -> BOOL

Returns true when the value is an `LLMPromptTemplateError` instance.

```ts
LLMPromptTemplateError.is(error);
```

### LLMPromptTemplateError.isType :: STRING -> BOOL

Returns true when the string is a known template error type.

```ts
LLMPromptTemplateError.isType("INVALID_OPTIONS");
```
