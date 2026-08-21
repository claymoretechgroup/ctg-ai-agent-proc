// Dependencies:
import { execFile, spawn } from "node:child_process";
import { LLMRunnerError } from "./LLMRunnerError.js";
import { LLMTokenMetric } from "../LLMTokenMetric/index.js";

/**
 * 
 *  Types 
 * 
 */

export type LLMRunnerOutputStream = "stdout" | "stderr";
export type LLMRunnerStreamMode = "raw" | "events";

export class LLMRunnerStreamEvent {
    readonly source: string;
    readonly raw?: unknown;

    constructor(source: string, raw?: unknown) {
        this.source = source;
        this.raw = raw;
    }
}

export class LLMRunnerOutputEvent extends LLMRunnerStreamEvent {
    readonly stream: LLMRunnerOutputStream;
    readonly chunk: string;

    constructor(source: string, stream: LLMRunnerOutputStream, chunk: string, raw?: unknown) {
        super(source, raw);
        this.stream = stream;
        this.chunk = chunk;
    }
}

export type LLMRunnerStreamHandler = (event: LLMRunnerStreamEvent) => void;

// Defines construction config for a runner:
export interface LLMRunnerConfig {
    command: string;               // CLI command used to invoke the runner
    cwd?: string;                  // Working directory for child process calls
    prefixArgs?: string[];         // Arguments placed before subclass defaults
    args?: string[];               // Arguments placed after subclass defaults
    timeout?: number;              // Milliseconds before execFile terminates the child
    maxBuffer?: number;            // Maximum stdout/stderr buffer size in bytes
    env?: NodeJS.ProcessEnv;       // Complete child environment override
    tokenMetric?: LLMTokenMetric;  // Token counting dependency for prompt operations
    streamOutput?: boolean;        // Whether to use the streaming spawn path
    streamMode?: LLMRunnerStreamMode;       // Streaming contract to emit
    onStream?: LLMRunnerStreamHandler;      // Streaming event callback
}

// Defines config for a single runner invocation:
export interface LLMRunnerRunConfig {
    args?: string[];                    // Arguments placed after constructor args and before the prompt
    streamOutput?: boolean;             // Per-run streaming override
    streamMode?: LLMRunnerStreamMode;   // Per-run streaming contract
    onStream?: LLMRunnerStreamHandler;  // Per-run streaming event callback
}

// Defines what to return from an LLM response:
export interface LLMRunnerResult {
    result: string;     // Process stdout
    error: string;      // Process stderr
}

// Defines native execFile failure details used for public error wrapping:
type ExecFileFailure = {
    code?: unknown;
    signal?: unknown;
    stdout?: unknown;
    stderr?: unknown;
};

// Defines successful execFile output:
type ExecFileOutput = {
    stdout: string;
    stderr: string;
};

export type LLMRunnerProcessOutput = {
    stdout: string;
    stderr: string;
};

export type LLMRunnerExecutionContext = {
    streamOutput: boolean;
    streamMode?: LLMRunnerStreamMode;
    onStream?: LLMRunnerStreamHandler;
};

/**
 * 
 *  Class 
 * 
 */

// Base class that handles sending prompts to an LLM using the CLI:
export default class LLMRunner {

    /* Static Fields */
    static readonly DEFAULT_ARGS: readonly string[] = [];

    /* Instance Fields */
    protected readonly config: Readonly<LLMRunnerConfig>;  // Frozen child-process execution config
    protected readonly tokenMetric: LLMTokenMetric;        // Token counting dependency

    // CONSTRUCTOR \\
    constructor(config: LLMRunnerConfig) {
        const command = config?.command;

        if (typeof command !== "string" || command.trim() === "") {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner command must be a non-empty string.", {
                ...(typeof command === "string" ? { command } : {})
            });
        }

        this.validateConfig(config);

        const defaults = (this.constructor as typeof LLMRunner).DEFAULT_ARGS;

        this.tokenMetric = config.tokenMetric ?? new LLMTokenMetric();
        this.config = Object.freeze({
            command,
            ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
            ...(config.timeout === undefined ? {} : { timeout: config.timeout }),
            ...(config.maxBuffer === undefined ? {} : { maxBuffer: config.maxBuffer }),
            ...(config.env === undefined ? {} : { env: config.env }),
            ...(config.streamOutput === undefined ? {} : { streamOutput: config.streamOutput }),
            ...(config.streamOutput === true ? { streamMode: config.streamMode ?? "raw" } : {}),
            ...(config.onStream === undefined ? {} : { onStream: config.onStream }),
            args: [
                ...(config.prefixArgs ?? []),
                ...defaults,
                ...(config.args ?? [])
            ]
        });
    }

    /**
     *
     * Instance Methods
     *
     */

    // Sends prompt to LLM for processing and returns promise of respone:
    // NOTE: This assumes that the "prompt" is always the last argument to be passed to the LLM CLI:
    async run(prompt: string, config: LLMRunnerRunConfig = {}): Promise<LLMRunnerResult> {
        this.validateRunConfig(config);

        return this.exec([
            ...(this.config.args ?? []),
            ...(config.args ?? []),
            prompt
        ], this.createExecutionContext(config));
    }

    // Returns token count for the given text:
    async tokenCount(text: string): Promise<number> {
        return await this.tokenMetric.count(text);
    }

    // Summarizes text. LLMPrompt enforces token budgets after summarization.
    async summarize(text: string): Promise<string> {
        const result = await this.run(`Summarize this text:\n\n${text}`);

        return result.result;
    }

    /**
     *
     * Protected Methods
     *
     */

    // Runs command and returns result:
    protected async exec(args: string[], context: LLMRunnerExecutionContext = this.createExecutionContext()): Promise<LLMRunnerResult> {
        const commandArgs = context.streamOutput
            ? this.buildStreamArgs(args, context)
            : args;

        try {
            const { stdout, stderr } = context.streamOutput
                ? await this.spawnWithClosedStdin(commandArgs, context)
                : await this.execFileWithClosedStdin(commandArgs);

            return {result:stdout, error:stderr};
        } catch (cause) {
            throw this.toExecError(commandArgs, cause);
        }
    }

    // Allows concrete runners to add stream-mode-specific CLI flags:
    protected buildStreamArgs(args: string[], _context: LLMRunnerExecutionContext): string[] {
        return args;
    }

    // Allows concrete runners to parse stream chunks:
    protected handleStreamChunk(
        stream: LLMRunnerOutputStream,
        chunk: string,
        raw: Buffer,
        context: LLMRunnerExecutionContext
    ): void {
        if (context.streamMode !== "raw") {
            return;
        }

        this.emitStream(new LLMRunnerOutputEvent(this.streamSource(), stream, chunk, raw), context);
    }

    // Allows concrete runners to preserve final result semantics for structured streams:
    protected finalizeStreamOutput(
        output: LLMRunnerProcessOutput,
        _context: LLMRunnerExecutionContext
    ): LLMRunnerProcessOutput {
        return output;
    }

    // Emits a stream event while isolating observer failures:
    protected emitStream(event: LLMRunnerStreamEvent, context: LLMRunnerExecutionContext): void {
        if (context.onStream === undefined) {
            return;
        }

        try {
            context.onStream(event);
        } catch {
            // Streaming observers must not change child-process execution semantics.
        }
    }

    // Returns the stream event source identifier:
    protected streamSource(): string {
        return this.constructor.name;
    }

    // Spawns the runner process and closes stdin so CLIs do not wait for extra piped input:
    private execFileWithClosedStdin(args: string[]): Promise<ExecFileOutput> {
        return new Promise((resolve, reject) => {
            const child = execFile(this.config.command, args, {
                cwd: this.config.cwd,
                timeout: this.config.timeout,
                maxBuffer: this.config.maxBuffer,
                env: this.config.env
            }, (error, stdout, stderr) => {
                if (error) {
                    Object.assign(error, {stdout, stderr});
                    reject(error);
                    return;
                }

                resolve({stdout, stderr});
            });

            child.stdin?.on("error", () => {
                // A fast-exiting child may close before stdin.end(); stdout/stderr callback owns result state.
            });
            child.stdin?.end();
        });
    }

    // Spawns the runner process for streaming calls and still accumulates final output:
    private spawnWithClosedStdin(args: string[], context: LLMRunnerExecutionContext): Promise<ExecFileOutput> {
        return new Promise((resolve, reject) => {
            const child = spawn(this.config.command, args, {
                cwd: this.config.cwd,
                env: this.config.env
            });
            let settled = false;
            let stdout = "";
            let stderr = "";
            let stdoutBytes = 0;
            let stderrBytes = 0;
            let timedOut = false;
            let timer: NodeJS.Timeout | null = null;

            const settle = (fn: () => void): void => {
                if (settled) {
                    return;
                }

                settled = true;
                if (timer !== null) {
                    clearTimeout(timer);
                }
                fn();
            };

            const rejectWith = (cause: Error & ExecFileFailure): void => {
                Object.assign(cause, {stdout, stderr});
                settle(() => reject(cause));
            };

            const append = (stream: LLMRunnerOutputStream, raw: Buffer): void => {
                const chunk = raw.toString();

                if (stream === "stdout") {
                    stdout += chunk;
                    stdoutBytes += raw.length;
                } else {
                    stderr += chunk;
                    stderrBytes += raw.length;
                }

                this.handleStreamChunk(stream, chunk, raw, context);

                if (
                    this.config.maxBuffer !== undefined
                    && (stdoutBytes > this.config.maxBuffer || stderrBytes > this.config.maxBuffer)
                ) {
                    const error = new Error(`stdout/stderr maxBuffer length exceeded`) as Error & ExecFileFailure;

                    error.code = "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
                    child.kill();
                    rejectWith(error);
                }
            };

            child.stdout?.on("data", (chunk: Buffer) => {
                append("stdout", chunk);
            });
            child.stderr?.on("data", (chunk: Buffer) => {
                append("stderr", chunk);
            });
            child.on("error", (error: Error & ExecFileFailure) => {
                rejectWith(error);
            });
            child.on("close", (code, signal) => {
                if (settled) {
                    return;
                }

                if (code === 0 && !timedOut) {
                    settle(() => resolve(this.finalizeStreamOutput({stdout, stderr}, context)));
                    return;
                }

                const error = new Error(`Command failed: ${this.config.command}`) as Error & ExecFileFailure;

                if (typeof code === "number") {
                    error.code = code;
                }
                if (typeof signal === "string") {
                    error.signal = signal;
                }

                rejectWith(error);
            });

            if (this.config.timeout !== undefined && this.config.timeout > 0) {
                timer = setTimeout(() => {
                    timedOut = true;
                    child.kill();
                }, this.config.timeout);
            }

            child.stdin?.on("error", () => {
                // A fast-exiting child may close before stdin.end(); close/error events own result state.
            });
            child.stdin?.end();
        });
    }

    // Converts native execFile failures into the public runner error type:
    private toExecError(args: string[], cause: unknown): LLMRunnerError {
        const failure = cause as ExecFileFailure;
        const commandMissing = failure.code === "ENOENT";

        return new LLMRunnerError(
            commandMissing ? "COMMAND_NOT_FOUND" : "COMMAND_FAILED",
            commandMissing
                ? `LLM runner command not found: ${this.config.command}.`
                : `LLM runner command failed: ${this.config.command}.`,
            {
                command: this.config.command,
                args: [...args],
                ...(this.config.cwd === undefined ? {} : { cwd: this.config.cwd }),
                ...(typeof failure.code === "number" ? { exitCode: failure.code } : {}),
                ...(typeof failure.signal === "string" ? { signal: failure.signal } : {}),
                ...(typeof failure.stdout === "string" ? { stdout: failure.stdout } : {}),
                ...(typeof failure.stderr === "string" ? { stderr: failure.stderr } : {}),
                cause
            }
        );
    }

    // Validates construction config before invoking child processes:
    private validateConfig(config: LLMRunnerConfig): void {
        if (
            config.timeout !== undefined
            && (!Number.isInteger(config.timeout) || config.timeout < 0)
        ) {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner timeout must be a non-negative finite integer.", {
                command: config.command
            });
        }

        if (
            config.maxBuffer !== undefined
            && (!Number.isInteger(config.maxBuffer) || config.maxBuffer <= 0)
        ) {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner maxBuffer must be a positive finite integer.", {
                command: config.command
            });
        }

        if (
            config.tokenMetric !== undefined
            && !(config.tokenMetric instanceof LLMTokenMetric)
        ) {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner tokenMetric must be an LLMTokenMetric instance.", {
                command: config.command
            });
        }

        this.validateStreamingConfig(config, config.command);
    }

    // Validates per-run config before invoking child processes:
    private validateRunConfig(config: LLMRunnerRunConfig): void {
        if (config.streamOutput !== undefined && typeof config.streamOutput !== "boolean") {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner streamOutput must be a boolean.", {
                command: this.config.command
            });
        }

        if (
            config.streamMode !== undefined
            && config.streamMode !== "raw"
            && config.streamMode !== "events"
        ) {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner streamMode must be raw or events.", {
                command: this.config.command
            });
        }

        if (config.onStream !== undefined && typeof config.onStream !== "function") {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner onStream must be a function.", {
                command: this.config.command
            });
        }

        if (
            (config.streamMode !== undefined || config.onStream !== undefined)
            && (config.streamOutput ?? this.config.streamOutput ?? false) !== true
        ) {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner streaming options require streamOutput: true.", {
                command: this.config.command
            });
        }
    }

    // Validates streaming options for constructor and per-run configs:
    private validateStreamingConfig(
        config: Pick<LLMRunnerConfig, "streamOutput" | "streamMode" | "onStream">,
        command: string
    ): void {
        if (config.streamOutput !== undefined && typeof config.streamOutput !== "boolean") {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner streamOutput must be a boolean.", {
                command
            });
        }

        if (
            config.streamMode !== undefined
            && config.streamMode !== "raw"
            && config.streamMode !== "events"
        ) {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner streamMode must be raw or events.", {
                command
            });
        }

        if (config.onStream !== undefined && typeof config.onStream !== "function") {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner onStream must be a function.", {
                command
            });
        }

        if (
            config.streamOutput !== true
            && (config.streamMode !== undefined || config.onStream !== undefined)
        ) {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner streaming options require streamOutput: true.", {
                command
            });
        }
    }

    // Resolves constructor/per-run streaming options:
    private createExecutionContext(config: LLMRunnerRunConfig = {}): LLMRunnerExecutionContext {
        const streamOutput = config.streamOutput ?? this.config.streamOutput ?? false;

        if (!streamOutput) {
            return { streamOutput: false };
        }

        return {
            streamOutput: true,
            streamMode: config.streamMode ?? this.config.streamMode ?? "raw",
            onStream: config.onStream ?? this.config.onStream
        };
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method \\
    // NOTE: Uses the static `this` constructor so inherited factories return the subclass type.
    // OVERLOAD: Supports subclasses with constructors that take no config.
    static init<T extends LLMRunner>(this: new () => T): T;

    // OVERLOAD: Supports classes that require constructor config.
    static init<C, T extends LLMRunner>(
        this: new (config: C) => T,
        config: C
    ): T;

    // IMPLEMENTATION: Broad enough to satisfy both overload signatures.
    static init<C, T extends LLMRunner>(
        this: new (config?: C) => T,
        config?: C
    ): T {
        return new this(config);
    }

}
