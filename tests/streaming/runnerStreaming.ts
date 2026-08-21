import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import * as API from "../../src/index.ts";
import { captureRejected, captureThrown, isConstructor, isRunnerError } from "./helpers.ts";

type StreamMode = "raw" | "events";
type OutputStream = "stdout" | "stderr";

interface StreamConfig {
    streamOutput?: boolean;
    streamMode?: StreamMode;
    onStream?: (event: unknown) => void;
}

interface StoredStreamingConfig extends StreamConfig {
    command: string;
}

const getStoredConfig = (runner: API.LLMRunner): StoredStreamingConfig => {
    return (runner as unknown as {config: StoredStreamingConfig}).config;
};

const streamEventClasses = [
    "LLMRunnerStreamEvent",
    "LLMRunnerOutputEvent",
    "CodexRunnerEvent",
    "ClaudeRunnerEvent"
] as const;

const streamingRunConfig = (config: StreamConfig): API.LLMRunnerRunConfig => {
    return config as API.LLMRunnerRunConfig;
};

export default CTGTest.init("runner streaming")
    .assert("stream event classes are exported", () => {
        return streamEventClasses.every((name) => isConstructor(API[name]));
    }, P.isTrue())
    .assert("omitted streamOutput leaves runner on non-streaming defaults", async () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            args: ["-e", "process.stdout.write('ok');", "--"]
        });
        const config = getStoredConfig(runner);
        const result = await runner.run("PROMPT");

        return {
            streamOutput: config.streamOutput,
            streamMode: config.streamMode,
            result: result.result
        };
    }, P.equals({
        streamOutput: undefined,
        streamMode: undefined,
        result: "ok"
    }))
    .assert("streamMode defaults to raw when streaming is enabled", () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true
        } as API.LLMRunnerConfig);
        const config = getStoredConfig(runner);

        return config.streamMode;
    }, P.equals("raw"))
    .assert("onStream defaults to undefined when streaming is enabled", () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true
        } as API.LLMRunnerConfig);
        const config = getStoredConfig(runner);

        return config.onStream;
    }, P.equals(undefined))
    .assert("constructor rejects streamMode without streamOutput true", () => {
        const caught = captureThrown(() => {
            new API.LLMRunner({
                command: process.execPath,
                streamMode: "raw"
            } as API.LLMRunnerConfig);
        });

        return isRunnerError(caught, "INVALID_OPTIONS");
    }, P.isTrue())
    .assert("constructor rejects onStream without streamOutput true", () => {
        const caught = captureThrown(() => {
            new API.LLMRunner({
                command: process.execPath,
                onStream: () => undefined
            } as API.LLMRunnerConfig);
        });

        return isRunnerError(caught, "INVALID_OPTIONS");
    }, P.isTrue())
    .assert("run config rejects streamMode without streamOutput true", async () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            args: ["-e", "process.stdout.write('ok');", "--"]
        });
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT", streamingRunConfig({
                streamMode: "raw"
            }));
        });

        return isRunnerError(caught, "INVALID_OPTIONS");
    }, P.isTrue())
    .assert("run config rejects onStream without streamOutput true", async () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            args: ["-e", "process.stdout.write('ok');", "--"]
        });
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT", streamingRunConfig({
                onStream: () => undefined
            }));
        });

        return isRunnerError(caught, "INVALID_OPTIONS");
    }, P.isTrue())
    .assert("streamOutput true without handler returns accumulated result", async () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true,
            args: [
                "-e",
                "process.stdout.write('out');process.stderr.write('err');",
                "--"
            ]
        } as API.LLMRunnerConfig);
        const result = await runner.run("PROMPT");

        return result;
    }, P.equals({
        result: "out",
        error: "err"
    }))
    .assert("raw streaming emits stdout and stderr output events", async () => {
        const events: unknown[] = [];
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true,
            onStream: (event: unknown) => {
                events.push(event);
            },
            args: [
                "-e",
                "process.stdout.write('out');process.stderr.write('err');",
                "--"
            ]
        } as API.LLMRunnerConfig);
        const result = await runner.run("PROMPT");
        const OutputEvent = API["LLMRunnerOutputEvent"] as unknown;

        if (!isConstructor(OutputEvent)) {
            return false;
        }

        return result.result === "out"
            && result.error === "err"
            && events.some((event) => event instanceof OutputEvent
                && (event as {stream?: OutputStream,chunk?: string}).stream === "stdout"
                && (event as {stream?: OutputStream,chunk?: string}).chunk.includes("out"))
            && events.some((event) => event instanceof OutputEvent
                && (event as {stream?: OutputStream,chunk?: string}).stream === "stderr"
                && (event as {stream?: OutputStream,chunk?: string}).chunk.includes("err"));
    }, P.isTrue())
    .assert("per-run raw streaming emits output events", async () => {
        const events: unknown[] = [];
        const runner = new API.LLMRunner({
            command: process.execPath,
            args: [
                "-e",
                "process.stdout.write('out');process.stderr.write('err');",
                "--"
            ]
        });
        const result = await runner.run("PROMPT", streamingRunConfig({
            streamOutput: true,
            onStream: (event: unknown) => {
                events.push(event);
            }
        }));
        const OutputEvent = API["LLMRunnerOutputEvent"] as unknown;

        if (!isConstructor(OutputEvent)) {
            return false;
        }

        return result.result === "out"
            && result.error === "err"
            && events.some((event) => event instanceof OutputEvent
                && (event as {stream?: OutputStream,chunk?: string}).stream === "stdout")
            && events.some((event) => event instanceof OutputEvent
                && (event as {stream?: OutputStream,chunk?: string}).stream === "stderr");
    }, P.isTrue())
    .assert("per-run handler is allowed when constructor enables streaming", async () => {
        const events: unknown[] = [];
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true,
            args: [
                "-e",
                "process.stdout.write('out');",
                "--"
            ]
        } as API.LLMRunnerConfig);
        const result = await runner.run("PROMPT", streamingRunConfig({
            onStream: (event: unknown) => {
                events.push(event);
            }
        }));
        const OutputEvent = API["LLMRunnerOutputEvent"] as unknown;

        if (!isConstructor(OutputEvent)) {
            return false;
        }

        return result.result === "out"
            && events.some((event) => event instanceof OutputEvent
                && (event as {stream?: OutputStream,chunk?: string}).stream === "stdout"
                && (event as {chunk?: string}).chunk === "out");
    }, P.isTrue())
    .assert("per-run streamMode is allowed when constructor enables streaming", async () => {
        const events: unknown[] = [];
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true,
            args: [
                "-e",
                "process.stdout.write('out');",
                "--"
            ]
        } as API.LLMRunnerConfig);
        const result = await runner.run("PROMPT", streamingRunConfig({
            streamMode: "raw",
            onStream: (event: unknown) => {
                events.push(event);
            }
        }));
        const OutputEvent = API["LLMRunnerOutputEvent"] as unknown;

        if (!isConstructor(OutputEvent)) {
            return false;
        }

        return result.result === "out"
            && events.some((event) => event instanceof OutputEvent);
    }, P.isTrue())
    .assert("per-run streaming options are rejected when run disables constructor streaming", async () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true,
            args: [
                "-e",
                "process.stdout.write('out');",
                "--"
            ]
        } as API.LLMRunnerConfig);
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT", streamingRunConfig({
                streamOutput: false,
                onStream: () => undefined
            }));
        });

        return isRunnerError(caught, "INVALID_OPTIONS");
    }, P.isTrue())
    .assert("streaming non-zero exit preserves accumulated stdout and stderr", async () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true,
            args: [
                "-e",
                "process.stdout.write('partial-out');process.stderr.write('partial-err');process.exit(7);",
                "--"
            ]
        } as API.LLMRunnerConfig);
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT");
        });

        return API.LLMRunnerError.is(caught)
            && caught.type === "COMMAND_FAILED"
            && caught.data.exitCode === 7
            && caught.data.stdout === "partial-out"
            && caught.data.stderr === "partial-err";
    }, P.isTrue())
    .assert("streaming timeout failures are wrapped", async () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true,
            timeout: 1,
            args: ["-e", "setTimeout(() => {}, 1000);", "--"]
        } as API.LLMRunnerConfig);
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT");
        });

        return API.LLMRunnerError.is(caught)
            && caught.type === "COMMAND_FAILED"
            && caught.data.command === process.execPath
            && caught.data.args?.at(-1) === "PROMPT";
    }, P.isTrue())
    .assert("streaming maxBuffer failures are wrapped", async () => {
        const runner = new API.LLMRunner({
            command: process.execPath,
            streamOutput: true,
            maxBuffer: 1,
            args: ["-e", "process.stdout.write('too much output');", "--"]
        } as API.LLMRunnerConfig);
        const caught = await captureRejected(async () => {
            await runner.run("PROMPT");
        });

        return API.LLMRunnerError.is(caught)
            && caught.type === "COMMAND_FAILED"
            && caught.data.command === process.execPath
            && caught.data.args?.at(-1) === "PROMPT";
    }, P.isTrue());
