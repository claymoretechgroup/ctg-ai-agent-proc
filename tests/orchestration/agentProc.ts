import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import {
    CTGAgentProc,
    CTGAgentProcError,
    LLMPrompt,
    LLMRunner
} from "../../src/index.ts";

const createRunner = (): LLMRunner => new LLMRunner({ command: "unused" });

class RecordingRunner extends LLMRunner {

    readonly invocations: string[] = [];

    constructor() {
        super({ command: "unused" });
    }

    override async run(prompt: string): Promise<{result: string, error: string}> {
        this.invocations.push(prompt);

        return {
            result: `ran:${prompt}`,
            error: ""
        };
    }

}

const isAgentProcError = (value: unknown, type: string): boolean => {
    return CTGAgentProcError.is(value) && value.type === type;
};

export default CTGTest.init("agent proc orchestration")
    .assert("delegates between registered agents", async () => {
        const plannerRunner = createRunner();
        const workerRunner = createRunner();
        const seen: unknown[] = [];
        let haltedValue: unknown;
        let resolveHalt: () => void = () => {};
        const halted = new Promise<void>((resolve) => {
            resolveHalt = resolve;
        });
        const proc = CTGAgentProc.init<{steps: string[]}>({
            env: { steps: [] },
            onHalt: async (value) => {
                haltedValue = value;
                resolveHalt();
            }
        })
            .runner("planner-runner", plannerRunner)
            .runner("worker-runner", workerRunner)
            .agent("planner", "planner-runner", async ({ task, runner, send, done, setEnv }) => {
                seen.push("planner", task.data, runner === plannerRunner);
                setEnv((env) => ({ steps: [...env.steps, "planner"] }));
                await send("worker", { fromPlanner: task.data });
                await done();
            })
            .agent("worker", "worker-runner", async ({ task, runner, runnerID, halt, setEnv }) => {
                seen.push("worker", task.from, task.data, runnerID, runner === workerRunner);
                setEnv((env) => ({ steps: [...env.steps, "worker"] }));
                await halt("complete");
            });

        await proc.start({ to: "planner", data: "seed" });
        await halted;

        return haltedValue === "complete"
            && seen[0] === "planner"
            && seen[1] === "seed"
            && seen[2] === true
            && seen[3] === "worker"
            && seen[4] === "planner"
            && (seen[5] as {fromPlanner: string}).fromPlanner === "seed"
            && seen[6] === "worker-runner"
            && seen[7] === true
            && proc.env.steps.join(",") === "planner,worker";
    }, P.isTrue())
    .assert("preserves delegated FIFO order", async () => {
        const seen: string[] = [];
        let resolveHalt: () => void = () => {};
        const halted = new Promise<void>((resolve) => {
            resolveHalt = resolve;
        });

        const proc = CTGAgentProc.init({
            onHalt: async () => {
                resolveHalt();
            }
        })
            .runner("main", createRunner())
            .agent("root", "main", async ({ send, done }) => {
                await send("draft", 1);
                await send("review", 2);
                await done();
            })
            .agent("draft", "main", async ({ task, done }) => {
                seen.push(`draft:${task.data}`);
                await done();
            })
            .agent("review", "main", async ({ task, halt }) => {
                seen.push(`review:${task.data}`);
                await halt("complete");
            });

        await proc.start({ to: "root", data: null });
        await halted;

        return seen.join(",");
    }, P.equals("draft:1,review:2"))
    .assert("runs registered prompt with injected runner", async () => {
        const runner = new RecordingRunner();
        let haltedValue: unknown;

        await CTGAgentProc.init({
            onHalt: async (value) => {
                haltedValue = value;
            }
        })
            .runner("main", runner)
            .prompt("base", new LLMPrompt("hello"))
            .agent("agent", "main", async ({ runner: injectedRunner, getPrompt, halt }) => {
                const result = await getPrompt("base").run(injectedRunner);

                await halt(result.result);
            })
            .start({ to: "agent", data: null });

        return haltedValue === "ran:hello"
            && runner.invocations.join(",") === "hello";
    }, P.isTrue())
    .assert("prompt lookup failures halt with agent proc error", async () => {
        let haltedValue: unknown;

        await CTGAgentProc.init({
            onHalt: async (value) => {
                haltedValue = value;
            }
        })
            .runner("main", createRunner())
            .agent("agent", "main", async ({ getPrompt }) => {
                getPrompt("missing");
            })
            .start({ to: "agent", data: null });

        return isAgentProcError(haltedValue, "UNKNOWN_PROMPT")
            && CTGAgentProcError.is(haltedValue)
            && haltedValue.data.promptID === "missing";
    }, P.isTrue())
    .assert("stores retry count in env", async () => {
        let haltedValue: unknown;
        let resolveHalt: () => void = () => {};
        const halted = new Promise<void>((resolve) => {
            resolveHalt = resolve;
        });

        const proc = CTGAgentProc.init<{retries: number}>({
            env: { retries: 0 },
            onHalt: async (value) => {
                haltedValue = value;
                resolveHalt();
            }
        })
            .runner("main", createRunner())
            .agent("retrying-agent", "main", async ({ getEnv, setEnv, send, done, halt }) => {
                const retryCount = getEnv().retries;

                if (retryCount < 2) {
                    setEnv((env) => ({ retries: env.retries + 1 }));
                    await send("retrying-agent", null);
                    await done();
                    return;
                }

                await halt("retried");
            });

        await proc.start({ to: "retrying-agent", data: null });
        await halted;

        return haltedValue === "retried"
            && proc.env.retries === 2;
    }, P.isTrue());
