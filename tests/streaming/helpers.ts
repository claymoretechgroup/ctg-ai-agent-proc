import { LLMRunnerError } from "../../src/index.ts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const streamingFixturesDirectory = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export const streamingFixturePath = (name: string): string => {
    return join(streamingFixturesDirectory, name);
};

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

export const isConstructor = (value: unknown): value is new (...args: unknown[]) => unknown => {
    return typeof value === "function";
};
