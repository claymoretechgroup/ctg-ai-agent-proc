import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import {
    CodexRunner,
    CodexRunnerEvent
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

const hasCodexText = (event: unknown, expected: string): boolean => {
    if (!(event instanceof CodexRunnerEvent) || !isObject(event.payload) || !isObject(event.payload.item)) {
        return false;
    }

    const item = event.payload.item;

    if (item.type === "agent_message" && typeof item.text === "string") {
        return item.text === expected;
    }

    return item.type === "message"
        && item.role === "assistant"
        && Array.isArray(item.content)
        && item.content.some((entry) => isObject(entry)
            && typeof entry.text === "string"
            && entry.text === expected);
};

const hasCodexUsage = (event: unknown): boolean => {
    return event instanceof CodexRunnerEvent
        && isObject(event.payload)
        && event.type === "turn.completed"
        && isObject(event.payload.usage);
};

const hasCodexReasoning = (event: unknown): boolean => {
    return event instanceof CodexRunnerEvent
        && isObject(event.payload)
        && isObject(event.payload.item)
        && event.payload.item.type === "reasoning";
};

export default CTGTest.init("codex streaming")
    .assert("events mode adds json flag and reconstructs final result", async () => {
        const events: unknown[] = [];
        const runner = new CodexRunner({
            command: process.execPath,
            prefixArgs: fixtureCommandArgs(streamingFixturePath("codex-jsonl.txt")),
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
            hasJsonFlag: argv.includes("--json"),
            jsonAfterExec: argv[argv.indexOf("exec") + 1] === "--json",
            hasNativeEvent: events.some((event) => event instanceof CodexRunnerEvent),
            hasTextEvent: events.some((event) => hasCodexText(event, "CTG_STREAM_OK")),
            hasUsageEvent: events.some(hasCodexUsage),
            hasReasoningEvent: events.some(hasCodexReasoning)
        };
    }, P.equals({
        result: "CTG_STREAM_OK",
        hasJsonFlag: true,
        jsonAfterExec: true,
        hasNativeEvent: true,
        hasTextEvent: true,
        hasUsageEvent: true,
        hasReasoningEvent: true
    }))
    .assert("raw mode does not add json flag", async () => {
        const runner = new CodexRunner({
            command: process.execPath,
            prefixArgs: fixtureCommandArgs(streamingFixturePath("codex-jsonl.txt")),
            streamOutput: true,
            streamMode: "raw"
        });
        const result = await runner.run("PROMPT");
        const argv = JSON.parse(result.error) as string[];

        return argv.includes("--json");
    }, P.isFalse());
