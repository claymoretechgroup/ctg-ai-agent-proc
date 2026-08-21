import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { HiveQueue, HiveQueueError } from "hive-queue";
import {
    CTGAgentProc,
    CTGAgentProcError,
    LLMRunner,
    LLMPrompt
} from "../../src/index.ts";
import { captureThrown } from "./helpers.ts";

const createRunner = (): LLMRunner => new LLMRunner({ command: "unused" });

const isAgentProcError = (value: unknown, type: string): boolean => {
    return CTGAgentProcError.is(value) && value.type === type;
};

export default CTGTest.init("agent proc")
    .assert("constructor extends HiveQueue and initializes registries", () => {
        const proc = new CTGAgentProc<{count: number}>({
            env: { count: 1 }
        });

        return proc instanceof HiveQueue
            && proc.runners instanceof Map
            && proc.prompts instanceof Map
            && proc.runners.size === 0
            && proc.prompts.size === 0
            && proc.env.count === 1;
    }, P.isTrue())
    .assert("constructor accepts provided registries", () => {
        const runner = createRunner();
        const prompt = new LLMPrompt("hello");
        const runners = new Map([["main", runner]]);
        const prompts = new Map([["base", prompt]]);
        const proc = new CTGAgentProc({ runners, prompts });

        return proc.runners === runners
            && proc.prompts === prompts
            && proc.runners.get("main") === runner
            && proc.prompts.get("base") === prompt;
    }, P.isTrue())
    .assert("static init returns CTGAgentProc", () => {
        return CTGAgentProc.init() instanceof CTGAgentProc;
    }, P.isTrue())
    .assert("runner registers and returns processor", () => {
        const proc = CTGAgentProc.init();
        const runner = createRunner();

        return proc.runner("main", runner) === proc
            && proc.runners.get("main") === runner;
    }, P.isTrue())
    .assert("duplicate runner id throws agent proc error", () => {
        const proc = CTGAgentProc.init()
            .runner("main", createRunner());
        const caught = captureThrown(() => {
            proc.runner("main", createRunner());
        });

        return isAgentProcError(caught, "RUNNER_ALREADY_BOUND")
            && CTGAgentProcError.is(caught)
            && caught.data.runnerID === "main";
    }, P.isTrue())
    .assert("prompt registers and returns processor", () => {
        const proc = CTGAgentProc.init();
        const prompt = new LLMPrompt("hello");

        return proc.prompt("base", prompt) === proc
            && proc.getPrompt("base") === prompt;
    }, P.isTrue())
    .assert("duplicate prompt id throws agent proc error", () => {
        const proc = CTGAgentProc.init()
            .prompt("base", new LLMPrompt("hello"));
        const caught = captureThrown(() => {
            proc.prompt("base", new LLMPrompt("again"));
        });

        return isAgentProcError(caught, "PROMPT_ALREADY_BOUND")
            && CTGAgentProcError.is(caught)
            && caught.data.promptID === "base";
    }, P.isTrue())
    .assert("unknown prompt throws agent proc error", () => {
        const caught = captureThrown(() => {
            CTGAgentProc.init().getPrompt("missing");
        });

        return isAgentProcError(caught, "UNKNOWN_PROMPT")
            && CTGAgentProcError.is(caught)
            && caught.data.promptID === "missing";
    }, P.isTrue())
    .assert("agent rejects unknown runner before worker registration", () => {
        const proc = CTGAgentProc.init();
        const caught = captureThrown(() => {
            proc.agent("agent", "missing", async ({ done }) => {
                await done();
            });
        });

        return isAgentProcError(caught, "UNKNOWN_RUNNER")
            && CTGAgentProcError.is(caught)
            && caught.data.agentID === "agent"
            && caught.data.runnerID === "missing"
            && !proc.workers.has("agent");
    }, P.isTrue())
    .assert("agent delegates duplicate agent ids to HiveQueue worker behavior", () => {
        const proc = CTGAgentProc.init()
            .runner("main", createRunner())
            .agent("agent", "main", async ({ done }) => {
                await done();
            });
        const caught = captureThrown(() => {
            proc.agent("agent", "main", async ({ done }) => {
                await done();
            });
        });

        return HiveQueueError.is(caught)
            && caught.code === HiveQueueError.Code.WORKER_ALREADY_BOUND;
    }, P.isTrue())
    .assert("agent registers a HiveQueue worker and returns processor", () => {
        const proc = CTGAgentProc.init()
            .runner("main", createRunner());

        return proc.agent("agent", "main", async ({ done }) => {
            await done();
        }) === proc
            && proc.workers.has("agent");
    }, P.isTrue())
    .assert("agent receives Hive props and agent context", async () => {
        const runner = createRunner();
        const prompt = new LLMPrompt("hello");
        let observed = false;
        let haltedValue: unknown = null;
        const proc = CTGAgentProc.init<{count: number}>({
            env: { count: 1 },
            onHalt: async (value) => {
                haltedValue = value;
            }
        })
            .runner("main", runner)
            .prompt("base", prompt)
            .agent("agent", "main", async (props) => {
                const initialEnv = props.getEnv();

                props.setEnv((env) => ({ count: env.count + 1 }));

                observed = props.task.to === "agent"
                    && props.task.data === "payload"
                    && typeof props.send === "function"
                    && typeof props.done === "function"
                    && typeof props.halt === "function"
                    && initialEnv.count === 1
                    && props.getEnv().count === 2
                    && props.agentID === "agent"
                    && props.runnerID === "main"
                    && props.runner === runner
                    && props.getPrompt("base") === prompt;

                await props.halt("complete");
            });

        await proc.start({ to: "agent", data: "payload" });

        return observed
            && haltedValue === "complete"
            && proc.env.count === 2;
    }, P.isTrue());
