import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { ClaudeRunner, LLMTokenMetric } from "../../src/index.ts";
import { createCwdReporterCommand, runnerTestCwd } from "./helpers.ts";

class TestTokenMetric extends LLMTokenMetric {
    override async count(): Promise<number> {
        return 1;
    }
}

export default CTGTest.init("claude runner")
    .assert("uses claude as default command", () => {
        const runner = new ClaudeRunner();

        return (runner as unknown as { config: { command: string } }).config.command;
    }, P.equals("claude"))
    .assert("static init supports omitted config", () => {
        return ClaudeRunner.init() instanceof ClaudeRunner;
    }, P.isTrue())
    .assert("adds safe mode and print defaults before constructor args", async () => {
        const runner = new ClaudeRunner({
            command: "echo",
            args: ["--model", "opus"]
        });
        const result = await runner.run("PROMPT");

        return result.result.trim();
    }, P.equals("--safe-mode --print --model opus PROMPT"))
    .assert("adds prefix args before safe mode defaults", async () => {
        const runner = new ClaudeRunner({
            command: "echo",
            prefixArgs: ["--prefix"],
            args: ["--model", "opus"]
        });
        const result = await runner.run("PROMPT");

        return result.result.trim();
    }, P.equals("--prefix --safe-mode --print --model opus PROMPT"))
    .assert("adds prompt args before prompt", async () => {
        const runner = new ClaudeRunner({
            command: "echo"
        });
        const result = await runner.run("PROMPT", {
            args: ["--model", "opus"]
        });

        return result.result.trim();
    }, P.equals("--safe-mode --print --model opus PROMPT"))
    .assert("forwards cwd override to base runner", async () => {
        const runner = new ClaudeRunner({
            command: createCwdReporterCommand(),
            cwd: runnerTestCwd
        });
        const result = await runner.run("PROMPT");

        return result.result;
    }, P.equals(runnerTestCwd))
    .assert("forwards process controls to base runner", () => {
        const env = { CTG_AGENT_PROC_ENV_TEST: "visible" };
        const tokenMetric = new TestTokenMetric();
        const runner = new ClaudeRunner({
            timeout: 10,
            maxBuffer: 100,
            env,
            tokenMetric
        });
        const config = (runner as unknown as { config: { timeout?: number,maxBuffer?: number,env?: NodeJS.ProcessEnv },tokenMetric: LLMTokenMetric }).config;
        const storedTokenMetric = (runner as unknown as { tokenMetric: LLMTokenMetric }).tokenMetric;

        return {
            timeout: config.timeout,
            maxBuffer: config.maxBuffer,
            env: config.env,
            tokenMetric: storedTokenMetric === tokenMetric
        };
    }, P.equals({
        timeout: 10,
        maxBuffer: 100,
        env: { CTG_AGENT_PROC_ENV_TEST: "visible" },
        tokenMetric: true
    }));
