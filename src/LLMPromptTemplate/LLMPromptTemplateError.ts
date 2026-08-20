/**
 * 
 *  Types 
 * 
 */

// Defines details that can be attached to prompt template errors:
export interface LLMPromptTemplateErrorData {
    key?: string;
    delimiter?: unknown;
    cause?: unknown;
}

// Defines callback used to format prompt template error log output:
export type LLMPromptTemplateErrorLogFormatter = (error: LLMPromptTemplateError) => string;

const LLM_PROMPT_TEMPLATE_ERROR_TYPES = Object.freeze({
    INVALID_OPTIONS: 1001,
    TEMPLATE_VALUE_NOT_FOUND: 1002,
    1001: "INVALID_OPTIONS",
    1002: "TEMPLATE_VALUE_NOT_FOUND"
});

/**
 * 
 *  Class 
 * 
 */

// Structured error thrown for prompt template failures:
export class LLMPromptTemplateError extends Error {

    /* Static Fields */
    static readonly TYPES = LLM_PROMPT_TEMPLATE_ERROR_TYPES as unknown as Readonly<Record<string, number>>;

    /* Instance Fields */
    readonly type: string;
    readonly msg: string;
    readonly data: Readonly<LLMPromptTemplateErrorData>;

    // CONSTRUCTOR \\
    constructor(type: string, msg: string, data: LLMPromptTemplateErrorData = {}) {
        if (!LLMPromptTemplateError.isType(type)) {
            throw new Error(`Unknown LLMPromptTemplateError type: ${type}`);
        }

        super(msg, { cause: data.cause });
        this.name = "LLMPromptTemplateError";
        this.type = type;
        this.msg = msg;
        this.data = Object.freeze({ ...data });
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     *
     * Instance Methods
     *
     */

    // Writes error details to stderr and returns the written output:
    log(formatter: LLMPromptTemplateErrorLogFormatter = LLMPromptTemplateError.formatLog): string {
        const output = formatter(this);

        console.error(output);

        return output;
    }

    /**
     *
     * Static Methods
     *
     */

    // Formats error details for log output:
    static formatLog(error: LLMPromptTemplateError): string {
        return JSON.stringify({
            name: error.name,
            type: error.type,
            msg: error.msg,
            data: error.data
        });
    }

    static is(value: unknown): value is LLMPromptTemplateError {
        return value instanceof LLMPromptTemplateError;
    }

    static isType(type: string): boolean {
        return typeof LLM_PROMPT_TEMPLATE_ERROR_TYPES[type as keyof typeof LLM_PROMPT_TEMPLATE_ERROR_TYPES] === "number";
    }

}
