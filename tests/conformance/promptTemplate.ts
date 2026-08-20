import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import {
    LLMPromptTemplate,
    LLMPromptTemplateError,
    type LLMPromptTemplateValues
} from "../../src/LLMPromptTemplate/index.ts";
import { captureThrown } from "./helpers.ts";

const captureErrorLog = (fn: () => string): {output: string, logged: string} => {
    const original = console.error;
    let logged = "";

    console.error = (value?: unknown): void => {
        logged = String(value);
    };

    try {
        const output = fn();

        return {output, logged};
    } finally {
        console.error = original;
    }
};

export default CTGTest.init("prompt template")
    .assert("default delimiter replaces strict values", () => {
        const template = new LLMPromptTemplate({
            values: { name: "Ada" }
        });

        return template.apply("Hello [[name]].");
    }, P.equals("Hello Ada."))
    .assert("static init matches constructor behavior", () => {
        const template = LLMPromptTemplate.init({
            values: { name: "Ada" }
        });

        return {
            instance: template instanceof LLMPromptTemplate,
            rendered: template.apply("Hello [[name]].")
        };
    }, P.equals({
        instance: true,
        rendered: "Hello Ada."
    }))
    .assert("config is frozen and values are copied", () => {
        const values: LLMPromptTemplateValues = { name: "Ada" };
        const template = new LLMPromptTemplate({ values });
        const storedValues = (template as unknown as {values: LLMPromptTemplateValues}).values;

        values.name = "Grace";

        return {
            frozenValues: Object.isFrozen(storedValues),
            rendered: template.apply("[[name]]")
        };
    }, P.equals({
        frozenValues: true,
        rendered: "Ada"
    }))
    .assert("supports custom delimiter", () => {
        const template = new LLMPromptTemplate({
            values: { name: "Ada" },
            delimiter: ["{{", "}}"]
        });

        return template.apply("Hello {{name}}.");
    }, P.equals("Hello Ada."))
    .assert("supports regex metacharacter delimiters", () => {
        const template = new LLMPromptTemplate({
            values: { name: "Ada" },
            delimiter: ["${", "}"]
        });

        return template.apply("Hello ${name}.");
    }, P.equals("Hello Ada."))
    .assert("strict missing value throws template error", () => {
        const template = new LLMPromptTemplate();
        const caught = captureThrown(() => {
            template.apply("Hello [[name]].");
        });

        return LLMPromptTemplateError.is(caught)
            && caught.type === "TEMPLATE_VALUE_NOT_FOUND"
            && caught.data.key === "name";
    }, P.isTrue())
    .assert("non-strict missing value remains unchanged", () => {
        const template = new LLMPromptTemplate({
            strict: false
        });

        return template.apply("Hello [[name]].");
    }, P.equals("Hello [[name]]."))
    .assert("extra values are ignored", () => {
        const template = new LLMPromptTemplate({
            values: {
                name: "Ada",
                extra: "ignored"
            }
        });

        return template.apply("Hello [[name]].");
    }, P.equals("Hello Ada."))
    .assert("number values are stringified", () => {
        const template = new LLMPromptTemplate({
            values: { count: 3 }
        });

        return template.apply("[[count]] items");
    }, P.equals("3 items"))
    .assert("repeated placeholders are all replaced", () => {
        const template = new LLMPromptTemplate({
            values: { name: "Ada" }
        });

        return template.apply("[[name]] + [[name]]");
    }, P.equals("Ada + Ada"))
    .assert("inherited value properties are ignored", () => {
        const values = Object.create({ inherited: "leak" }) as LLMPromptTemplateValues;
        const template = new LLMPromptTemplate({
            values,
            strict: false
        });

        return template.apply("[[inherited]]");
    }, P.equals("[[inherited]]"))
    .assert("placeholder keys are not trimmed", () => {
        const template = new LLMPromptTemplate({
            values: {
                name: "Ada",
                " name ": "spaced"
            }
        });

        return template.apply("[[name]]|[[ name ]]");
    }, P.equals("Ada|spaced"))
    .assert("invalid delimiter throws template error", () => {
        const delimiter = ["[[", "[["] as const;
        const caught = captureThrown(() => {
            new LLMPromptTemplate({ delimiter });
        });

        return LLMPromptTemplateError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.delimiter === delimiter;
    }, P.isTrue())
    .assert("error types map is bidirectional", () => {
        return LLMPromptTemplateError.TYPES.INVALID_OPTIONS === 1001
            && LLMPromptTemplateError.TYPES.TEMPLATE_VALUE_NOT_FOUND === 1002
            && LLMPromptTemplateError.TYPES[1001] === "INVALID_OPTIONS"
            && LLMPromptTemplateError.TYPES[1002] === "TEMPLATE_VALUE_NOT_FOUND";
    }, P.isTrue())
    .assert("error constructor assigns public fields", () => {
        const cause = new Error("native");
        const err = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name",
            cause
        });

        return err.name === "LLMPromptTemplateError"
            && err.type === "TEMPLATE_VALUE_NOT_FOUND"
            && err.msg === "Missing value."
            && err.message === "Missing value."
            && err.data.key === "name"
            && err.cause === cause;
    }, P.isTrue())
    .assert("error constructor rejects unknown type", () => {
        const caught = captureThrown(() => {
            new LLMPromptTemplateError("UNKNOWN", "Unknown.");
        });

        return caught instanceof Error
            && caught.message === "Unknown LLMPromptTemplateError type: UNKNOWN";
    }, P.isTrue())
    .assert("error data is shallow frozen", () => {
        const err = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name"
        });

        return Object.isFrozen(err.data);
    }, P.isTrue())
    .assert("error log writes default output", () => {
        const err = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name"
        });
        const log = captureErrorLog(() => err.log());
        const parsed = JSON.parse(log.output);

        return log.logged === log.output
            && parsed.name === "LLMPromptTemplateError"
            && parsed.type === "TEMPLATE_VALUE_NOT_FOUND"
            && parsed.msg === "Missing value."
            && parsed.data.key === "name";
    }, P.isTrue())
    .assert("error log accepts custom formatter", () => {
        const err = new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.", {
            key: "name"
        });
        const log = captureErrorLog(() => err.log((value) => {
            return `${value.type}:${value.data.key}`;
        }));

        return log.output === "TEMPLATE_VALUE_NOT_FOUND:name"
            && log.logged === "TEMPLATE_VALUE_NOT_FOUND:name";
    }, P.isTrue());
