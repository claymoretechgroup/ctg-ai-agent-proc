import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { ClaudeRunner } from "../../src/index.ts";
import { createCwdReporterCommand, runnerTestCwd } from "./helpers.ts";

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
    }, P.equals(runnerTestCwd));
