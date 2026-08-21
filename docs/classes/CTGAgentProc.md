# CTGAgentProc

Class that implements multi-agent orchestration over `HiveQueue`. It extends
`HiveQueue` and adds runner and prompt registries plus an `agent()` helper that
injects LLM-specific context into normal Hive worker props.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| workers | {STRING: hiveQueueWorkerFunction} | Inherited HiveQueue worker registry |
| tasks | [hiveQueueTask] | Inherited HiveQueue task queue |
| env | ENV | Inherited shared mutable environment |
| isActive | BOOL | Whether the inherited queue is currently processing tasks |
| haltFn | hiveQueueHaltingFunction | Inherited queue halt handler |
| runners | {STRING: llmRunner} | Registered LLM runners keyed by runner ID |
| prompts | {STRING: llmPrompt} | Registered prompts keyed by prompt ID |

### CONSTRUCTOR :: ?ctgAgentProcConfig -> ctgAgentProc

Creates an agent processor. The config accepts all `HiveQueueConfig` fields and
optional `runners` and `prompts` maps. Provided maps are stored by reference;
omitted maps are initialized empty.

```ts
const proc = new CTGAgentProc({
    env: { retries: 0 }
});
```

### CTGAgentProc.init :: ?ctgAgentProcConfig -> ctgAgentProc

Static factory that creates a `CTGAgentProc` instance. This is equivalent to
calling the constructor directly.

```ts
const proc = CTGAgentProc.init({
    env: { retries: 0 }
});
```

### ctgAgentProc.runner :: STRING, llmRunner -> SELF

Registers a runner under a runner ID. Throws
`CTGAgentProcError("RUNNER_ALREADY_BOUND")` when the ID is already registered.
Chainable.

```ts
const proc = CTGAgentProc.init()
    .runner("codex", CodexRunner.init());
```

### ctgAgentProc.prompt :: STRING, llmPrompt -> SELF

Registers a prompt under a prompt ID. Throws
`CTGAgentProcError("PROMPT_ALREADY_BOUND")` when the ID is already registered.
Chainable.

```ts
const proc = CTGAgentProc.init()
    .prompt("review", new LLMPrompt("Review this change."));
```

### ctgAgentProc.getPrompt :: STRING -> llmPrompt

Returns a registered prompt by ID. Throws
`CTGAgentProcError("UNKNOWN_PROMPT")` when no prompt is registered for the ID.

```ts
const prompt = proc.getPrompt("review");
```

### ctgAgentProc.agent :: STRING, STRING, ctgAgentProcAgentFunction -> SELF

Registers an agent function as a HiveQueue worker. The first string is the
agent ID. The second string is the runner ID, which must already be
registered. Duplicate agent IDs follow HiveQueue worker registration behavior.
Chainable.

```ts
const proc = CTGAgentProc.init()
    .runner("codex", CodexRunner.init())
    .prompt("review", new LLMPrompt("Review this change."))
    .agent("reviewer", "codex", async ({ runner, getPrompt, halt }) => {
        const result = await getPrompt("review").run(runner);

        await halt(result.result);
    });
```

### ctgAgentProc.start :: {to: STRING, data: ANY} -> PROMISE<VOID>

Inherited from `HiveQueue`. Starts queue processing by sending the initial task
to the named worker. Agent functions should call `done()` to continue
processing or `halt(value)` to stop the queue.

```ts
await proc.start({
    to: "reviewer",
    data: null
});
```
