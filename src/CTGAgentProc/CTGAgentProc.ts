// Dependencies:
import { HiveQueue } from "hive-queue";
import type { HiveQueueConfig, HiveQueueWorkerProps } from "hive-queue";

import type LLMRunner from "../LLMRunner/LLMRunner.js";
import type LLMPrompt from "../LLMPrompt/LLMPrompt.js";
import { CTGAgentProcError } from "./CTGAgentProcError.js";

/**
 *
 *  Types
 *
 */

/**
 * Construction config for an agent processor.
 *
 * This extends `HiveQueueConfig` with optional runner and prompt registries.
 * Provided maps are used by reference; omitted maps are initialized empty.
 */
export interface CTGAgentProcConfig<Env = unknown> extends HiveQueueConfig<Env> {
    /** Named runner registry used by `agent()` when binding agent functions. */
    runners?: Map<string, LLMRunner>;

    /** Named prompt registry available through `getPrompt()`. */
    prompts?: Map<string, LLMPrompt>;
}

/**
 * Agent props passed to functions registered with `agent()`.
 *
 * The base worker props come from `hive-queue`; `CTGAgentProc` adds the
 * current agent ID, selected runner ID, runner instance, and prompt lookup.
 */
export interface CTGAgentProcAgentProps<Env = unknown> extends HiveQueueWorkerProps<Env> {
    /** Worker ID the agent was registered under. */
    agentID: string;

    /** Runner ID selected when the agent was registered. */
    runnerID: string;

    /** Registered runner instance for this agent. */
    runner: LLMRunner;

    /** Looks up a registered prompt or throws `CTGAgentProcError("UNKNOWN_PROMPT")`. */
    getPrompt(id: string): LLMPrompt;
}

/**
 * Agent function bound to a HiveQueue worker by `CTGAgentProc.agent()`.
 *
 * Agent functions must eventually call `done()` to continue queue processing
 * or `halt(value)` to stop the queue, following the normal HiveQueue contract.
 */
export type CTGAgentProcAgentFunction<Env = unknown> = (
    props: CTGAgentProcAgentProps<Env>
) => Promise<void>;

/**
 *
 *  Class
 *
 */

/**
 * Orchestration layer for registering LLM-backed agents on top of HiveQueue.
 *
 * `CTGAgentProc` intentionally subclasses `HiveQueue` instead of wrapping it.
 * HiveQueue remains responsible for task routing, worker registration,
 * delegation, continuation, halting, and shared environment state. This class
 * adds registries for `LLMRunner` and `LLMPrompt` instances plus an `agent()`
 * helper that injects agent-specific context into normal Hive worker props.
 */
export default class CTGAgentProc<Env = unknown> extends HiveQueue<Env> {

    /* Instance Fields */
    runners: Map<string, LLMRunner>;
    prompts: Map<string, LLMPrompt>;

    /**
     * Creates an agent processor with optional HiveQueue config and registries.
     *
     * `workers`, `tasks`, `env`, `isActive`, and `onHalt` are handled by the
     * inherited HiveQueue constructor. `runners` and `prompts` are stored by
     * reference when provided, or initialized as empty maps when omitted.
     */
    constructor(config: CTGAgentProcConfig<Env> = {}) {
        super(config);
        this.runners = config.runners ?? new Map();
        this.prompts = config.prompts ?? new Map();
    }

    /**
     *
     * Instance Methods
     *
     */

    /**
     * Registers a named runner and returns this processor for chaining.
     *
     * Duplicate IDs throw `CTGAgentProcError("RUNNER_ALREADY_BOUND")`.
     */
    runner(id: string, runner: LLMRunner): this {
        if (this.runners.has(id)) {
            throw new CTGAgentProcError(
                "RUNNER_ALREADY_BOUND",
                `LLM runner already bound: ${id}.`,
                { runnerID: id }
            );
        }

        this.runners.set(id, runner);
        return this;
    }

    /**
     * Registers a named prompt and returns this processor for chaining.
     *
     * Duplicate IDs throw `CTGAgentProcError("PROMPT_ALREADY_BOUND")`.
     */
    prompt(id: string, prompt: LLMPrompt): this {
        if (this.prompts.has(id)) {
            throw new CTGAgentProcError(
                "PROMPT_ALREADY_BOUND",
                `LLM prompt already bound: ${id}.`,
                { promptID: id }
            );
        }

        this.prompts.set(id, prompt);
        return this;
    }

    /**
     * Returns a registered prompt by ID.
     *
     * Unknown IDs throw `CTGAgentProcError("UNKNOWN_PROMPT")`.
     */
    getPrompt(id: string): LLMPrompt {
        const prompt = this.prompts.get(id);

        if (prompt === undefined) {
            throw new CTGAgentProcError(
                "UNKNOWN_PROMPT",
                `Unknown LLM prompt: ${id}.`,
                { promptID: id }
            );
        }

        return prompt;
    }

    /**
     * Registers an agent function as a HiveQueue worker.
     *
     * `runnerID` must already be registered. The wrapped worker receives all
     * normal Hive worker props plus `agentID`, `runnerID`, `runner`, and
     * `getPrompt(id)`. Duplicate `agentID` handling is delegated to
     * `HiveQueue.worker()`.
     */
    agent(agentID: string, runnerID: string, fn: CTGAgentProcAgentFunction<Env>): this {
        const runner = this.runners.get(runnerID);

        if (runner === undefined) {
            throw new CTGAgentProcError(
                "UNKNOWN_RUNNER",
                `Unknown LLM runner: ${runnerID}.`,
                { agentID, runnerID }
            );
        }

        return this.worker(agentID, async (props) => {
            await fn({
                ...props,
                agentID,
                runnerID,
                runner,
                getPrompt: (id: string) => this.getPrompt(id)
            });
        });
    }

    /**
     *
     * Static Methods
     *
     */

    /**
     * Creates a `CTGAgentProc` instance.
     */
    static override init<Env = unknown>(config: CTGAgentProcConfig<Env> = {}): CTGAgentProc<Env> {
        return new CTGAgentProc<Env>(config);
    }

}
