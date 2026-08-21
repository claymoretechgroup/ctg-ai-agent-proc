# CTGAgentProcError

Class that represents structured AgentProc registry errors. It is used for
runner and prompt registration or lookup failures; native HiveQueue worker
errors remain `HiveQueueError`.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| name | STRING | Error class name, always `CTGAgentProcError` |
| type | STRING | Symbolic error type |
| msg | STRING | Human-readable error message |
| message | STRING | Standard Error message, equal to `msg` |
| data | ctgAgentProcErrorData | Shallow-frozen structured error data |
| cause | ANY | Optional native cause passed to `Error` |

### Error Codes

| Code | Type | Description |
|------|------|-------------|
| 1001 | RUNNER_ALREADY_BOUND | Runner ID is already registered |
| 1002 | PROMPT_ALREADY_BOUND | Prompt ID is already registered |
| 1003 | UNKNOWN_RUNNER | Agent registration referenced an unknown runner ID |
| 1004 | UNKNOWN_PROMPT | Prompt lookup referenced an unknown prompt ID |

### CONSTRUCTOR :: STRING, STRING, ?ctgAgentProcErrorData -> ctgAgentProcError

Creates a structured AgentProc error. The first string must be a known error
type. Unknown type strings throw a plain `Error`.

```ts
const error = new CTGAgentProcError("UNKNOWN_RUNNER", "Missing runner.", {
    agentID: "reviewer",
    runnerID: "codex"
});
```

### ctgAgentProcError.log :: ?(ctgAgentProcError -> STRING) -> STRING

Writes formatted error details to `console.error` and returns the written
string. When no formatter is supplied, the error is formatted as JSON.

```ts
error.log((value) => `${value.type}:${value.msg}`);
```

### CTGAgentProcError.formatLog :: ctgAgentProcError -> STRING

Formats error details as JSON without writing them. This is the default
formatter used by `log()`.

```ts
const output = CTGAgentProcError.formatLog(error);
```

### CTGAgentProcError.is :: ANY -> BOOL

Returns true when the value is a `CTGAgentProcError` instance.

```ts
if (CTGAgentProcError.is(error)) {
    console.error(error.type);
}
```

### CTGAgentProcError.isType :: STRING -> BOOL

Returns true when the string is a known AgentProc error type.

```ts
if (CTGAgentProcError.isType("UNKNOWN_PROMPT")) {
    console.error("known type");
}
```
