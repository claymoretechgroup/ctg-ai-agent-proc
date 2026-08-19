import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { LLMPrompt, LLMPromptError, LLMRunner, type LLMRunnerRunConfig } from "../../src/index.ts";
import { captureRejected, captureThrown } from "./helpers.ts";

class PromptRunner extends LLMRunner {
    readonly prompts: string[] = [];
    readonly summarizedTexts: string[] = [];

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
        this.summarizedTexts.push(text);

        return `SUMMARY:${text}`;
    }
}

class PromptConfigRunner extends PromptRunner {
    readonly configs: LLMRunnerRunConfig[] = [];

    override async run(prompt: string, config: LLMRunnerRunConfig = {}) {
        this.configs.push(config);

        return super.run(prompt, config);
    }
}

class FailingSummarizeRunner extends PromptRunner {
    readonly failure = new Error("summarize failed");

    override async summarize(): Promise<string> {
        throw this.failure;
    }
}

class FailingTokenCountRunner extends PromptRunner {
    readonly failure = new Error("token count failed");

    override async tokenCount(): Promise<number> {
        throw this.failure;
    }
}

class OnceFailingSummarizeRunner extends PromptRunner {
    private failed = false;

    override async summarize(text: string): Promise<string> {
        this.summarizedTexts.push(text);

        if (!this.failed) {
            this.failed = true;
            throw new Error("temporary summarize failure");
        }

        return `SUMMARY:${text}`;
    }
}

const writePromptFile = (contents: string): string => {
    const directory = mkdtempSync(join(tmpdir(), "ctg-ai-agent-proc-prompt-"));
    const path = join(directory, "prompt.txt");

    writeFileSync(path, contents, "utf8");

    return path;
};

const newPromptFilePath = (): string => {
    return join(mkdtempSync(join(tmpdir(), "ctg-ai-agent-proc-prompt-")), "prompt.txt");
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
    .assert("run forwards runner invocation config", async () => {
        const runner = new PromptConfigRunner();
        await new LLMPrompt("Hello")
            .run(runner, { args: ["--model", "test"] });

        return runner.configs;
    }, P.equals([{ args: ["--model", "test"] }]))
    .assert("empty prompt sends empty string to runner", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt().run(runner);

        return runner.prompts;
    }, P.equals([""]))
    .assert("static init matches constructor behavior", async () => {
        const runner = new PromptRunner();
        const prompt = LLMPrompt.init("Base ", { cache: true })
            .summarizeText("details");

        await prompt.run(runner);
        await prompt.run(runner);

        return {
            instance: prompt instanceof LLMPrompt,
            prompts: runner.prompts,
            summaries: runner.summarizedTexts
        };
    }, P.equals({
        instance: true,
        prompts: ["Base SUMMARY:details", "Base SUMMARY:details"],
        summaries: ["details"]
    }))
    .assert("appendFile appends file contents", async () => {
        const runner = new PromptRunner();
        const path = writePromptFile(" from file");
        await new LLMPrompt("Text")
            .appendFile(path)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Text from file"))
    .assert("appendFile reads file contents at run time", async () => {
        const runner = new PromptRunner();
        const path = newPromptFilePath();
        const prompt = new LLMPrompt("Text")
            .appendFile(path);

        writeFileSync(path, " from late file", "utf8");
        await prompt.run(runner);

        return runner.prompts[0];
    }, P.equals("Text from late file"))
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
    .assert("summarizeFile read failures throw prompt error", async () => {
        const runner = new PromptRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt()
                .summarizeFile("/definitely/not/a/prompt/file.txt")
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "READ_FAILED"
            && caught.data.path === "/definitely/not/a/prompt/file.txt"
            && caught.data.cause !== undefined;
    }, P.isTrue())
    .assert("summarize failures propagate", async () => {
        const runner = new FailingSummarizeRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt()
                .summarizeText("details")
                .run(runner);
        });

        return caught === runner.failure;
    }, P.isTrue())
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
    .assert("truncateFile read failures throw prompt error", async () => {
        const runner = new PromptRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt()
                .truncateFile("/definitely/not/a/prompt/file.txt", 3)
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "READ_FAILED"
            && caught.data.path === "/definitely/not/a/prompt/file.txt"
            && caught.data.cause !== undefined;
    }, P.isTrue())
    .assert("truncate allows zero maxTokens", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("123456789")
            .truncate(0)
            .run(runner);

        return runner.prompts[0];
    }, P.equals(""))
    .assert("truncate preserves text within maxTokens", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("1234")
            .truncate(4)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("1234"))
    .assert("token count failures propagate", async () => {
        const runner = new FailingTokenCountRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt("1234")
                .truncate(2)
                .run(runner);
        });

        return caught === runner.failure;
    }, P.isTrue())
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
    .assert("applyTemplateFile read failures throw prompt error", async () => {
        const runner = new PromptRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt()
                .applyTemplateFile("/definitely/not/a/prompt/file.txt", {})
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "READ_FAILED"
            && caught.data.path === "/definitely/not/a/prompt/file.txt"
            && caught.data.cause !== undefined;
    }, P.isTrue())
    .assert("template supports custom delimiter", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Hello {{name}}")
            .applyTemplate({ name: "Codex" }, { delimiter: ["{{", "}}"] })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Hello Codex"))
    .assert("template supports regex metacharacter delimiters", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Hello (*name*)")
            .applyTemplate({ name: "Codex" }, { delimiter: ["(*", "*)"] })
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
    .assert("template ignores extra keys", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Hello [[name]]")
            .applyTemplate({ name: "Codex", extra: "ignored" })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Hello Codex"))
    .assert("template stringifies number values", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Count [[count]]")
            .applyTemplate({ count: 3 })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Count 3"))
    .assert("template replaces repeated placeholders", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("[[name]] and [[name]]")
            .applyTemplate({ name: "Codex" })
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Codex and Codex"))
    .assert("template does not resolve inherited object properties", async () => {
        const runner = new PromptRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt("[[toString]]")
                .applyTemplate({})
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "TEMPLATE_VALUE_NOT_FOUND"
            && caught.data.key === "toString";
    }, P.isTrue())
    .assert("invalid truncate maxTokens throws prompt error", async () => {
        const caught = captureThrown(() => {
            new LLMPrompt("Hello")
                .truncate(-1);
        });

        return LLMPromptError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.maxTokens === -1;
    }, P.isTrue())
    .assert("non-integer truncate maxTokens throws prompt error", () => {
        const caught = captureThrown(() => {
            new LLMPrompt("Hello")
                .truncate(1.5);
        });

        return LLMPromptError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.maxTokens === 1.5;
    }, P.isTrue())
    .assert("NaN truncate maxTokens throws prompt error", () => {
        const caught = captureThrown(() => {
            new LLMPrompt("Hello")
                .truncate(Number.NaN);
        });

        return LLMPromptError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && Number.isNaN(caught.data.maxTokens);
    }, P.isTrue())
    .assert("Infinity truncate maxTokens throws prompt error", () => {
        const caught = captureThrown(() => {
            new LLMPrompt("Hello")
                .truncate(Number.POSITIVE_INFINITY);
        });

        return LLMPromptError.is(caught)
            && caught.type === "INVALID_OPTIONS"
            && caught.data.maxTokens === Number.POSITIVE_INFINITY;
    }, P.isTrue())
    .assert("invalid template delimiters throw prompt error", () => {
        const emptyOpen = captureThrown(() => {
            new LLMPrompt("Hello [[name]]")
                .applyTemplate({ name: "Codex" }, { delimiter: ["", "]]"] });
        });
        const emptyClose = captureThrown(() => {
            new LLMPrompt("Hello [[name]]")
                .applyTemplate({ name: "Codex" }, { delimiter: ["[[", ""] });
        });
        const sameDelimiter = captureThrown(() => {
            new LLMPrompt("Hello [[name]]")
                .applyTemplate({ name: "Codex" }, { delimiter: ["|", "|"] });
        });

        return LLMPromptError.is(emptyOpen)
            && emptyOpen.type === "INVALID_OPTIONS"
            && LLMPromptError.is(emptyClose)
            && emptyClose.type === "INVALID_OPTIONS"
            && LLMPromptError.is(sameDelimiter)
            && sameDelimiter.type === "INVALID_OPTIONS";
    }, P.isTrue())
    .assert("template placeholder keys are not trimmed", async () => {
        const runner = new PromptRunner();
        const caught = await captureRejected(async () => {
            await new LLMPrompt("Hello [[ name ]]")
                .applyTemplate({ name: "Codex" })
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "TEMPLATE_VALUE_NOT_FOUND"
            && caught.data.key === " name ";
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
            && caught.data.path === "/definitely/not/a/prompt/file.txt"
            && caught.data.cause !== undefined;
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
    }, P.equals("Base joined"))
    .assert("join errors propagate", async () => {
        const runner = new PromptRunner();
        const reusable = new LLMPrompt()
            .appendFile("/definitely/not/a/prompt/file.txt");
        const caught = await captureRejected(async () => {
            await new LLMPrompt("Base ")
                .join(reusable)
                .run(runner);
        });

        return LLMPromptError.is(caught)
            && caught.type === "READ_FAILED"
            && caught.data.path === "/definitely/not/a/prompt/file.txt";
    }, P.isTrue())
    .assert("mixed operations resolve in insertion order", async () => {
        const runner = new PromptRunner();
        await new LLMPrompt("Hello [[name]]")
            .applyTemplate({ name: "Codex" })
            .append(" 12345")
            .truncate(11)
            .run(runner);

        return runner.prompts[0];
    }, P.equals("Hello Codex"))
    .assert("caching reuses resolved prompt without rerunning operations", async () => {
        const runner = new PromptRunner();
        const prompt = new LLMPrompt("Base ", { cache: true })
            .summarizeText("details");

        await prompt.run(runner);
        await prompt.run(runner);

        return {
            prompts: runner.prompts,
            summaries: runner.summarizedTexts
        };
    }, P.equals({
        prompts: ["Base SUMMARY:details", "Base SUMMARY:details"],
        summaries: ["details"]
    }))
    .assert("resetCache reruns operations on the next run", async () => {
        const runner = new PromptRunner();
        const prompt = new LLMPrompt("", { cache: true })
            .summarizeText("details");

        await prompt.run(runner);
        prompt.resetCache();
        await prompt.run(runner);

        return runner.summarizedTexts;
    }, P.equals(["details", "details"]))
    .assert("resetCache returns prompt instance", () => {
        const prompt = new LLMPrompt("", { cache: true });

        return prompt.resetCache() === prompt;
    }, P.isTrue())
    .assert("resetCache throws when caching is disabled", () => {
        const caught = captureThrown(() => {
            new LLMPrompt().resetCache();
        });

        return LLMPromptError.is(caught)
            && caught.type === "INVALID_OPTIONS";
    }, P.isTrue())
    .assert("adding operations does not invalidate cached prompt", async () => {
        const runner = new PromptRunner();
        const prompt = new LLMPrompt("Base", { cache: true });

        await prompt.run(runner);
        prompt.append(" updated");
        await prompt.run(runner);

        return runner.prompts;
    }, P.equals(["Base", "Base"]))
    .assert("resetCache applies operations added after cache population", async () => {
        const runner = new PromptRunner();
        const prompt = new LLMPrompt("Base", { cache: true });

        await prompt.run(runner);
        prompt.append(" updated");
        prompt.resetCache();
        await prompt.run(runner);

        return runner.prompts;
    }, P.equals(["Base", "Base updated"]))
    .assert("join uses cached reusable prompt", async () => {
        const runner = new PromptRunner();
        const reusable = new LLMPrompt("", { cache: true })
            .summarizeText("joined");
        const prompt = new LLMPrompt("Base ")
            .join(reusable);

        await prompt.run(runner);
        await prompt.run(runner);

        return {
            prompts: runner.prompts,
            summaries: runner.summarizedTexts
        };
    }, P.equals({
        prompts: ["Base SUMMARY:joined", "Base SUMMARY:joined"],
        summaries: ["joined"]
    }))
    .assert("failed build does not populate cache", async () => {
        const runner = new OnceFailingSummarizeRunner();
        const prompt = new LLMPrompt("Base ", { cache: true })
            .summarizeText("details");

        await captureRejected(async () => {
            await prompt.run(runner);
        });
        await prompt.run(runner);

        return {
            prompts: runner.prompts,
            summaries: runner.summarizedTexts
        };
    }, P.equals({
        prompts: ["Base SUMMARY:details"],
        summaries: ["details", "details"]
    }));
