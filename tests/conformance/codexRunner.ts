import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { CodexRunner } from "../../src/index.ts";
import { createCwdReporterCommand, runnerTestCwd } from "./helpers.ts";

const BASE_ARGS = [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--ephemeral",
    "-c",
    "project_root_markers=[]",
    "-c",
    "project_doc_max_bytes=0",
    "-c",
    "features.memories=false",
    "-c",
    "memories.use_memories=false"
];

export default CTGTest.init("codex runner")
    .assert("uses codex as default command", () => {
        const runner = new CodexRunner();

        return (runner as unknown as { config: { command: string } }).config.command;
    }, P.equals("codex"))
    .assert("static init supports omitted config", () => {
        return CodexRunner.init() instanceof CodexRunner;
    }, P.isTrue())
    .assert("adds codex defaults before constructor args", async () => {
        const runner = new CodexRunner({
            command: "echo",
            args: ["--model", "gpt-5-codex"]
        });
        const result = await runner.run("PROMPT");

        return result.result.trim().split(" ");
    }, P.equals([...BASE_ARGS, "--model", "gpt-5-codex", "PROMPT"]))
    .assert("adds prefix args before codex defaults", async () => {
        const runner = new CodexRunner({
            command: "echo",
            prefixArgs: ["--prefix"],
            args: ["--model", "gpt-5-codex"]
        });
        const result = await runner.run("PROMPT");

        return result.result.trim().split(" ");
    }, P.equals(["--prefix", ...BASE_ARGS, "--model", "gpt-5-codex", "PROMPT"]))
    .assert("adds prompt args before prompt", async () => {
        const runner = new CodexRunner({
            command: "echo"
        });
        const result = await runner.run("PROMPT", {
            args: ["--model", "gpt-5-codex"]
        });

        return result.result.trim().split(" ");
    }, P.equals([...BASE_ARGS, "--model", "gpt-5-codex", "PROMPT"]))
    .assert("forwards cwd override to base runner", async () => {
        const runner = new CodexRunner({
            command: createCwdReporterCommand(),
            cwd: runnerTestCwd
        });
        const result = await runner.run("PROMPT");

        return result.result;
    }, P.equals(runnerTestCwd))
    .assert("forwards process controls to base runner", () => {
        const env = { CTG_AGENT_PROC_ENV_TEST: "visible" };
        const runner = new CodexRunner({
            timeout: 10,
            maxBuffer: 100,
            env
        });
        const config = (runner as unknown as { config: { timeout?: number,maxBuffer?: number,env?: NodeJS.ProcessEnv } }).config;

        return {
            timeout: config.timeout,
            maxBuffer: config.maxBuffer,
            env: config.env
        };
    }, P.equals({
        timeout: 10,
        maxBuffer: 100,
        env: { CTG_AGENT_PROC_ENV_TEST: "visible" }
    }));
