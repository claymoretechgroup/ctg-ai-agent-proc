// Dependencies:
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

/**
 * 
 *  Types 
 * 
 */

// Defines config for how to call an LLM from CLI:
export interface LLMRunnerConfig {
    command: string;    // Command that calls LLM
    cwd?: string;       // What directory LLM is called in
    args?: string[];    // Arguments to pass to the command that's calling the LLM
}

// Defines config for a single prompt invocation:
export interface LLMPromptConfig {
    args?: string[];    // Arguments to add to this prompt invocation
}

// Defines what to return from an LLM response:
export interface LLMRunnerResult {
    result: string;     // What's returned form stdout
    error: string;      // What's returned from stderr
}

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
        const defaults = (this.constructor as typeof LLMRunner).DEFAULT_ARGS;

        this.config = Object.freeze({
            command: config.command,
            ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
            args: [
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
    async run(prompt: string, config: LLMPromptConfig = {}): Promise<LLMRunnerResult> {
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
        const { stdout, stderr } = await execFileAsync(this.config.command, args, {
            cwd: this.config.cwd
        });
        return {result:stdout, error:stderr};
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method \\
    // NOTE: Uses the static `this` constructor so inherited factories return the subclass type.
    static init<C extends LLMRunnerConfig, T extends LLMRunner>(
      this: new (config: C) => T,
      config: C
    ): T {
      return new this(config);
    }

}
