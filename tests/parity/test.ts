import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runClaudeParity } from "./claudeParity.ts";
import { runCodexParity } from "./codexParity.ts";
import { runFilesystemSideEffects } from "./filesystemSideEffects.ts";
import { runPromptIntegration } from "./promptIntegration.ts";
import { runTimeoutBehavior } from "./timeoutBehavior.ts";
import { runWebSearchParity } from "./webSearch.ts";
import {
    defaultWatchdogMs,
    enabledRunnerNames,
    ParityFailure,
    ParitySkip
} from "./helpers.ts";

type WorkerSuite = "claude"
    | "codex"
    | "filesystem:claude"
    | "filesystem:codex"
    | "prompt:claude"
    | "prompt:codex"
    | "timeout:claude"
    | "timeout:codex"
    | "web:claude"
    | "web:codex";

const currentFile = fileURLToPath(import.meta.url);

const allSuiteNames = [
    "claude",
    "codex",
    "filesystem:claude",
    "filesystem:codex",
    "prompt:claude",
    "prompt:codex",
    "timeout:claude",
    "timeout:codex",
    "web:claude",
    "web:codex"
] as const satisfies readonly WorkerSuite[];

const workerSuites = (): WorkerSuite[] => {
    const suites = enabledRunnerNames().flatMap((name) => {
        const suites: WorkerSuite[] = [
            name,
            `prompt:${name}` as const,
            `filesystem:${name}` as const,
            `timeout:${name}` as const,
            `web:${name}` as const
        ];

        return suites;
    });
    const requested = process.env.CTG_AGENT_PROC_LIVE_SUITES;

    if (requested === undefined || requested.trim() === "") {
        return suites;
    }

    const selected = requested.split(",").map((value) => value.trim());

    for (const suite of selected) {
        if (!allSuiteNames.includes(suite as WorkerSuite)) {
            throw new ParityFailure("SETUP", `unsupported suite "${suite}" in CTG_AGENT_PROC_LIVE_SUITES`);
        }
    }

    return suites.filter((suite) => selected.includes(suite));
};

const watchdogMs = (): number => {
    const raw = process.env.CTG_AGENT_PROC_LIVE_WATCHDOG_MS;

    if (raw === undefined || raw.trim() === "") {
        return defaultWatchdogMs;
    }

    const value = Number(raw);

    if (!Number.isInteger(value) || value <= 0) {
        throw new ParityFailure("SETUP", "CTG_AGENT_PROC_LIVE_WATCHDOG_MS must be a positive integer");
    }

    return value;
};

const runWorker = async (suite: WorkerSuite): Promise<void> => {
    switch (suite) {
        case "claude":
            await runClaudeParity();
            return;

        case "codex":
            await runCodexParity();
            return;

        case "filesystem:claude":
            await runFilesystemSideEffects("claude");
            return;

        case "filesystem:codex":
            await runFilesystemSideEffects("codex");
            return;

        case "prompt:claude":
            await runPromptIntegration("claude");
            return;

        case "prompt:codex":
            await runPromptIntegration("codex");
            return;

        case "timeout:claude":
            await runTimeoutBehavior("claude");
            return;

        case "timeout:codex":
            await runTimeoutBehavior("codex");
            return;

        case "web:claude":
            await runWebSearchParity("claude");
            return;

        case "web:codex":
            await runWebSearchParity("codex");
            return;
    }
};

const runWorkerProcess = async (suite: WorkerSuite): Promise<void> => {
    try {
        await runWorker(suite);
        console.log(`PASS: ${suite}`);
    } catch (caught) {
        if (caught instanceof ParitySkip && process.env.CTG_AGENT_PROC_LIVE_STRICT !== "1") {
            console.log(caught.message);
            console.log(`PASS: ${suite} skipped`);
            return;
        }

        if (caught instanceof Error) {
            console.error(caught.message);
        } else {
            console.error(`RUNNER_REGRESSION: ${String(caught)}`);
        }

        process.exitCode = 1;
    }
};

const runSuiteInProcessGroup = (suite: WorkerSuite, timeoutMs: number): Promise<boolean> => {
    return new Promise((resolve) => {
        const tsxBin = join(process.cwd(), "node_modules", ".bin", "tsx");
        const child = spawn(tsxBin, [currentFile, "--worker", suite], {
            detached: true,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"]
        });
        let settled = false;
        let timedOut = false;
        let stdout = "";
        let stderr = "";
        let timer: NodeJS.Timeout;
        let killTimer: NodeJS.Timeout | null = null;

        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        const finish = (passed: boolean): void => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timer);
            if (killTimer !== null) {
                clearTimeout(killTimer);
            }

            if (stdout.trim() !== "") {
                process.stdout.write(stdout);
            }

            if (stderr.trim() !== "") {
                process.stderr.write(stderr);
            }

            resolve(passed);
        };

        timer = setTimeout(() => {
            timedOut = true;
            console.error(`RUNNER_REGRESSION: ${suite} did not settle before watchdog deadline (${timeoutMs}ms)`);

            if (child.pid !== undefined) {
                try {
                    process.kill(-child.pid, "SIGTERM");
                } catch {
                    // Process group may have already exited.
                }
                killTimer = setTimeout(() => {
                    try {
                        process.kill(-child.pid, "SIGKILL");
                    } catch {
                        // Process group may have already exited.
                    }
                    finish(false);
                }, 2_000);
                return;
            }

            finish(false);
        }, timeoutMs);

        child.on("error", (error) => {
            console.error(`SETUP: could not start parity worker for ${suite}: ${error.message}`);
            finish(false);
        });
        child.on("exit", (code) => {
            finish(!timedOut && code === 0);
        });
    });
};

const runParent = async (): Promise<void> => {
    if (process.env.CTG_AGENT_PROC_LIVE !== "1") {
        console.log("SETUP: CTG_AGENT_PROC_LIVE=1 is required to run live parity tests");
        return;
    }

    const timeoutMs = watchdogMs();
    const suites = workerSuites();
    let passed = true;

    for (const suite of suites) {
        console.log(`SETUP: running parity suite ${suite} with watchdog=${timeoutMs}ms`);
        passed = await runSuiteInProcessGroup(suite, timeoutMs) && passed;
    }

    if (!passed) {
        throw new Error("live parity suite failed");
    }
};

const workerIndex = process.argv.indexOf("--worker");

if (workerIndex >= 0) {
    const suite = process.argv[workerIndex + 1] as WorkerSuite | undefined;

    if (
        suite !== "claude"
        && suite !== "codex"
        && suite !== "filesystem:claude"
        && suite !== "filesystem:codex"
        && suite !== "prompt:claude"
        && suite !== "prompt:codex"
        && suite !== "timeout:claude"
        && suite !== "timeout:codex"
        && suite !== "web:claude"
        && suite !== "web:codex"
    ) {
        console.error(`SETUP: unknown parity worker suite ${String(suite)}`);
        process.exitCode = 1;
    } else {
        await runWorkerProcess(suite);
    }
} else {
    await runParent();
}
