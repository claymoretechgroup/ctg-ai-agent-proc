import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { LLMPromptError, LLMPromptTemplateError, LLMRunnerError, LLMTokenMetricError } from "../../src/index.ts";

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

const captureThrown = (fn: () => unknown): unknown => {
    try {
        fn();

        return null;
    } catch (caught) {
        return caught;
    }
};

export default CTGTest.init("error class")
    .assert("runner error types map is bidirectional", () => {
        return LLMRunnerError.TYPES.INVALID_OPTIONS === 1001
            && LLMRunnerError.TYPES.COMMAND_NOT_FOUND === 1002
            && LLMRunnerError.TYPES.COMMAND_FAILED === 1003
            && LLMRunnerError.TYPES[1001] === "INVALID_OPTIONS"
            && LLMRunnerError.TYPES[1002] === "COMMAND_NOT_FOUND"
            && LLMRunnerError.TYPES[1003] === "COMMAND_FAILED";
    }, P.isTrue())
    .assert("runner error constructor assigns public fields", () => {
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
    .assert("runner error constructor rejects unknown type", () => {
        const caught = captureThrown(() => {
            new LLMRunnerError("UNKNOWN", "Unknown.");
        });

        return caught instanceof Error
            && caught.message === "Unknown LLMRunnerError type: UNKNOWN";
    }, P.isTrue())
    .assert("runner error data is shallow frozen", () => {
        const err = new LLMRunnerError("COMMAND_FAILED", "Command failed.", {
            command: "tool"
        });

        return Object.isFrozen(err.data);
    }, P.isTrue())
    .assert("is narrows runner errors", () => {
        return LLMRunnerError.is(new LLMRunnerError("INVALID_OPTIONS", "Invalid."))
            && !LLMRunnerError.is(new Error("native"));
    }, P.isTrue())
    .assert("runner error isType checks known types", () => {
        return LLMRunnerError.isType("INVALID_OPTIONS")
            && LLMRunnerError.isType("COMMAND_NOT_FOUND")
            && LLMRunnerError.isType("COMMAND_FAILED")
            && !LLMRunnerError.isType("UNKNOWN");
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
    .assert("token metric error types map is bidirectional", () => {
        return LLMTokenMetricError.TYPES.INVALID_COUNT === 1001
            && LLMTokenMetricError.TYPES[1001] === "INVALID_COUNT";
    }, P.isTrue())
    .assert("token metric error constructor assigns public fields", () => {
        const cause = new Error("native");
        const err = new LLMTokenMetricError("INVALID_COUNT", "Invalid count.", {
            measurement: -1,
            cause
        });

        return err.name === "LLMTokenMetricError"
            && err.type === "INVALID_COUNT"
            && err.msg === "Invalid count."
            && err.message === "Invalid count."
            && err.data.measurement === -1
            && err.cause === cause;
    }, P.isTrue())
    .assert("token metric error constructor rejects unknown type", () => {
        const caught = captureThrown(() => {
            new LLMTokenMetricError("UNKNOWN", "Unknown.");
        });

        return caught instanceof Error
            && caught.message === "Unknown LLMTokenMetricError type: UNKNOWN";
    }, P.isTrue())
    .assert("token metric error data is shallow frozen", () => {
        const err = new LLMTokenMetricError("INVALID_COUNT", "Invalid count.", {
            measurement: -1
        });

        return Object.isFrozen(err.data);
    }, P.isTrue())
    .assert("is narrows token metric errors", () => {
        return LLMTokenMetricError.is(new LLMTokenMetricError("INVALID_COUNT", "Invalid."))
            && !LLMTokenMetricError.is(new Error("native"));
    }, P.isTrue())
    .assert("token metric error log writes default output", () => {
        const err = new LLMTokenMetricError("INVALID_COUNT", "Invalid count.", {
            measurement: -1
        });
        const log = captureErrorLog(() => err.log());
        const parsed = JSON.parse(log.output);

        return log.logged === log.output
            && parsed.name === "LLMTokenMetricError"
            && parsed.type === "INVALID_COUNT"
            && parsed.msg === "Invalid count."
            && parsed.data.measurement === -1;
    }, P.isTrue())
    .assert("token metric error log accepts custom formatter", () => {
        const err = new LLMTokenMetricError("INVALID_COUNT", "Invalid count.", {
            measurement: -1
        });
        const log = captureErrorLog(() => err.log((value) => {
            return `${value.type}:${value.data.measurement}`;
        }));

        return log.output === "INVALID_COUNT:-1"
            && log.logged === "INVALID_COUNT:-1";
    }, P.isTrue())
    .assert("prompt template error types map is bidirectional", () => {
        return LLMPromptTemplateError.TYPES.INVALID_OPTIONS === 1001
            && LLMPromptTemplateError.TYPES.TEMPLATE_VALUE_NOT_FOUND === 1002
            && LLMPromptTemplateError.TYPES[1001] === "INVALID_OPTIONS"
            && LLMPromptTemplateError.TYPES[1002] === "TEMPLATE_VALUE_NOT_FOUND";
    }, P.isTrue())
    .assert("prompt template error constructor assigns public fields", () => {
        const cause = new Error("native");
        const err = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name",
            cause
        });

        return err.name === "LLMPromptTemplateError"
            && err.type === "TEMPLATE_VALUE_NOT_FOUND"
            && err.msg === "Missing value."
            && err.message === "Missing value."
            && err.data.key === "name"
            && err.cause === cause;
    }, P.isTrue())
    .assert("prompt template error constructor rejects unknown type", () => {
        const caught = captureThrown(() => {
            new LLMPromptTemplateError("UNKNOWN", "Unknown.");
        });

        return caught instanceof Error
            && caught.message === "Unknown LLMPromptTemplateError type: UNKNOWN";
    }, P.isTrue())
    .assert("prompt template error data is shallow frozen", () => {
        const err = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name"
        });

        return Object.isFrozen(err.data);
    }, P.isTrue())
    .assert("is narrows prompt template errors", () => {
        return LLMPromptTemplateError.is(new LLMPromptTemplateError("INVALID_OPTIONS", "Invalid."))
            && !LLMPromptTemplateError.is(new Error("native"));
    }, P.isTrue())
    .assert("prompt template error log writes default output", () => {
        const err = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name"
        });
        const log = captureErrorLog(() => err.log());
        const parsed = JSON.parse(log.output);

        return log.logged === log.output
            && parsed.name === "LLMPromptTemplateError"
            && parsed.type === "TEMPLATE_VALUE_NOT_FOUND"
            && parsed.msg === "Missing value."
            && parsed.data.key === "name";
    }, P.isTrue())
    .assert("prompt template error log accepts custom formatter", () => {
        const err = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name"
        });
        const log = captureErrorLog(() => err.log((value) => {
            return `${value.type}:${value.data.key}`;
        }));

        return log.output === "TEMPLATE_VALUE_NOT_FOUND:name"
            && log.logged === "TEMPLATE_VALUE_NOT_FOUND:name";
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
    }, P.isTrue())
    .assert("prompt error types map is bidirectional", () => {
        return LLMPromptError.TYPES.INVALID_OPTIONS === 1001
            && LLMPromptError.TYPES.TEMPLATE_VALUE_NOT_FOUND === 1002
            && LLMPromptError.TYPES.READ_FAILED === 1003
            && LLMPromptError.TYPES.UNKNOWN_OPERATION === 1004
            && LLMPromptError.TYPES[1001] === "INVALID_OPTIONS"
            && LLMPromptError.TYPES[1002] === "TEMPLATE_VALUE_NOT_FOUND"
            && LLMPromptError.TYPES[1003] === "READ_FAILED"
            && LLMPromptError.TYPES[1004] === "UNKNOWN_OPERATION";
    }, P.isTrue())
    .assert("prompt error constructor assigns public fields", () => {
        const cause = new Error("native");
        const err = new LLMPromptError("READ_FAILED", "Read failed.", {
            path: "prompt.txt",
            cause
        });

        return err.name === "LLMPromptError"
            && err.type === "READ_FAILED"
            && err.msg === "Read failed."
            && err.message === "Read failed."
            && err.data.path === "prompt.txt"
            && err.cause === cause;
    }, P.isTrue())
    .assert("prompt error constructor rejects unknown type", () => {
        const caught = captureThrown(() => {
            new LLMPromptError("UNKNOWN", "Unknown.");
        });

        return caught instanceof Error
            && caught.message === "Unknown LLMPromptError type: UNKNOWN";
    }, P.isTrue())
    .assert("prompt error data is shallow frozen", () => {
        const err = new LLMPromptError("READ_FAILED", "Read failed.", {
            path: "prompt.txt"
        });

        return Object.isFrozen(err.data);
    }, P.isTrue())
    .assert("is narrows prompt errors", () => {
        return LLMPromptError.is(new LLMPromptError("INVALID_OPTIONS", "Invalid."))
            && !LLMPromptError.is(new Error("native"));
    }, P.isTrue());
