import { LLMPromptTemplateError } from "./LLMPromptTemplateError.js";

/**
 * 
 *  Types 
 * 
 */

// Defines a valid value that can replace a template key:
export type LLMPromptTemplateValue = string | number;

// Defines template values keyed by template name:
export type LLMPromptTemplateValues = Record<string, LLMPromptTemplateValue>;

// Defines the opening and closing markers that surround template keys:
export type LLMPromptTemplateDelimiter = readonly [string, string];

// Defines prompt template construction behavior:
export interface LLMPromptTemplateConfig {
    values?: LLMPromptTemplateValues;          // Values used to resolve template placeholders
    delimiter?: LLMPromptTemplateDelimiter;    // Template key markers; defaults to [[ ]]
    strict?: boolean;                          // Whether missing template keys throw errors
}

/**
 * 
 *  Class 
 * 
 */

// Immutable applicator for replacing template placeholders in text:
export default class LLMPromptTemplate {

    /* Static Fields */
    static readonly DEFAULT_DELIMITER: LLMPromptTemplateDelimiter = ["[[", "]]"];

    /* Instance Fields */
    private readonly values: Readonly<LLMPromptTemplateValues>;  // Values used to resolve placeholders
    private readonly delimiter: LLMPromptTemplateDelimiter;      // Template key markers
    private readonly strict: boolean;                            // Whether missing template keys throw errors

    // CONSTRUCTOR \\
    constructor(config: LLMPromptTemplateConfig = {}) {
        this.validateDelimiter(config.delimiter);

        this.values = Object.freeze(this.copyOwnValues(config.values ?? {}));
        this.delimiter = Object.freeze([
            ...(config.delimiter ?? LLMPromptTemplate.DEFAULT_DELIMITER)
        ]) as unknown as LLMPromptTemplateDelimiter;
        this.strict = config.strict ?? true;
    }

    /**
     *
     * Instance Methods
     *
     */

    // Applies configured template values to the given text:
    apply(text: string): string {
        const delimiter = this.delimiter;
        const pattern = new RegExp(`${this.escape(delimiter[0])}([\\s\\S]*?)${this.escape(delimiter[1])}`, "g");

        return text.replace(pattern, (match, key: string) => {
            if (Object.prototype.hasOwnProperty.call(this.values, key)) {
                return String(this.values[key]);
            }

            if (this.strict) {
                throw new LLMPromptTemplateError(
                    "TEMPLATE_VALUE_NOT_FOUND",
                    `Could not resolve template value "${key}".`,
                    { key }
                );
            }

            return match;
        });
    }

    /**
     *
     * Private Methods
     *
     */

    // Copies only own enumerable values into a plain object:
    private copyOwnValues(values: LLMPromptTemplateValues): LLMPromptTemplateValues {
        const copy: LLMPromptTemplateValues = {};

        for (const key of Object.keys(values)) {
            copy[key] = values[key] as LLMPromptTemplateValue;
        }

        return copy;
    }

    // Escapes a delimiter for literal regular-expression matching:
    private escape(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // Validates template delimiters before storing config:
    private validateDelimiter(delimiter: LLMPromptTemplateDelimiter | undefined): void {
        if (delimiter === undefined) {
            return;
        }

        if (
            delimiter.length !== 2
            || typeof delimiter[0] !== "string"
            || typeof delimiter[1] !== "string"
            || delimiter[0] === ""
            || delimiter[1] === ""
            || delimiter[0] === delimiter[1]
        ) {
            throw new LLMPromptTemplateError(
                "INVALID_OPTIONS",
                "Template delimiter must contain two non-empty distinct strings.",
                { delimiter }
            );
        }
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method \\
    static init(config: LLMPromptTemplateConfig = {}): LLMPromptTemplate {
        return new LLMPromptTemplate(config);
    }

}
