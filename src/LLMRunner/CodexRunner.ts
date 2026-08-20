import LLMRunner from "./LLMRunner.js";

import type { LLMRunnerConfig } from "./LLMRunner.js";

export default class CodexRunner extends LLMRunner {

    /* Static Fields */
    static override readonly DEFAULT_ARGS = [
        "exec",
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "-c",
        "project_root_markers=[]",
        "-c",
        "project_doc_max_bytes=0",
        "-c",
        "features.memories=false",
        "-c",
        "memories.use_memories=false"
    ] as const;

    // CONSTRUCTOR \\
    constructor(config: Partial<LLMRunnerConfig> = {}) {
        super({
            command: config.command ?? "codex",
            ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
            ...(config.prefixArgs === undefined ? {} : { prefixArgs: config.prefixArgs }),
            ...(config.args === undefined ? {} : { args: config.args }),
            ...(config.timeout === undefined ? {} : { timeout: config.timeout }),
            ...(config.maxBuffer === undefined ? {} : { maxBuffer: config.maxBuffer }),
            ...(config.env === undefined ? {} : { env: config.env })
        });
    }

}
