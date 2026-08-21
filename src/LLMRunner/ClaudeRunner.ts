import LLMRunner, {
    LLMRunnerStreamEvent
} from "./LLMRunner.js";

import type {
    LLMRunnerConfig,
    LLMRunnerExecutionContext,
    LLMRunnerOutputStream,
    LLMRunnerProcessOutput
} from "./LLMRunner.js";

type ClaudeStreamState = {
    buffer: string;
    finalResult?: string;
};

export class ClaudeRunnerEvent extends LLMRunnerStreamEvent {
    readonly type?: string;
    readonly payload: unknown;

    constructor(source: string, payload: unknown) {
        super(source, payload);
        this.payload = payload;
        this.type = ClaudeRunnerEvent.eventType(payload);
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

export default class ClaudeRunner extends LLMRunner {

    /**
     *
     * Static Fields
     *
     */

    static override readonly DEFAULT_ARGS = [
        "--safe-mode",
        "--print"
    ] as const;

    /* Instance Fields */
    private readonly streamStates = new WeakMap<LLMRunnerExecutionContext, ClaudeStreamState>();

    // CONSTRUCTOR \\
    constructor(config: Partial<LLMRunnerConfig> = {}) {
        super({
            command: config.command ?? "claude",
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

        if (args.includes("--output-format")) {
            return args.includes("--verbose") ? args : this.insertBeforePrompt(args, ["--verbose"]);
        }

        return this.insertBeforePrompt(args, ["--output-format", "stream-json", "--verbose"]);
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

    private insertBeforePrompt(args: string[], inserted: string[]): string[] {
        if (args.length === 0) {
            return inserted;
        }

        return [
            ...args.slice(0, -1),
            ...inserted,
            args[args.length - 1] as string
        ];
    }

    private stateFor(context: LLMRunnerExecutionContext): ClaudeStreamState {
        let state = this.streamStates.get(context);

        if (state === undefined) {
            state = {
                buffer: ""
            };
            this.streamStates.set(context, state);
        }

        return state;
    }

    private parseAvailableLines(context: LLMRunnerExecutionContext, state: ClaudeStreamState): void {
        let newlineIndex = state.buffer.indexOf("\n");

        while (newlineIndex >= 0) {
            const line = state.buffer.slice(0, newlineIndex);

            state.buffer = state.buffer.slice(newlineIndex + 1);
            this.parseLine(line, context, state);
            newlineIndex = state.buffer.indexOf("\n");
        }
    }

    private parseBufferedLine(context: LLMRunnerExecutionContext, state: ClaudeStreamState): void {
        const line = state.buffer;

        state.buffer = "";
        this.parseLine(line, context, state);
    }

    private parseLine(line: string, context: LLMRunnerExecutionContext, state: ClaudeStreamState): void {
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

        this.emitStream(new ClaudeRunnerEvent(this.streamSource(), payload), context);
        this.captureFinalResult(payload, state);
    }

    private captureFinalResult(payload: unknown, state: ClaudeStreamState): void {
        const result = this.extractResult(payload);
        const text = this.extractAssistantText(payload);

        if (text !== undefined) {
            state.finalResult = text;
        }

        if (result !== undefined) {
            state.finalResult = result;
        }
    }

    private extractResult(payload: unknown): string | undefined {
        if (
            typeof payload === "object"
            && payload !== null
            && "result" in payload
            && typeof payload.result === "string"
        ) {
            return payload.result;
        }

        return undefined;
    }

    private extractAssistantText(payload: unknown): string | undefined {
        if (typeof payload !== "object" || payload === null || !("message" in payload)) {
            return undefined;
        }

        const message = payload.message;

        if (
            typeof message !== "object"
            || message === null
            || !("content" in message)
            || !Array.isArray(message.content)
        ) {
            return undefined;
        }

        const text = message.content
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
