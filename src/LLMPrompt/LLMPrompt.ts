import { readFileSync } from "node:fs";

import type LLMRunner from "../LLMRunner/LLMRunner.js";

export type LLMPromptTemplateValue = string | number;
export type LLMPromptTemplate = Record<string, LLMPromptTemplateValue>;
export type LLMPromptTemplateDelimiter = readonly [string, string];

export interface LLMPromptTextOptions {
    maxTokens?: number;
    summarize?: boolean;
}

export interface LLMPromptTemplateOptions {
    delimiter?: LLMPromptTemplateDelimiter;
    strict?: boolean;
}

type LLMPromptOperation =
    | {
        type: "append";
        text: string;
        options: LLMPromptTextOptions;
    }
    | {
        type: "read";
        path: string;
        options: LLMPromptTextOptions;
    }
    | {
        type: "template";
        text: string;
        template: LLMPromptTemplate;
        options: LLMPromptTemplateOptions;
    };

export default class LLMPrompt {

    /* Static Fields */
    static readonly DEFAULT_TEMPLATE_DELIMITER: LLMPromptTemplateDelimiter = ["[[", "]]"];

    /* Instance Fields */
    private readonly runner: LLMRunner;                  // Runner that provides model-specific prompt helpers
    private readonly operations: LLMPromptOperation[];   // Deferred prompt construction operations

    // CONSTRUCTOR \\
    constructor(runner: LLMRunner) {
        this.runner = runner;
        this.operations = [];
    }

    /**
     *
     * Instance Method
     *
     */

    // Adds text to stored prompt operations:
    append(text: string, options: LLMPromptTextOptions = {}): this {
        this.operations.push({
            type: "append",
            text,
            options
        });
        return this;
    }

    // Reads text from file path and appends it to stored prompt operations:
    read(path: string, options: LLMPromptTextOptions = {}): this {
        this.operations.push({
            type: "read",
            path,
            options
        });
        return this;
    }

    // Adds templated text to stored prompt operations:
    applyTemplate(
        text: string,
        template: LLMPromptTemplate = {},
        options: LLMPromptTemplateOptions = {}
    ): this {
        this.operations.push({
            type: "template",
            text,
            template,
            options
        });
        return this;
    }

    // Builds the final prompt string by resolving stored operations in order:
    async build(
        prompt: string = "",
        template: LLMPromptTemplate = {},
        templateOptions: LLMPromptTemplateOptions = {}
    ): Promise<string> {
        let result = prompt;

        for (const operation of this.operations) {
            switch (operation.type) {
                case "append":
                    result += await this.prepareText(operation.text, operation.options);
                    break;

                case "read":
                    result += await this.prepareText(readFileSync(operation.path, "utf8"), operation.options);
                    break;

                case "template":
                    result += this.applyTemplateToText(operation.text, {
                        ...template,
                        ...operation.template
                    }, {
                        ...templateOptions,
                        ...operation.options
                    });
                    break;
            }
        }

        return result;
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method \\
    static init(runner: LLMRunner): LLMPrompt {
        return new LLMPrompt(runner);
    }

    /**
     *
     * Private Methods
     *
     */

    // Applies token-aware text options before adding text to the resolved prompt:
    private async prepareText(text: string, options: LLMPromptTextOptions): Promise<string> {
        if (options.maxTokens === undefined) {
            return text;
        }

        if (options.maxTokens < 0) {
            throw new Error("maxTokens must be greater than or equal to 0.");
        }

        let result = text;

        if (options.summarize && await this.runner.tokenCount(result) > options.maxTokens) {
            result = await this.runner.summarize(result);
        }

        if (await this.runner.tokenCount(result) > options.maxTokens) {
            result = await this.truncate(result, options.maxTokens);
        }

        return result;
    }

    // Truncates text to fit within the configured token limit according to token counting:
    private async truncate(
        text: string,
        maxTokens: number
    ): Promise<string> {
        let lower = 0;
        let upper = text.length;

        while (lower < upper) {
            const midpoint = Math.ceil((lower + upper) / 2);
            const candidate = text.slice(0, midpoint);

            if (await this.runner.tokenCount(candidate) <= maxTokens) {
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
        const pattern = new RegExp(
            `${escape(delimiter[0])}([\\s\\S]*?)${escape(delimiter[1])}`,
            "g"
        );

        return text.replace(pattern, (match, key: string) => {
            if (Object.prototype.hasOwnProperty.call(template, key)) {
                return String(template[key]);
            }

            if (strict) {
                throw new Error(`Could not resolve template value "${key}".`);
            }

            return match;
        });
    }

}
