import { tmpdir } from "node:os";
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
