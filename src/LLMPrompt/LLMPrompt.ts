// Dependencies:
import { readFileSync } from "node:fs";

import type LLMRunner from "../LLMRunner/LLMRunner.js";
import type { LLMRunnerResult } from "../LLMRunner/LLMRunner.js";
import { LLMPromptError } from "./LLMPromptError.js";

/**
 * 
 *  Types 
 * 
 */

// Defines a valid value that can replace a template key:
export type LLMPromptTemplateValue = string | number;

// Defines template values keyed by template name:
export type LLMPromptTemplate = Record<string, LLMPromptTemplateValue>;

// Defines the opening and closing markers that surround template keys:
export type LLMPromptTemplateDelimiter = readonly [string, string];

// Defines options for how template replacements are applied:
export interface LLMPromptTemplateOptions {
    delimiter?: LLMPromptTemplateDelimiter;    // Template key markers; defaults to [[ ]]
    strict?: boolean;                          // Whether missing template keys throw errors
}

// Defines prompt construction behavior:
export interface LLMPromptOptions {
    cache?: boolean;    // Whether to cache the resolved prompt between runs
}

// Defines stored prompt operations to resolve when the prompt is run:
type LLMPromptOperation = {type: "append",text: string}
    | {type: "appendFile",path: string}
    | {type: "summarize"}
    | {type: "summarizeText",text: string}
    | {type: "summarizeFile",path: string}
    | {type: "truncate",maxTokens: number}
    | {type: "truncateText",text: string,maxTokens: number}
    | {type: "truncateFile",path: string,maxTokens: number}
    | {type: "applyTemplate",template: LLMPromptTemplate,options: LLMPromptTemplateOptions}
    | {type: "applyTemplateText",text: string,template: LLMPromptTemplate,options: LLMPromptTemplateOptions}
    | {type: "applyTemplateFile",path: string,template: LLMPromptTemplate,options: LLMPromptTemplateOptions}
    | {type: "join",prompt: LLMPrompt};

/**
 * 
 *  Class 
 * 
 */

// Composable prompt builder for LLM runners to operate on:
export default class LLMPrompt {

    /* Static Fields */
    static readonly DEFAULT_TEMPLATE_DELIMITER: LLMPromptTemplateDelimiter = ["[[", "]]"];

    /* Instance Fields */
    private readonly config: Readonly<Required<LLMPromptOptions>>;  // Config options for prompt builder
    private readonly operations: LLMPromptOperation[];              // Stores what operations are used to build the prompt with
    private cachedPrompt: string | null = null;                     // Stores the resolved prompt when caching is enabled

    // CONSTRUCTOR \\
    constructor(prompt = "", config: LLMPromptOptions = {}) {
        
        // Sets immutable config: 
        this.config = Object.freeze({
            cache: config.cache ?? false
        });

        // Store initial prompt as an "append" operation: 
        this.operations = prompt === ""
            ? []
            : [{type: "append",text: prompt}];
    }

    /**
     *
     * Instance Methods
     *
     */

    // Adds text to stored prompt operations:
    append(text: string): this {
        this.operations.push({type: "append",text});
        return this;
    }

    // Adds file contents to stored prompt operations:
    appendFile(path: string): this {
        this.operations.push({type: "appendFile",path});
        return this;
    }

    // Summarizes the stored prompt when run:
    summarize(): this {
        this.operations.push({type: "summarize"});
        return this;
    }

    // Summarizes text when run and appends the result to the stored prompt:
    summarizeText(text: string): this {
        this.operations.push({type: "summarizeText",text});
        return this;
    }

    // Summarizes file contents when run and appends the result to the stored prompt:
    summarizeFile(path: string): this {
        this.operations.push({type: "summarizeFile",path});
        return this;
    }

    // Truncates the stored prompt when run:
    truncate(maxTokens: number): this {
        this.operations.push({type: "truncate",maxTokens});
        return this;
    }

    // Truncates text when run and appends the result to the stored prompt:
    truncateText(text: string, maxTokens: number): this {
        this.operations.push({type: "truncateText",text,maxTokens});
        return this;
    }

    // Truncates file contents when run and appends the result to the stored prompt:
    truncateFile(path: string, maxTokens: number): this {
        this.operations.push({type: "truncateFile",path,maxTokens});
        return this;
    }

    // Applies template values to the stored prompt when run:
    applyTemplate(
        template: LLMPromptTemplate = {},
        options: LLMPromptTemplateOptions = {}
    ): this {
        this.operations.push({type: "applyTemplate",template,options});
        return this;
    }

    // Applies template values to text and appends the result to the stored prompt:
    applyTemplateText(
        text: string,
        template: LLMPromptTemplate = {},
        options: LLMPromptTemplateOptions = {}
    ): this {
        this.operations.push({
            type: "applyTemplateText",
            text,
            template,
            options
        });
        return this;
    }

    // Applies template values to file contents and appends the result to the stored prompt:
    applyTemplateFile(
        path: string,
        template: LLMPromptTemplate = {},
        options: LLMPromptTemplateOptions = {}
    ): this {
        this.operations.push({
            type: "applyTemplateFile",
            path,
            template,
            options
        });
        return this;
    }

    // Resolves another reusable prompt and appends its result to this prompt:
    join(prompt: LLMPrompt): this {
        this.operations.push({type: "join",prompt});
        return this;
    }

    // Builds the prompt, passes it to the runner, and returns result:
    async run(runner: LLMRunner): Promise<LLMRunnerResult> {
        return runner.run(await this.getPrompt(runner));
    }

    // Clears the resolved prompt cache:
    resetCache(): this {
        if (!this.config.cache) {
            throw new LLMPromptError(
                "INVALID_OPTIONS",
                "LLMPrompt cache cannot be reset when caching is not enabled."
            );
        }
        this.cachedPrompt = null;
        return this;
    }

    /**
     *
     * Private Methods
     *
     */

    // Returns a cached prompt when available, otherwise builds it:
    private async getPrompt(runner: LLMRunner): Promise<string> {
        return this.config.cache && this.cachedPrompt !== null
            ? this.cachedPrompt
            : await this.build(runner);
    }

    // Builds the final prompt string by resolving stored operations in order:
    private async build(runner: LLMRunner): Promise<string> {
        
        // Stores resulting prompt:
        let result = "";

        for (const operation of this.operations) {
            
            switch (operation.type) {
                
                case "append":
                    result += operation.text;
                    break;

                case "appendFile":
                    result += this.readTextFile(operation.path);
                    break;

                case "summarize":
                    result = await runner.summarize(result);
                    break;

                case "summarizeText":
                    result += await runner.summarize(operation.text);
                    break;

                case "summarizeFile":
                    result += await runner.summarize(this.readTextFile(operation.path));
                    break;

                case "truncate":
                    result = await this.truncateToTokenCount(
                        runner, result, 
                        operation.maxTokens
                    );
                    break;

                case "truncateText":
                    result += await this.truncateToTokenCount(
                        runner, 
                        operation.text, 
                        operation.maxTokens
                    );
                    break;

                case "truncateFile":
                    result += await this.truncateToTokenCount(
                        runner,
                        this.readTextFile(operation.path),
                        operation.maxTokens
                    );
                    break;

                case "applyTemplate":
                    result = this.applyTemplateToText(
                        result, 
                        operation.template, 
                        operation.options
                    );
                    break;

                case "applyTemplateText":
                    result += this.applyTemplateToText(
                        operation.text, 
                        operation.template, 
                        operation.options
                    );
                    break;

                case "applyTemplateFile":
                    result += this.applyTemplateToText(
                        this.readTextFile(operation.path),
                        operation.template,
                        operation.options
                    );
                    break;

                case "join":
                    result += await operation.prompt.getPrompt(runner);
                    break;

                default: {

                    const operationType = (operation as {type?: string}).type ?? "unknown";
                    throw new LLMPromptError(
                        "UNKNOWN_OPERATION",
                        `Unknown LLMPrompt operation "${operationType}".`,
                        {operationType}
                    );
                
                }
            }
        }

        // Store result in cache if caching is enabled:
        if (this.config.cache) {
            this.cachedPrompt = result;
        }

        return result;
    }

    // Reads text from disk and wraps filesystem failures in prompt errors:
    private readTextFile(path: string): string {
        try {
            return readFileSync(path, "utf8");
        } catch (cause) {
            throw new LLMPromptError("READ_FAILED", `Could not read prompt file "${path}".`, {path, cause});
        }
    }

    // Truncates text to fit within the configured token limit according to token counting:
    private async truncateToTokenCount(runner: LLMRunner, text: string, maxTokens: number): Promise<string> {
        
        if (maxTokens < 0) {
            throw new LLMPromptError("INVALID_OPTIONS", "maxTokens must be greater than or equal to 0.", {
                maxTokens
            });
        }

        let lower = 0;
        let upper = text.length;

        while (lower < upper) {
            const midpoint = Math.ceil((lower + upper) / 2);
            const candidate = text.slice(0, midpoint);

            if (await runner.tokenCount(candidate) <= maxTokens) {
                lower = midpoint;
            } else {
                upper = midpoint - 1;
            }
        }

        return text.slice(0, lower);
    }

    // Applies a template replacement pass to the given text:
    private applyTemplateToText(
        text: string,
        template: LLMPromptTemplate,
        options: LLMPromptTemplateOptions
    ): string {

        const delimiter = options.delimiter ?? LLMPrompt.DEFAULT_TEMPLATE_DELIMITER;
        const strict = options.strict ?? true;
        const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`${escape(delimiter[0])}([\\s\\S]*?)${escape(delimiter[1])}`,"g");

        return text.replace(pattern, (match, key: string) => {
            if (Object.prototype.hasOwnProperty.call(template, key)) {
                return String(template[key]);
            }

            if (strict) {
                throw new LLMPromptError("TEMPLATE_VALUE_NOT_FOUND", `Could not resolve template value "${key}".`, {
                    key
                });
            }

            return match;
        });
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method \\
    static init(prompt = "", config: LLMPromptOptions = {}): LLMPrompt {
        return new LLMPrompt(prompt, config);
    }

}
