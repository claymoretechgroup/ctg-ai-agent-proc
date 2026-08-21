import {
    CodexRunner,
    CodexRunnerEvent
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
                throw new ParityFailure("CLI_DRIFT", `codex --json emitted invalid JSONL line: ${line}`);
            }
        });
};

const insertJsonAfterExec = (args: readonly string[]): string[] => {
    if (args.includes("--json")) {
        return [...args];
    }

    const execIndex = args.indexOf("exec");

    if (execIndex < 0) {
        return ["--json", ...args];
    }

    return [
        ...args.slice(0, execIndex + 1),
        "--json",
        ...args.slice(execIndex + 1)
    ];
};

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const eventType = (event: unknown): string | undefined => {
    return isObject(event) && typeof event.type === "string" ? event.type : undefined;
};

const hasAssistantText = (event: unknown): boolean => {
    if (!isObject(event) || !isObject(event.item)) {
        return false;
    }

    const item = event.item;

    if (
        item.type === "agent_message"
        && typeof item.text === "string"
        && item.text.includes("CTG_PARITY_OK")
    ) {
        return true;
    }

    return item.type === "message"
        && item.role === "assistant"
        && Array.isArray(item.content)
        && item.content.some((entry) => isObject(entry)
            && typeof entry.text === "string"
            && entry.text.includes("CTG_PARITY_OK"));
};

export const runCodexStreamingParity = async (): Promise<void> => {
    const definition = runnerDefinitions.codex;
    const executable = await assertExecutableAvailable(definition.command);
    const version = await captureVersion(definition.command);
    const prefixArgs = parsePrefixArgs(definition);
    const extraArgs = parseExtraArgs(definition);

    console.log(`SETUP: codex streaming executable=${executable}`);
    console.log(`SETUP: codex streaming version=${version}`);
    console.log(`SETUP: codex streaming prefixArgs=${JSON.stringify(prefixArgs)}`);
    console.log(`SETUP: codex streaming extraArgs=${JSON.stringify(extraArgs)}`);

    const directArgs = [
        ...prefixArgs,
        ...insertJsonAfterExec(definition.baseArgs),
        ...extraArgs,
        PROMPT
    ];
    const direct = await execFileClosedStdin(definition.command, directArgs, {timeout: 120_000});
    const directEvents = parseJsonLines(direct.stdout);

    if (!directEvents.some((event) => eventType(event) === "turn.completed")) {
        throw new ParityFailure("CLI_DRIFT", "codex --json did not emit turn.completed");
    }

    if (!directEvents.some(hasAssistantText)) {
        throw new ParityFailure("MODEL_VARIANCE", `codex --json did not emit assistant text containing CTG_PARITY_OK; stdout=${JSON.stringify(direct.stdout)} stderr=${JSON.stringify(direct.stderr)}`);
    }

    const events: unknown[] = [];
    const runner = new CodexRunner({
        prefixArgs,
        args: extraArgs,
        streamOutput: true,
        streamMode: "events",
        onStream: (event) => {
            events.push(event);
        }
    });
    const result = await runner.run(PROMPT);

    assertSentinel("CodexRunner streaming", result);

    if (!events.some((event) => event instanceof CodexRunnerEvent)) {
        throw new ParityFailure("RUNNER_REGRESSION", "CodexRunner streaming did not emit CodexRunnerEvent");
    }

    if (!events.some((event) => event instanceof CodexRunnerEvent && hasAssistantText(event.payload))) {
        throw new ParityFailure("RUNNER_REGRESSION", "CodexRunner streaming did not emit native event containing CTG_PARITY_OK");
    }

    if (!events.some((event) => event instanceof CodexRunnerEvent && eventType(event.payload) === "turn.completed")) {
        throw new ParityFailure("RUNNER_REGRESSION", "CodexRunner streaming did not emit native usage event");
    }
};
