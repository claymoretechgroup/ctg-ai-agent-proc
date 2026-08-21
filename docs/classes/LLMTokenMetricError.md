# LLMTokenMetricError

Class that represents structured token metric validation failures.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| name | STRING | Error class name, always `LLMTokenMetricError` |
| type | STRING | Symbolic error type |
| msg | STRING | Human-readable error message |
| message | STRING | Standard Error message, equal to `msg` |
| data | llmTokenMetricErrorData | Shallow-frozen structured error data |
| cause | ANY | Optional native cause passed to `Error` |

### Error Codes

| Code | Type | Description |
|------|------|-------------|
| 1001 | INVALID_COUNT | Token metric measurement is not a finite non-negative integer |

### CONSTRUCTOR :: STRING, STRING, ?llmTokenMetricErrorData -> llmTokenMetricError

Creates a structured token metric error. The first string must be a known error
type. Unknown type strings throw a plain `Error`.

```ts
const error = new LLMTokenMetricError("INVALID_COUNT", "Invalid count.", {
    measurement: -1
});
```

### llmTokenMetricError.log :: ?(llmTokenMetricError -> STRING) -> STRING

Writes formatted error details to `console.error` and returns the written
string.

```ts
error.log((value) => `${value.type}:${value.data.measurement}`);
```

### LLMTokenMetricError.formatLog :: llmTokenMetricError -> STRING

Formats error details as JSON without writing them.

```ts
const output = LLMTokenMetricError.formatLog(error);
```

### LLMTokenMetricError.is :: ANY -> BOOL

Returns true when the value is an `LLMTokenMetricError` instance.

```ts
LLMTokenMetricError.is(error);
```

### LLMTokenMetricError.isType :: STRING -> BOOL

Returns true when the string is a known token metric error type.

```ts
LLMTokenMetricError.isType("INVALID_COUNT");
```
