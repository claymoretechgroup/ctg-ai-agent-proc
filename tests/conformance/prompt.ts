import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { LLMPrompt, LLMPromptError, LLMRunner } from "../../src/index.ts";
import { captureRejected } from "./helpers.ts";

class PromptRunner extends LLMRunner {
    readonly prompts: string[] = [];

    constructor() {
        super({
            command: process.execPath,
            args: ["-e", "process.stdout.write(process.argv.at(-1) ?? \"\");", "--"]
        });
    }

    override async run(prompt: string) {
        this.prompts.push(prompt);

        return {
            result: `RUN:${prompt}`,
            error: ""
        };
    }

    override async tokenCount(text: string): Promise<number> {
        return text.length;
    }

    override async summarize(text: string): Promise<string> {
        return `SUMMARY:${text}`;
    }
}

const writePromptFile = (contents: string): string => {
    const directory = mkdtempSync(join(tmpdir(), "ctg-ai-agent-proc-prompt-"));
    const path = join(directory, "prompt.txt");

    writeFileSync(path, contents, "utf8");

    return path;
};

export default CTGTest.init("prompt")
    .assert("constructor text and append are sent to runner", async () => {
        const runner = new PromptRunner();
        const result = await new LLMPrompt("Hello")
            .append(" world")
            .run(runner);

        return {
            result: result.result,
            prompt: runner.prompts[0]
        };
    }, P.equals({
        result: "RUN:Hello world",
        prompt: "Hello world"
    }))
    .assert("appendFile appends file contents", async () => {
        const runner = new PromptRunner();
        const path = writePromptFile(" from file");
        await new LLMPrompt("Text")
            .appendFile(path)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Text from file"))
    .assert("summarize transforms stored prompt", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Long text")
            .summarize()
            .run(runner);

        return runner.prompts[0];
    }, P.equals("SUMMARY:Long text"))
    .assert("summarizeText appends summarized text", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Base ")
            .summarizeText("details")
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Base SUMMARY:details"))
    .assert("summarizeFile appends summarized file contents", async () => {
        const runner = new PromptRunner();
        const path = writePromptFile("file details");
        await new LLMPrompt("Base ")
            .summarizeFile(path)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Base SUMMARY:file details"))
    .assert("truncate transforms stored prompt", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("123456789")
            .truncate(4)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("1234"))
    .assert("truncateText appends truncated text", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Base ")
            .truncateText("123456789", 4)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Base 1234"))
    .assert("truncateFile appends truncated file contents", async () => {
        const runner = new PromptRunner();
        const path = writePromptFile("abcdefghi");
        await new LLMPrompt("Base ")
            .truncateFile(path, 3)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Base abc"))
    .assert("applyTemplate transforms stored prompt with strict values", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Hello [[name]]")
            .applyTemplate({ name: "Codex" })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Hello Codex"))
    .assert("applyTemplateText appends templated text", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Base ")
            .applyTemplateText("Hello [[name]]", { name: "Codex" })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Base Hello Codex"))
    .assert("applyTemplateFile appends templated file contents", async () => {
        const runner = new PromptRunner();
        const path = writePromptFile("Hello [[name]]");
        await new LLMPrompt("Base ")
            .applyTemplateFile(path, { name: "Codex" })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Base Hello Codex"))
    .assert("template supports custom delimiter", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Hello {{name}}")
            .applyTemplate({ name: "Codex" }, { delimiter: ["{{", "}}"] })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Hello Codex"))
    .assert("non-strict template leaves unresolved placeholders unchanged", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Hello [[name]]")
            .applyTemplate({}, { strict: false })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Hello [[name]]"))
    .assert("strict template throws prompt error for unresolved placeholders", async () => {
        const runner = new PromptRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt("Hello [[name]]")
                .applyTemplate({})
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "TEMPLATE_VALUE_NOT_FOUND"
            && caught.data.key === "name";
    }, P.isTrue())
    .assert("invalid truncate maxTokens throws prompt error", async () => {
        const runner = new PromptRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt("Hello")
                .truncate(-1)
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.maxTokens === -1;
    }, P.isTrue())
    .assert("appendFile failures throw prompt error", async () => {
        const runner = new PromptRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt()
                .appendFile("/definitely/not/a/prompt/file.txt")
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "READ_FAILED"
            && caught.data.path === "/definitely/not/a/prompt/file.txt";
    }, P.isTrue())
    .assert("unknown operations throw prompt error", async () => {
        const runner = new PromptRunner();
        const prompt = new LLMPrompt();

        (prompt as unknown as {operations: unknown[]}).operations.push({type: "unknown"});

        const caught = await captureRejected(async () => {
            await prompt.run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "UNKNOWN_OPERATION"
            && caught.data.operationType === "unknown";
    }, P.isTrue())
    .assert("join appends resolved reusable prompt", async () => {
        const runner = new PromptRunner();
        const reusable = new LLMPrompt("[[value]]")
            .applyTemplate({ value: "joined" });

        await new LLMPrompt("Base ")
            .join(reusable)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Base joined"));
