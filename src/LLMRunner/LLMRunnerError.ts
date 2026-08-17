/**
 * 
 *  Types 
 * 
 */

// Defines details that can be attached to runner errors:
export interface LLMRunnerErrorData {
    command?: string;
    args?: string[];
    cwd?: string;
    exitCode?: number;
    signal?: string;
    stdout?: string;
    stderr?: string;
    cause?: unknown;
}

// Defines callback used to format runner error log output:
export type LLMRunnerErrorLogFormatter = (error: LLMRunnerError) => string;

const RUNNER_ERROR_TYPES = Object.freeze({
    INVALID_OPTIONS: 1001,
    COMMAND_NOT_FOUND: 1002,
    COMMAND_FAILED: 1003,
    1001: "INVALID_OPTIONS",
    1002: "COMMAND_NOT_FOUND",
    1003: "COMMAND_FAILED"
});

/**
 * 
 *  Class 
 * 
 */

// Structured error thrown for LLM runner failures:
export class LLMRunnerError extends Error {

    /* Static Fields */
    static readonly TYPES = RUNNER_ERROR_TYPES as unknown as Readonly<Record<string, number>>;

    /* Instance Fields */
    readonly type: string;
    readonly msg: string;
    readonly data: Readonly<LLMRunnerErrorData>;

    // CONSTRUCTOR \\
    constructor(type: string, msg: string, data: LLMRunnerErrorData = {}) {
        if (!LLMRunnerError.isType(type)) {
            throw new Error(`Unknown LLMRunnerError type: ${type}`);
        }

        super(msg, { cause: data.cause });
        this.name = "LLMRunnerError";
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
    log(formatter: LLMRunnerErrorLogFormatter = LLMRunnerError.formatLog): string {
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
    static formatLog(error: LLMRunnerError): string {
        return JSON.stringify({
            name: error.name,
            type: error.type,
            msg: error.msg,
            data: error.data
        });
    }

    static is(value: unknown): value is LLMRunnerError {
        return value instanceof LLMRunnerError;
    }

    static isType(type: string): boolean {
        return typeof RUNNER_ERROR_TYPES[type as keyof typeof RUNNER_ERROR_TYPES] === "number";
    }

}
