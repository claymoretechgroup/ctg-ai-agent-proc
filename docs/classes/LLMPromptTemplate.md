# LLMPromptTemplate

Class that applies string and number values to template placeholders in text.
Instances are immutable after construction.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _values | {STRING: STRING\|INT} | Frozen template replacement values |
| _delimiter | [STRING, STRING] | Opening and closing placeholder markers |
| _strict | BOOL | Whether unresolved placeholders throw |

### CONSTRUCTOR :: ?llmPromptTemplateConfig -> llmPromptTemplate

Creates a prompt template applicator. Values are copied from own enumerable
properties. Delimiters default to `[[` and `]]`. Strict mode defaults to true.

```ts
const template = new LLMPromptTemplate({
    values: { name: "Ada" }
});
```

### LLMPromptTemplate.init :: ?llmPromptTemplateConfig -> llmPromptTemplate

Static factory that creates an `LLMPromptTemplate` instance.

```ts
const template = LLMPromptTemplate.init({
    delimiter: ["${", "}"],
    values: { name: "Ada" }
});
```

### llmPromptTemplate.apply :: STRING -> STRING

Applies configured values to matching placeholders in the supplied text.
Missing values throw `LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND")` in
strict mode and remain unchanged in non-strict mode.

```ts
const text = template.apply("Hello [[name]].");
```
