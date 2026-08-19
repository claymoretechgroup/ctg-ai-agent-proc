import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LLMRunnerError } from "../../src/index.ts";

export interface ReportedInvocation {
    argv: string[];
    cwd: string;
}

export const runnerTestCwd = tmpdir();

export const captureThrown = (fn: () => unknown): unknown => {
    try {
        fn();
        return null;
    } catch (caught) {
        return caught;
    }
};

export const captureRejected = async (fn: () => Promise<unknown>): Promise<unknown> => {
    try {
        await fn();
        return null;
    } catch (caught) {
        return caught;
    }
};

export const isRunnerError = (value: unknown, type: string): boolean => {
    return LLMRunnerError.is(value) && value.type === type;
};

export const createCwdReporterCommand = (): string => {
    const directory = mkdtempSync(join(tmpdir(), "ctg-ai-agent-proc-runner-"));
    const path = join(directory, "cwd-reporter.mjs");

    writeFileSync(path, "#!/usr/bin/env node\nprocess.stdout.write(process.cwd());\n", "utf8");
    chmodSync(path, 0o700);

    return path;
};
