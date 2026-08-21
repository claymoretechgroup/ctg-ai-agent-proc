# ctg-ai-agent-proc

`ctg-ai-agent-proc` is a TypeScript library for composing LLM prompts,
invoking coding-agent CLIs, and orchestrating named agents through an
asynchronous task queue.

The package has three main layers:

- `LLMRunner` and concrete CLI runners: `ClaudeRunner`, `CodexRunner`
- `LLMPrompt` and `LLMPromptTemplate` for reusable prompt construction
- `CTGAgentProc` for multi-agent orchestration over `hive-queue`

The source-of-truth behavior is captured in [docs/spec.md](./docs/spec.md).
Class-level API documentation is available in
[docs/classes](./docs/classes/index.md).

## Install

Install from GitHub:

```sh
npm install github:claymoretechgroup/ctg-ai-agent-proc
```

`hive-queue` is currently consumed from GitHub as well. It is intentionally not
an npm dependency at this time.

## Runners

Runners invoke the underlying CLI with the prompt as the final argv element and
return captured stdout/stderr as `{ result, error }`.

```ts
import { ClaudeRunner, CodexRunner } from "ctg-ai-agent-proc";

const claude = ClaudeRunner.init({
    cwd: "/some/project"
});

const claudeResult = await claude.run("Return exactly the word CLEAN.");
console.log(claudeResult.result);

const codex = CodexRunner.init({
    cwd: "/some/project"
});

const codexResult = await codex.run("Summarize the current project.");
console.log(codexResult.result);
```

Extra CLI arguments can be supplied at construction time or per run:

```ts
const result = await CodexRunner.init({
    args: ["--some-constructor-flag"]
}).run("Inspect this repository.", {
    args: ["--some-run-flag"]
});
```

## Prompts

`LLMPrompt` stores prompt operations and resolves them only when `run(runner)`
is called.

```ts
import { LLMPrompt, CodexRunner } from "ctg-ai-agent-proc";

const runner = CodexRunner.init({ cwd: "/some/project" });
const prompt = new LLMPrompt("Review this file:\n")
    .appendFile("src/index.ts")
    .truncate(4_000);

const result = await prompt.run(runner);
console.log(result.result);
```

Template placeholders use `[[name]]` delimiters by default:

```ts
const prompt = new LLMPrompt("Write release notes for [[version]].")
    .applyTemplate({ version: "v0.1.0" });
```

## Agent Orchestration

`CTGAgentProc` subclasses `HiveQueue`. It keeps HiveQueue's task routing,
`send()` delegation, `done()` continuation, `halt()` lifecycle, and shared
`env` behavior, while adding runner and prompt registries for agent functions.

```ts
import {
    CTGAgentProc,
    CodexRunner,
    LLMPrompt
} from "ctg-ai-agent-proc";

type Env = {
    retries: number;
};

const proc = CTGAgentProc.init<Env>({
    env: { retries: 0 },
    onHalt: async (value) => {
        console.log(value);
    }
})
    .runner("codex", CodexRunner.init({ cwd: "/some/project" }))
    .prompt("review", new LLMPrompt("Review the current implementation."))
    .agent("reviewer", "codex", async ({
        runner,
        getPrompt,
        getEnv,
        setEnv,
        send,
        done,
        halt
    }) => {
        const result = await getPrompt("review").run(runner);

        if (result.result.includes("RETRY") && getEnv().retries < 2) {
            setEnv((env) => ({ retries: env.retries + 1 }));
            await send("reviewer", null);
            await done();
            return;
        }

        await halt(result.result);
    });

await proc.start({
    to: "reviewer",
    data: null
});
```

Inside an agent function:

- `runner` is the registered `LLMRunner` instance for that agent.
- `getPrompt(id)` returns a registered `LLMPrompt`.
- `send(id, value)`, `done()`, `halt(value)`, `getEnv()`, and `setEnv(fn)` are inherited Hive worker props.
- Unknown runners/prompts and duplicate runner/prompt registrations use `CTGAgentProcError`.

## Tests

```sh
npm run check
npm run test:types
npm test
npm run test:orchestration
npm run build:package
```

The test suites are split by purpose:

- `npm test`: hermetic conformance for public API contracts
- `npm run test:types`: type-only compile fixtures
- `npm run test:orchestration`: hermetic multi-agent workflow scenarios
- `npm run test:parity`: opt-in live CLI parity tests for Claude/Codex setups

Live parity tests depend on local CLI installation, authentication, and vendor
behavior. They are not part of the default hermetic suite.
