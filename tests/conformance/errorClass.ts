import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { LLMRunnerError } from "../../src/index.ts";

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
    }, P.isTrue());
