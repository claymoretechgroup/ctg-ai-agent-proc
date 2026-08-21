# LLMTokenMetric

Class that measures and validates token counts for `LLMRunner` and prompt
truncation. The base implementation uses a simple character-count
approximation and is intended for subclassing.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| none | VOID | `LLMTokenMetric` stores no public or private instance state |

### CONSTRUCTOR :: VOID -> llmTokenMetric

Creates a token metric instance.

```ts
const metric = new LLMTokenMetric();
```

### LLMTokenMetric.init :: VOID -> llmTokenMetric

Static factory that creates a token metric instance. Subclasses inherit this
factory and receive their own instance type.

```ts
const metric = LLMTokenMetric.init();
```

### llmTokenMetric.count :: STRING -> PROMISE<INT>

Returns a validated token count. This method calls protected `measure(text)`
and then protected `validateCount(measurement)`.

```ts
const count = await metric.count("hello world");
```

### llmTokenMetric.measure :: STRING -> PROMISE<ANY>

Protected method that performs the underlying measurement. The base
implementation returns `Math.ceil(text.length / 4)`. Subclasses should
override this method for custom metrics.

```ts
class WordMetric extends LLMTokenMetric {
    protected override async measure(text: string): Promise<unknown> {
        return text.split(/\s+/).filter(Boolean).length;
    }
}
```

### llmTokenMetric.validateCount :: ANY -> INT

Protected method that converts a measurement into the public numeric count. The
base implementation accepts only finite, non-negative integers and throws
`LLMTokenMetricError("INVALID_COUNT")` otherwise.

```ts
class JsonMetric extends LLMTokenMetric {
    protected override validateCount(measurement: unknown): number {
        if (
            typeof measurement === "object"
            && measurement !== null
            && "total" in measurement
            && typeof measurement.total === "number"
        ) {
            return measurement.total;
        }

        return super.validateCount(measurement);
    }
}
```
