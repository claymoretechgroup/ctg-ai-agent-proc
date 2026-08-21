/**
 *
 *  Types
 *
 */

/**
 * Structured data attached to `CTGAgentProcError`.
 */
export interface CTGAgentProcErrorData {
    /** Agent ID involved in the failure, when applicable. */
    agentID?: string;

    /** Runner ID involved in the failure, when applicable. */
    runnerID?: string;

    /** Prompt ID involved in the failure, when applicable. */
    promptID?: string;

    /** Native or upstream cause for error chaining. */
    cause?: unknown;
}

/**
 * Callback used to format agent processor error log output.
 */
export type CTGAgentProcErrorLogFormatter = (error: CTGAgentProcError) => string;

const CTG_AGENT_PROC_ERROR_TYPES = Object.freeze({
    RUNNER_ALREADY_BOUND: 1001,
    PROMPT_ALREADY_BOUND: 1002,
    UNKNOWN_RUNNER: 1003,
    UNKNOWN_PROMPT: 1004,
    1001: "RUNNER_ALREADY_BOUND",
    1002: "PROMPT_ALREADY_BOUND",
    1003: "UNKNOWN_RUNNER",
    1004: "UNKNOWN_PROMPT"
});

/**
 *
 *  Class
 *
 */

/**
 * Structured error for CTGAgentProc registration and lookup failures.
 *
 * Native HiveQueue worker-registration errors remain `HiveQueueError`. This
 * class is reserved for AgentProc-owned runner and prompt registry failures.
 */
export class CTGAgentProcError extends Error {

    /* Static Fields */
    static readonly TYPES = CTG_AGENT_PROC_ERROR_TYPES as unknown as Readonly<Record<string, number>>;

    /* Instance Fields */
    readonly type: string;
    readonly msg: string;
    readonly data: Readonly<CTGAgentProcErrorData>;

    /**
     * Creates a structured AgentProc error.
     *
     * Unknown `type` strings throw a plain `Error`, matching the existing
     * structured error classes in this package.
     */
    constructor(type: string, msg: string, data: CTGAgentProcErrorData = {}) {
        if (!CTGAgentProcError.isType(type)) {
            throw new Error(`Unknown CTGAgentProcError type: ${type}`);
        }

        super(msg, { cause: data.cause });
        this.name = "CTGAgentProcError";
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

    /**
     * Writes formatted error details to stderr and returns the written output.
     */
    log(formatter: CTGAgentProcErrorLogFormatter = CTGAgentProcError.formatLog): string {
        const output = formatter(this);

        console.error(output);

        return output;
    }

    /**
     *
     * Static Methods
     *
     */

    /**
     * Formats error details as JSON for log output.
     */
    static formatLog(error: CTGAgentProcError): string {
        return JSON.stringify({
            name: error.name,
            type: error.type,
            msg: error.msg,
            data: error.data
        });
    }

    static is(value: unknown): value is CTGAgentProcError {
        return value instanceof CTGAgentProcError;
    }

    static isType(type: string): boolean {
        return typeof CTG_AGENT_PROC_ERROR_TYPES[type as keyof typeof CTG_AGENT_PROC_ERROR_TYPES] === "number";
    }

}
