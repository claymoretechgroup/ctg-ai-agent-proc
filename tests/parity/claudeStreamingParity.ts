import {
    ClaudeRunner,
    ClaudeRunnerEvent
} from "../../src/index.ts";
import {
    assertExecutableAvailable,
    assertSentinel,
    captureVersion,
    execFileClosedStdin,
    parseExtraArgs,
    parsePrefixArgs,
    ParityFailure,
    runnerDefinitions
} from "./helpers.ts";

const PROMPT = "Reply with exactly: CTG_PARITY_OK";

const parseJsonLines = (output: string): unknown[] => {
    return output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch (cause) {
                throw new ParityFailure("CLI_DRIFT", `claude stream-json emitted invalid JSONL line: ${line}`);
            }
        });
};

const insertStreamJsonBeforePrompt = (args: readonly string[]): string[] => {
    const withFormat = args.includes("--output-format")
        ? [...args]
        : [...args, "--output-format", "stream-json"];

    return withFormat.includes("--verbose") ? withFormat : [...withFormat, "--verbose"];
};

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const hasResultText = (event: unknown): boolean => {
    return isObject(event)
        && typeof event.result === "string"
        && event.result.includes("CTG_PARITY_OK");
};

const hasAssistantText = (event: unknown): boolean => {
    if (!isObject(event) || !isObject(event.message) || !Array.isArray(event.message.content)) {
        return false;
    }

    return event.message.content.some((entry) => isObject(entry)
        && typeof entry.text === "string"
        && entry.text.includes("CTG_PARITY_OK"));
};

export const runClaudeStreamingParity = async (): Promise<void> => {
    const definition = runnerDefinitions.claude;
    const executable = await assertExecutableAvailable(definition.command);
    const version = await captureVersion(definition.command);
    const prefixArgs = parsePrefixArgs(definition);
    const extraArgs = parseExtraArgs(definition);

    console.log(`SETUP: claude streaming executable=${executable}`);
    console.log(`SETUP: claude streaming version=${version}`);
    console.log(`SETUP: claude streaming prefixArgs=${JSON.stringify(prefixArgs)}`);
    console.log(`SETUP: claude streaming extraArgs=${JSON.stringify(extraArgs)}`);

    const directArgs = [
        ...prefixArgs,
        ...definition.baseArgs,
        ...insertStreamJsonBeforePrompt(extraArgs),
        PROMPT
    ];
    const direct = await execFileClosedStdin(definition.command, directArgs, {timeout: 120_000});
    const directEvents = parseJsonLines(direct.stdout);

    if (!directEvents.some((event) => isObject(event) && event.type === "result")) {
        throw new ParityFailure("CLI_DRIFT", "claude stream-json did not emit result event");
    }

    if (!directEvents.some((event) => hasResultText(event) || hasAssistantText(event))) {
        throw new ParityFailure("MODEL_VARIANCE", `claude stream-json did not emit text containing CTG_PARITY_OK; stdout=${JSON.stringify(direct.stdout)} stderr=${JSON.stringify(direct.stderr)}`);
    }

    const events: unknown[] = [];
    const runner = new ClaudeRunner({
        prefixArgs,
        args: extraArgs,
        streamOutput: true,
        streamMode: "events",
        onStream: (event) => {
            events.push(event);
        }
    });
    const result = await runner.run(PROMPT);

    assertSentinel("ClaudeRunner streaming", result);

    if (!events.some((event) => event instanceof ClaudeRunnerEvent)) {
        throw new ParityFailure("RUNNER_REGRESSION", "ClaudeRunner streaming did not emit ClaudeRunnerEvent");
    }

    if (!events.some((event) => event instanceof ClaudeRunnerEvent && (hasResultText(event.payload) || hasAssistantText(event.payload)))) {
        throw new ParityFailure("RUNNER_REGRESSION", "ClaudeRunner streaming did not emit native event containing CTG_PARITY_OK");
    }

    if (!events.some((event) => event instanceof ClaudeRunnerEvent && isObject(event.payload) && (isObject(event.payload.usage) || (isObject(event.payload.message) && isObject(event.payload.message.usage))))) {
        throw new ParityFailure("RUNNER_REGRESSION", "ClaudeRunner streaming did not emit native usage event");
    }
};
