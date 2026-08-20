// Dependencies:
import { execFile } from "node:child_process";
import { LLMRunnerError } from "./LLMRunnerError.js";

/**
 * 
 *  Types 
 * 
 */

// Defines config for how to call an LLM from CLI:
export interface LLMRunnerConfig {
    command: string;          // Command that calls LLM
    cwd?: string;             // What directory LLM is called in
    prefixArgs?: string[];    // Arguments to pass before subclass defaults
    args?: string[];          // Arguments to pass to the command that's calling the LLM
    timeout?: number;         // Milliseconds before execFile terminates the child
    maxBuffer?: number;       // Maximum stdout/stderr buffer size in bytes
    env?: NodeJS.ProcessEnv;  // Complete child environment override
}

// Defines config for a single runner invocation:
export interface LLMRunnerRunConfig {
    args?: string[];    // Arguments to add to this prompt invocation
}

// Defines what to return from an LLM response:
export interface LLMRunnerResult {
    result: string;     // What's returned form stdout
    error: string;      // What's returned from stderr
}

type ExecFileFailure = {
    code?: unknown;
    signal?: unknown;
    stdout?: unknown;
    stderr?: unknown;
};

type ExecFileOutput = {
    stdout: string;
    stderr: string;
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
    protected readonly config: Readonly<LLMRunnerConfig>;

    // CONSTRUCTOR \\
    constructor(config: LLMRunnerConfig) {
        const command = config?.command;

        if (typeof command !== "string" || command.trim() === "") {
            throw new LLMRunnerError("INVALID_OPTIONS", "LLMRunner command must be a non-empty string.", {
                ...(typeof command === "string" ? { command } : {})
            });
        }

        this.validateProcessControls(config);

        const defaults = (this.constructor as typeof LLMRunner).DEFAULT_ARGS;

        this.config = Object.freeze({
            command,
            ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
            ...(config.timeout === undefined ? {} : { timeout: config.timeout }),
            ...(config.maxBuffer === undefined ? {} : { maxBuffer: config.maxBuffer }),
            ...(config.env === undefined ? {} : { env: config.env }),
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
        return this.exec([
            ...(this.config.args ?? []),
            ...(config.args ?? []),
            prompt
        ]);
    }

    // Returns token count for the given text:
    async tokenCount(text: string): Promise<number> {
        return Math.ceil(text.length / 4);
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
    protected async exec(args: string[]): Promise<LLMRunnerResult> {
        try {
            const { stdout, stderr } = await this.execFileWithClosedStdin(args);

            return {result:stdout, error:stderr};
        } catch (cause) {
            throw this.toExecError(args, cause);
        }
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

    // Validates process-control values before invoking child processes:
    private validateProcessControls(config: LLMRunnerConfig): void {
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
