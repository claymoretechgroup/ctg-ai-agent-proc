import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { LLMPromptError, LLMRunnerError } from "../../src/index.ts";

const captureErrorLog = (fn: () => string): {output: string, logged: string} => {
    const original = console.error;
    let logged = "";

    console.error = (value?: unknown): void => {
        logged = String(value);
    };

    try {
        const output = fn();

        return {output, logged};
    } finally {
        console.error = original;
    }
};

export default CTGTest.init("error class")
    .assert("types map is bidirectional", () => {
        return LLMRunnerError.TYPES.INVALID_OPTIONS === 1001
            && LLMRunnerError.TYPES.COMMAND_NOT_FOUND === 1002
            && LLMRunnerError.TYPES.COMMAND_FAILED === 1003
            && LLMRunnerError.TYPES[1001] === "INVALID_OPTIONS"
            && LLMRunnerError.TYPES[1002] === "COMMAND_NOT_FOUND"
            && LLMRunnerError.TYPES[1003] === "COMMAND_FAILED";
    }, P.isTrue())
    .assert("constructor assigns public fields", () => {
        const cause = new Error("native");
        const err = new LLMRunnerError("COMMAND_FAILED", "Command failed.", {
            command: "tool",
            args: ["--flag"],
            exitCode: 1,
            cause
        });

        return err.name === "LLMRunnerError"
            && err.type === "COMMAND_FAILED"
            && err.msg === "Command failed."
            && err.message === "Command failed."
            && err.data.command === "tool"
            && err.data.args?.[0] === "--flag"
            && err.data.exitCode === 1
            && err.cause === cause;
    }, P.isTrue())
    .assert("is narrows runner errors", () => {
        return LLMRunnerError.is(new LLMRunnerError("INVALID_OPTIONS", "Invalid."))
            && !LLMRunnerError.is(new Error("native"));
    }, P.isTrue())
    .assert("runner error log writes default output", () => {
        const err = new LLMRunnerError("COMMAND_FAILED", "Command failed.", {
            command: "tool"
        });
        const log = captureErrorLog(() => err.log());
        const parsed = JSON.parse(log.output);

        return log.logged === log.output
            && parsed.name === "LLMRunnerError"
            && parsed.type === "COMMAND_FAILED"
            && parsed.msg === "Command failed."
            && parsed.data.command === "tool";
    }, P.isTrue())
    .assert("runner error log accepts custom formatter", () => {
        const err = new LLMRunnerError("COMMAND_NOT_FOUND", "Missing command.", {
            command: "missing"
        });
        const log = captureErrorLog(() => err.log((value) => {
            return `${value.type}:${value.data.command}`;
        }));

        return log.output === "COMMAND_NOT_FOUND:missing"
            && log.logged === "COMMAND_NOT_FOUND:missing";
    }, P.isTrue())
    .assert("prompt error log writes default output", () => {
        const err = new LLMPromptError("READ_FAILED", "Read failed.", {
            path: "prompt.txt"
        });
        const log = captureErrorLog(() => err.log());
        const parsed = JSON.parse(log.output);

        return log.logged === log.output
            && parsed.name === "LLMPromptError"
            && parsed.type === "READ_FAILED"
            && parsed.msg === "Read failed."
            && parsed.data.path === "prompt.txt";
    }, P.isTrue())
    .assert("prompt error log accepts custom formatter", () => {
        const err = new LLMPromptError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name"
        });
        const log = captureErrorLog(() => err.log((value) => {
            return `${value.type}:${value.data.key}`;
        }));

        return log.output === "TEMPLATE_VALUE_NOT_FOUND:name"
            && log.logged === "TEMPLATE_VALUE_NOT_FOUND:name";
    }, P.isTrue());
