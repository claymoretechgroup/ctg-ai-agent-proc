import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { LLMRunner, LLMRunnerError, type LLMRunnerConfig, type LLMRunnerResult } from "../../src/index.ts";
import { captureRejected, captureThrown, runnerTestCwd } from "./helpers.ts";

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

class SummarizeRunner extends LLMRunner {
    calls: string[] = [];

    constructor() {
        super({
            command: process.execPath
        });
    }

    override async run(prompt: string): Promise<LLMRunnerResult> {
        this.calls.push(prompt);

        return {
            result: "summary",
            error: "stderr"
        };
    }
}

export default CTGTest.init("runner")
    .assert("constructor rejects empty command", () => {
        const caught = captureThrown(() => {
            new LLMRunner({
                command: ""
            });
        });

        return LLMRunnerError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.command === "";
    }, P.isTrue())
    .assert("constructor rejects whitespace command", () => {
        const caught = captureThrown(() => {
            new LLMRunner({
                command: "   "
            });
        });

        return LLMRunnerError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.command === "   ";
    }, P.isTrue())
    .assert("constructor rejects invalid timeout", () => {
        const caught = captureThrown(() => {
            new LLMRunner({
                command: process.execPath,
                timeout: -1
            });
        });

        return LLMRunnerError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.command === process.execPath;
    }, P.isTrue())
    .assert("constructor rejects invalid maxBuffer", () => {
        const caught = captureThrown(() => {
            new LLMRunner({
                command: process.execPath,
                maxBuffer: 0
            });
        });

        return LLMRunnerError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.command === process.execPath;
    }, P.isTrue())
    .assert("stored config is frozen", () => {
        const runner = new LLMRunner({
            command: process.execPath
        });
        const config = (runner as unknown as {config: {command: string}}).config;

        try {
            config.command = "changed";
        } catch {
            // Frozen objects throw in strict mode; non-throwing runtimes must still preserve the value.
        }

        return Object.isFrozen(config)
            && config.command === process.execPath;
    }, P.isTrue())
    .assert("constructor args are copied", async () => {
        const args = ["-e", REPORT_SCRIPT, "--", "--init"];
        const runner = new LLMRunner({
            command: process.execPath,
            args
        });

        args.push("--mutated");

        const result = await runner.run("PROMPT");

        return JSON.parse(result.result).argv;
    }, P.equals(["--init", "PROMPT"]))
    .assert("base default args are empty", () => {
        return LLMRunner.DEFAULT_ARGS;
    }, P.equals([]))
    .assert("success result exposes result and error", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            args: ["-e", "process.stdout.write(process.argv.at(-1));", "--"]
        });
        const result = await runner.run("hello");

        return Object.keys(result).sort();
    }, P.equals(["error", "result"]))
    .assert("success result captures stderr as error", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            args: ["-e", "process.stdout.write('out');process.stderr.write('err');", "--"]
        });
        const result = await runner.run("hello");

        return result;
    }, P.equals({
        result: "out",
        error: "err"
    }))
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
    .assert("omitted cwd uses current process cwd", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            args: ["-e", REPORT_SCRIPT, "--"]
        });
        const result = await runner.run("hello");

        return JSON.parse(result.result).cwd;
    }, P.equals(process.cwd()))
    .assert("env override is forwarded as complete child environment", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            env: { CTG_AGENT_PROC_ENV_TEST: "visible" },
            args: [
                "-e",
                "process.stdout.write(`${process.env.CTG_AGENT_PROC_ENV_TEST ?? ''}:${process.env.PATH ?? ''}`);",
                "--"
            ]
        });
        const result = await runner.run("hello");

        return result.result;
    }, P.equals("visible:"))
    .assert("timeout failures are wrapped", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            timeout: 1,
            args: ["-e", "setTimeout(() => {}, 1000);", "--"]
        });
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT");
        });

        return LLMRunnerError.is(caught)
            && caught.type === "COMMAND_FAILED"
            && caught.data.command === process.execPath
            && caught.data.args?.at(-1) === "PROMPT"
            && caught.data.cause !== undefined;
    }, P.isTrue())
    .assert("maxBuffer failures are wrapped", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            maxBuffer: 1,
            args: ["-e", "process.stdout.write('too much output');", "--"]
        });
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT");
        });

        return LLMRunnerError.is(caught)
            && caught.type === "COMMAND_FAILED"
            && caught.data.command === process.execPath
            && caught.data.args?.at(-1) === "PROMPT"
            && caught.data.cause !== undefined;
    }, P.isTrue())
    .assert("empty prompt is appended as final argv element", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            args: ["-e", REPORT_SCRIPT, "--", "--init"]
        });
        const result = await runner.run("");

        return JSON.parse(result.result).argv;
    }, P.equals(["--init", ""]))
    .assert("base tokenCount uses length over four approximation", async () => {
        const runner = new LLMRunner({
            command: process.execPath
        });

        return {
            empty: await runner.tokenCount(""),
            one: await runner.tokenCount("a"),
            four: await runner.tokenCount("abcd"),
            five: await runner.tokenCount("abcde")
        };
    }, P.equals({
        empty: 0,
        one: 1,
        four: 1,
        five: 2
    }))
    .assert("base summarize invokes run once with text and returns result", async () => {
        const runner = new SummarizeRunner();
        const result = await runner.summarize("important details");

        return {
            result,
            calls: runner.calls.length,
            includesText: runner.calls[0]?.includes("important details") ?? false,
            summaryOriented: /summar/i.test(runner.calls[0] ?? "")
        };
    }, P.equals({
        result: "summary",
        calls: 1,
        includesText: true,
        summaryOriented: true
    }))
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
    }, P.isTrue())
    .assert("static init supports omitted config when constructor supports it", () => {
        return ReportingRunner.init() instanceof ReportingRunner;
    }, P.isTrue())
    .assert("missing command failures are wrapped", async () => {
        const runner = new LLMRunner({
            command: "ctg-ai-agent-proc-definitely-missing-command"
        });
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT");
        });

        return LLMRunnerError.is(caught)
            && caught.type === "COMMAND_NOT_FOUND"
            && caught.data.command === "ctg-ai-agent-proc-definitely-missing-command"
            && caught.data.args?.at(-1) === "PROMPT"
            && caught.data.cause !== undefined;
    }, P.isTrue())
    .assert("non-zero command failures are wrapped with output", async () => {
        const runner = new LLMRunner({
            command: process.execPath,
            args: [
                "-e",
                "process.stdout.write('out');process.stderr.write('err');process.exit(7);",
                "--"
            ]
        });
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT");
        });

        return LLMRunnerError.is(caught)
            && caught.type === "COMMAND_FAILED"
            && caught.data.command === process.execPath
            && caught.data.args?.at(-1) === "PROMPT"
            && caught.data.exitCode === 7
            && caught.data.stdout === "out"
            && caught.data.stderr === "err"
            && caught.data.cause !== undefined;
    }, P.isTrue());
