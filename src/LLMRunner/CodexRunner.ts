import LLMRunner, {
    LLMRunnerStreamEvent
} from "./LLMRunner.js";

import type {
    LLMRunnerConfig,
    LLMRunnerExecutionContext,
    LLMRunnerOutputStream,
    LLMRunnerProcessOutput
} from "./LLMRunner.js";

type CodexStreamState = {
    buffer: string;
    finalResult?: string;
};

export class CodexRunnerEvent extends LLMRunnerStreamEvent {
    readonly type?: string;
    readonly payload: unknown;

    constructor(source: string, payload: unknown) {
        super(source, payload);
        this.payload = payload;
        this.type = CodexRunnerEvent.eventType(payload);
    }

    private static eventType(payload: unknown): string | undefined {
        if (
            typeof payload === "object"
            && payload !== null
            && "type" in payload
            && typeof payload.type === "string"
        ) {
            return payload.type;
        }

        return undefined;
    }
}

export default class CodexRunner extends LLMRunner {

    /* Static Fields */
    static override readonly DEFAULT_ARGS = [
        "exec",
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "-c",
        "project_root_markers=[]",
        "-c",
        "project_doc_max_bytes=0",
        "-c",
        "features.memories=false",
        "-c",
        "memories.use_memories=false"
    ] as const;

    /* Instance Fields */
    private readonly streamStates = new WeakMap<LLMRunnerExecutionContext, CodexStreamState>();

    // CONSTRUCTOR \\
    constructor(config: Partial<LLMRunnerConfig> = {}) {
        super({
            command: config.command ?? "codex",
            ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
            ...(config.prefixArgs === undefined ? {} : { prefixArgs: config.prefixArgs }),
            ...(config.args === undefined ? {} : { args: config.args }),
            ...(config.timeout === undefined ? {} : { timeout: config.timeout }),
            ...(config.maxBuffer === undefined ? {} : { maxBuffer: config.maxBuffer }),
            ...(config.env === undefined ? {} : { env: config.env }),
            ...(config.tokenMetric === undefined ? {} : { tokenMetric: config.tokenMetric }),
            ...(config.streamOutput === undefined ? {} : { streamOutput: config.streamOutput }),
            ...(config.streamMode === undefined ? {} : { streamMode: config.streamMode }),
            ...(config.onStream === undefined ? {} : { onStream: config.onStream })
        });
    }

    /**
     *
     * Protected Methods
     *
     */

    protected override buildStreamArgs(args: string[], context: LLMRunnerExecutionContext): string[] {
        if (context.streamMode !== "events") {
            return args;
        }

        this.streamStates.set(context, {
            buffer: ""
        });

        if (args.includes("--json")) {
            return args;
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
    }

    protected override handleStreamChunk(
        stream: LLMRunnerOutputStream,
        chunk: string,
        raw: Buffer,
        context: LLMRunnerExecutionContext
    ): void {
        if (context.streamMode !== "events" || stream !== "stdout") {
            super.handleStreamChunk(stream, chunk, raw, context);
            return;
        }

        const state = this.stateFor(context);

        state.buffer += chunk;
        this.parseAvailableLines(context, state);
    }

    protected override finalizeStreamOutput(
        output: LLMRunnerProcessOutput,
        context: LLMRunnerExecutionContext
    ): LLMRunnerProcessOutput {
        if (context.streamMode !== "events") {
            return output;
        }

        const state = this.stateFor(context);

        this.parseBufferedLine(context, state);

        return {
            stdout: state.finalResult ?? output.stdout,
            stderr: output.stderr
        };
    }

    /**
     *
     * Private Methods
     *
     */

    private stateFor(context: LLMRunnerExecutionContext): CodexStreamState {
        let state = this.streamStates.get(context);

        if (state === undefined) {
            state = {
                buffer: ""
            };
            this.streamStates.set(context, state);
        }

        return state;
    }

    private parseAvailableLines(context: LLMRunnerExecutionContext, state: CodexStreamState): void {
        let newlineIndex = state.buffer.indexOf("\n");

        while (newlineIndex >= 0) {
            const line = state.buffer.slice(0, newlineIndex);

            state.buffer = state.buffer.slice(newlineIndex + 1);
            this.parseLine(line, context, state);
            newlineIndex = state.buffer.indexOf("\n");
        }
    }

    private parseBufferedLine(context: LLMRunnerExecutionContext, state: CodexStreamState): void {
        const line = state.buffer;

        state.buffer = "";
        this.parseLine(line, context, state);
    }

    private parseLine(line: string, context: LLMRunnerExecutionContext, state: CodexStreamState): void {
        const trimmed = line.trim();

        if (trimmed === "") {
            return;
        }

        let payload: unknown;

        try {
            payload = JSON.parse(trimmed);
        } catch {
            return;
        }

        this.emitStream(new CodexRunnerEvent(this.streamSource(), payload), context);
        this.captureFinalResult(payload, state);
    }

    private captureFinalResult(payload: unknown, state: CodexStreamState): void {
        const text = this.extractAssistantText(payload);

        if (text !== undefined) {
            state.finalResult = text;
        }
    }

    private extractAssistantText(payload: unknown): string | undefined {
        if (typeof payload !== "object" || payload === null || !("item" in payload)) {
            return undefined;
        }

        const item = payload.item;

        if (
            typeof item === "object"
            && item !== null
            && "type" in item
            && item.type === "agent_message"
            && "text" in item
            && typeof item.text === "string"
        ) {
            return item.text === "" ? undefined : item.text;
        }

        if (
            typeof item !== "object"
            || item === null
            || !("type" in item)
            || item.type !== "message"
            || !("role" in item)
            || item.role !== "assistant"
            || !("content" in item)
            || !Array.isArray(item.content)
        ) {
            return undefined;
        }

        const text = item.content
            .map((entry) => {
                if (
                    typeof entry === "object"
                    && entry !== null
                    && "text" in entry
                    && typeof entry.text === "string"
                ) {
                    return entry.text;
                }

                return "";
            })
            .join("");

        return text === "" ? undefined : text;
    }

}
