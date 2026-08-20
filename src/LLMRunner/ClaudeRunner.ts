import LLMRunner from "./LLMRunner.js";

import type { LLMRunnerConfig } from "./LLMRunner.js";

export default class ClaudeRunner extends LLMRunner {

    /**
     *
     * Static Fields
     *
     */

    static override readonly DEFAULT_ARGS = [
        "--safe-mode",
        "--print"
    ] as const;

    // CONSTRUCTOR \\
    constructor(config: Partial<LLMRunnerConfig> = {}) {
        super({
            command: config.command ?? "claude",
            ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
            ...(config.prefixArgs === undefined ? {} : { prefixArgs: config.prefixArgs }),
            ...(config.args === undefined ? {} : { args: config.args }),
            ...(config.timeout === undefined ? {} : { timeout: config.timeout }),
            ...(config.maxBuffer === undefined ? {} : { maxBuffer: config.maxBuffer }),
            ...(config.env === undefined ? {} : { env: config.env }),
            ...(config.tokenMetric === undefined ? {} : { tokenMetric: config.tokenMetric })
        });
    }    

}
