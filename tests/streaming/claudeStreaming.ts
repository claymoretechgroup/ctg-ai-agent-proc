import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import {
    ClaudeRunner,
    ClaudeRunnerEvent
} from "../../src/index.ts";
import { streamingFixturePath } from "./helpers.ts";

const fixtureCommandArgs = (fixture: string): string[] => [
    "-e",
    "const {readFileSync}=require('node:fs');process.stderr.write(JSON.stringify(process.argv.slice(1)));process.stdout.write(readFileSync(process.argv[1],'utf8'));",
    "--",
    fixture
];

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const hasClaudeText = (event: unknown, expected: string): boolean => {
    if (!(event instanceof ClaudeRunnerEvent) || !isObject(event.payload)) {
        return false;
    }

    if (typeof event.payload.result === "string" && event.payload.result === expected) {
        return true;
    }

    if (!isObject(event.payload.message) || !Array.isArray(event.payload.message.content)) {
        return false;
    }

    return event.payload.message.content.some((entry) => isObject(entry)
        && typeof entry.text === "string"
        && entry.text === expected);
};

const hasClaudeUsage = (event: unknown): boolean => {
    if (!(event instanceof ClaudeRunnerEvent) || !isObject(event.payload)) {
        return false;
    }

    if (isObject(event.payload.usage)) {
        return true;
    }

    return isObject(event.payload.message) && isObject(event.payload.message.usage);
};

export default CTGTest.init("claude streaming")
    .assert("events mode adds stream-json flags and reconstructs final result", async () => {
        const events: unknown[] = [];
        const runner = new ClaudeRunner({
            command: process.execPath,
            prefixArgs: fixtureCommandArgs(streamingFixturePath("claude-stream-json.txt")),
            streamOutput: true,
            streamMode: "events",
            onStream: (event) => {
                events.push(event);
            }
        });
        const result = await runner.run("PROMPT");
        const argv = JSON.parse(result.error) as string[];

        return {
            result: result.result,
            hasOutputFormat: argv.includes("--output-format"),
            outputFormatValue: argv[argv.indexOf("--output-format") + 1],
            hasVerbose: argv.includes("--verbose"),
            flagsBeforePrompt: argv.indexOf("--verbose") < argv.indexOf("PROMPT"),
            hasNativeEvent: events.some((event) => event instanceof ClaudeRunnerEvent),
            hasTextEvent: events.some((event) => hasClaudeText(event, "CTG_STREAM_OK")),
            hasUsageEvent: events.some(hasClaudeUsage)
        };
    }, P.equals({
        result: "CTG_STREAM_OK",
        hasOutputFormat: true,
        outputFormatValue: "stream-json",
        hasVerbose: true,
        flagsBeforePrompt: true,
        hasNativeEvent: true,
        hasTextEvent: true,
        hasUsageEvent: true
    }))
    .assert("raw mode does not add stream-json flags", async () => {
        const runner = new ClaudeRunner({
            command: process.execPath,
            prefixArgs: fixtureCommandArgs(streamingFixturePath("claude-stream-json.txt")),
            streamOutput: true,
            streamMode: "raw"
        });
        const result = await runner.run("PROMPT");
        const argv = JSON.parse(result.error) as string[];

        return argv.includes("--output-format") || argv.includes("--verbose");
    }, P.isFalse());
