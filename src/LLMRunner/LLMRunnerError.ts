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

const RUNNER_ERROR_TYPES = Object.freeze({
    INVALID_OPTIONS: 1001,
    COMMAND_NOT_FOUND: 1002,
    COMMAND_FAILED: 1003,
    1001: "INVALID_OPTIONS",
    1002: "COMMAND_NOT_FOUND",
    1003: "COMMAND_FAILED"
});

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
     * Static Methods
     *
     */

    static is(value: unknown): value is LLMRunnerError {
        return value instanceof LLMRunnerError;
    }

    static isType(type: string): boolean {
        return typeof RUNNER_ERROR_TYPES[type as keyof typeof RUNNER_ERROR_TYPES] === "number";
    }

}
