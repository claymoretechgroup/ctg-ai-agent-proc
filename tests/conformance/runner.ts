import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { LLMRunner, type LLMRunnerConfig } from "../../src/index.ts";
import { runnerTestCwd } from "./helpers.ts";

const REPORT_SCRIPT = "process.stdout.write(JSON.stringify({argv:process.argv.slice(1),cwd:process.cwd()}));";

class ReportingRunner extends LLMRunner {
    static override readonly DEFAULT_ARGS = [
        "-e",
        REPORT_SCRIPT,
        "--",
        "--default"
    ] as const;

    constructor(config: Partial<LLMRunnerConfig> = {}) {
        super({
            command: config.command ?? process.execPath,
            ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
            ...(config.args === undefined ? {} : { args: config.args })
        });
    }
}

export default CTGTest.init("runner")
    .assert("success result exposes result and error", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            args: ["-e", "process.stdout.write(process.argv.at(-1));", "--"]
        });
        const result = await runner.run("hello");

        return Object.keys(result).sort();
    }, P.equals(["error", "result"]))
    .assert("prompt is appended as final argv element", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            args: ["-e", REPORT_SCRIPT, "--", "--init"]
        });
        const result = await runner.run("PROMPT", {
            args: ["--prompt-arg"]
        });

        return JSON.parse(result.result).argv;
    }, P.equals(["--init", "--prompt-arg", "PROMPT"]))
    .assert("cwd is forwarded to execFile", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            cwd: runnerTestCwd,
            args: ["-e", REPORT_SCRIPT, "--"]
        });
        const result = await runner.run("hello");

        return JSON.parse(result.result).cwd;
    }, P.equals(runnerTestCwd))
    .assert("subclass default args precede constructor args", async () => {
        const runner = new ReportingRunner({
            args: ["--init"]
        });
        const result = await runner.run("PROMPT", {
            args: ["--prompt-arg"]
        });

        return JSON.parse(result.result).argv;
    }, P.equals(["--default", "--init", "--prompt-arg", "PROMPT"]))
    .assert("static init returns subclass instance", () => {
        return ReportingRunner.init({}) instanceof ReportingRunner;
    }, P.isTrue());
