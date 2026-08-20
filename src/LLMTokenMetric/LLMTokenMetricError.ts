/**
 * 
 *  Types 
 * 
 */

// Defines details that can be attached to token metric errors:
export interface LLMTokenMetricErrorData {
    measurement?: unknown;
    cause?: unknown;
}

// Defines callback used to format token metric error log output:
export type LLMTokenMetricErrorLogFormatter = (error: LLMTokenMetricError) => string;

const LLM_TOKEN_METRIC_ERROR_TYPES = Object.freeze({
    INVALID_COUNT: 1001,
    1001: "INVALID_COUNT"
});

/**
 * 
 *  Class 
 * 
 */

// Structured error thrown for token metric failures:
export class LLMTokenMetricError extends Error {

    /* Static Fields */
    static readonly TYPES = LLM_TOKEN_METRIC_ERROR_TYPES as unknown as Readonly<Record<string, number>>;

    /* Instance Fields */
    readonly type: string;
    readonly msg: string;
    readonly data: Readonly<LLMTokenMetricErrorData>;

    // CONSTRUCTOR \\
    constructor(type: string, msg: string, data: LLMTokenMetricErrorData = {}) {
        if (!LLMTokenMetricError.isType(type)) {
            throw new Error(`Unknown LLMTokenMetricError type: ${type}`);
        }

        super(msg, { cause: data.cause });
        this.name = "LLMTokenMetricError";
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
    log(formatter: LLMTokenMetricErrorLogFormatter = LLMTokenMetricError.formatLog): string {
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
    static formatLog(error: LLMTokenMetricError): string {
        return JSON.stringify({
            name: error.name,
            type: error.type,
            msg: error.msg,
            data: error.data
        });
    }

    static is(value: unknown): value is LLMTokenMetricError {
        return value instanceof LLMTokenMetricError;
    }

    static isType(type: string): boolean {
        return typeof LLM_TOKEN_METRIC_ERROR_TYPES[type as keyof typeof LLM_TOKEN_METRIC_ERROR_TYPES] === "number";
    }

}
