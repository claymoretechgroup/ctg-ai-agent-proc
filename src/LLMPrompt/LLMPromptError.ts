export interface LLMPromptErrorData {
    path?: string;
    key?: string;
    maxTokens?: number;
    cause?: unknown;
}

const LLM_PROMPT_ERROR_TYPES = Object.freeze({
    INVALID_OPTIONS: 1001,
    TEMPLATE_VALUE_NOT_FOUND: 1002,
    READ_FAILED: 1003,
    1001: "INVALID_OPTIONS",
    1002: "TEMPLATE_VALUE_NOT_FOUND",
    1003: "READ_FAILED"
});

export class LLMPromptError extends Error {

    /* Static Fields */
    static readonly TYPES = LLM_PROMPT_ERROR_TYPES as unknown as Readonly<Record<string, number>>;

    /* Instance Fields */
    readonly type: string;
    readonly msg: string;
    readonly data: Readonly<LLMPromptErrorData>;

    // CONSTRUCTOR \\
    constructor(type: string, msg: string, data: LLMPromptErrorData = {}) {
        if (!LLMPromptError.isType(type)) {
            throw new Error(`Unknown LLMPromptError type: ${type}`);
        }

        super(msg, { cause: data.cause });
        this.name = "LLMPromptError";
        this.type = type;
        this.msg = msg;
        this.data = Object.freeze({ ...data });
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     *
     * Static Methods
     *
     */

    static is(value: unknown): value is LLMPromptError {
        return value instanceof LLMPromptError;
    }

    static isType(type: string): boolean {
        return typeof LLM_PROMPT_ERROR_TYPES[type as keyof typeof LLM_PROMPT_ERROR_TYPES] === "number";
    }

}
