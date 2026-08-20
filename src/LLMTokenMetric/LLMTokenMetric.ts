import { LLMTokenMetricError } from "./LLMTokenMetricError.js";

export default class LLMTokenMetric {

    // Returns the validated token count for the given text:
    async count(text: string): Promise<number> {
        return this.validateCount(await this.measure(text));
    }

    // Performs the underlying token measurement:
    protected async measure(text: string): Promise<unknown> {
        return Math.ceil(text.length / 4);
    }

    // Converts a token measurement into the public numeric count:
    protected validateCount(measurement: unknown): number {
        if (typeof measurement !== "number" || !Number.isInteger(measurement) || measurement < 0) {
            throw new LLMTokenMetricError("INVALID_COUNT", "Token count measurement must be a non-negative finite integer.", {
                measurement
            });
        }
        return measurement;
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method \\
    // NOTE: Uses the static `this` constructor so inherited factories return the subclass type.
    static init<T extends LLMTokenMetric>(this: new () => T): T {
        return new this();
    }

}
