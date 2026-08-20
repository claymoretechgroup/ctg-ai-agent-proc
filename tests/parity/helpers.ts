import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    ClaudeRunner,
    CodexRunner,
    LLMRunnerError,
    type LLMRunner,
    type LLMRunnerResult
} from "../../src/index.ts";

export type ParityRunnerName = "claude" | "codex";
export type ParityCategory = "SETUP" | "CLI_DRIFT" | "RUNNER_REGRESSION" | "MODEL_VARIANCE";

export class ParityFailure extends Error {
    constructor(readonly category: ParityCategory, message: string) {
        super(`${category}: ${message}`);
        this.name = "ParityFailure";
    }
}

export class ParitySkip extends Error {
    constructor(message: string) {
        super(`SETUP: ${message}`);
        this.name = "ParitySkip";
    }
}

export interface ExecResult {
    stdout: string;
    stderr: string;
}

export interface RunnerDefinition {
    name: ParityRunnerName;
    command: string;
    baseArgs: readonly string[];
    prefixArgsEnv: string;
    extraArgsEnv: string;
    createRunner(prefixArgs: string[], extraArgs: string[], cwd?: string): LLMRunner;
}

export const fixturesDirectory = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
export const defaultWatchdogMs = 120_000;

export const runnerDefinitions: Record<ParityRunnerName, RunnerDefinition> = {
    claude: {
        name: "claude",
        command: "claude",
        baseArgs: ClaudeRunner.DEFAULT_ARGS,
        prefixArgsEnv: "CTG_AGENT_PROC_LIVE_CLAUDE_PREFIX_ARGS",
        extraArgsEnv: "CTG_AGENT_PROC_LIVE_CLAUDE_ARGS",
        createRunner: (prefixArgs, extraArgs, cwd) => new ClaudeRunner({
            prefixArgs,
            args: extraArgs,
            ...(cwd === undefined ? {} : {cwd})
        })
    },
    codex: {
        name: "codex",
        command: "codex",
        baseArgs: CodexRunner.DEFAULT_ARGS,
        prefixArgsEnv: "CTG_AGENT_PROC_LIVE_CODEX_PREFIX_ARGS",
        extraArgsEnv: "CTG_AGENT_PROC_LIVE_CODEX_ARGS",
        createRunner: (prefixArgs, extraArgs, cwd) => new CodexRunner({
            prefixArgs,
            args: extraArgs,
            ...(cwd === undefined ? {} : {cwd})
        })
    }
};

export const enabledRunnerNames = (): ParityRunnerName[] => {
    const configured = process.env.CTG_AGENT_PROC_LIVE_RUNNERS;

    if (configured === undefined || configured.trim() === "") {
        return ["claude", "codex"];
    }

    return configured.split(",").map((value) => {
        const name = value.trim();

        if (name !== "claude" && name !== "codex") {
            throw new ParityFailure("SETUP", `unsupported runner "${name}" in CTG_AGENT_PROC_LIVE_RUNNERS`);
        }

        return name;
    });
};

const parseArgsEnv = (envName: string): string[] => {
    const raw = process.env[envName];

    if (raw === undefined || raw.trim() === "") {
        return [];
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch (cause) {
        throw new ParityFailure("SETUP", `${envName} must be a JSON array of strings`);
    }

    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
        throw new ParityFailure("SETUP", `${envName} must be a JSON array of strings`);
    }

    return parsed;
};

export const parsePrefixArgs = (definition: RunnerDefinition): string[] => {
    return parseArgsEnv(definition.prefixArgsEnv);
};

export const parseExtraArgs = (definition: RunnerDefinition): string[] => {
    return parseArgsEnv(definition.extraArgsEnv);
};

export const assertExecutableAvailable = async (command: string): Promise<string> => {
    const result = await execFileClosedStdin("which", [command], {timeout: 5_000}).catch(() => null);

    if (result === null || result.stdout.trim() === "") {
        throw new ParitySkip(`${command} executable not found`);
    }

    return result.stdout.trim().split("\n")[0] ?? command;
};

export const captureVersion = async (command: string): Promise<string> => {
    const result = await execFileClosedStdin(command, ["--version"], {timeout: 10_000}).catch(() => null);
    const output = `${result?.stdout ?? ""}${result?.stderr ?? ""}`.trim();

    return output === "" ? "version unavailable" : output.split("\n")[0] ?? output;
};

export const execFileClosedStdin = (
    command: string,
    args: readonly string[],
    options: {timeout?: number,cwd?: string,env?: NodeJS.ProcessEnv} = {}
): Promise<ExecResult> => {
    return new Promise((resolve, reject) => {
        const child = execFile(command, [...args], {
            cwd: options.cwd,
            env: options.env,
            timeout: options.timeout,
            encoding: "utf8"
        }, (error, stdout, stderr) => {
            if (error) {
                Object.assign(error, {stdout, stderr});
                reject(error);
                return;
            }

            resolve({stdout, stderr});
        });

        child.stdin?.on("error", () => {
            // A fast-exiting child may close before stdin.end(); stdout/stderr callback owns result state.
        });
        child.stdin?.end();
    });
};

export const runDirect = (
    definition: RunnerDefinition,
    prompt: string,
    prefixArgs: string[] = [],
    extraArgs: string[] = [],
    cwd?: string
): Promise<ExecResult> => {
    return execFileClosedStdin(definition.command, [
        ...prefixArgs,
        ...definition.baseArgs,
        ...extraArgs,
        prompt
    ], {cwd});
};

export const assertSentinel = (label: string, result: Pick<LLMRunnerResult, "result" | "error">): void => {
    if (!result.result.includes("CTG_PARITY_OK")) {
        throw new ParityFailure(
            "MODEL_VARIANCE",
            `${label} output did not include CTG_PARITY_OK; stdout=${JSON.stringify(result.result)} stderr=${JSON.stringify(result.error)}`
        );
    }

    if (typeof result.error !== "string") {
        throw new ParityFailure("RUNNER_REGRESSION", `${label} stderr mapping was not a string`);
    }
};

export const assertRunnerCommandFailed = (caught: unknown, definition: RunnerDefinition): void => {
    if (!LLMRunnerError.is(caught) || caught.type !== "COMMAND_FAILED") {
        throw new ParityFailure(
            "RUNNER_REGRESSION",
            `${definition.name} bad-argument runner call did not throw LLMRunnerError(COMMAND_FAILED)`
        );
    }
};

export const fixturePath = (name: string): string => join(fixturesDirectory, name);

export const assertFixturesExist = async (): Promise<void> => {
    await Promise.all([
        access(fixturePath("small.txt"), constants.R_OK),
        access(fixturePath("structured.json"), constants.R_OK),
        access(fixturePath("template.txt"), constants.R_OK)
    ]);
};
