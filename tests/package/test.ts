// Loads the BUILT package (dist/index.js), not src, and checks the properties
// that only the build step can break: class names surviving minification,
// and therefore the `source` field on stream events.
import CTGTest, {
    CTGTestConsoleFormatter,
    CTGTestPredicates as P,
    CTGTestResult
} from "ctg-js-test";
import { streamingFixturePath } from "../streaming/helpers.ts";

const pkg = await import("../../dist/index.js");
const { ClaudeRunner, CodexRunner, LLMRunnerError, LLMRunnerOutputEvent, LLMRunnerStreamEvent } = pkg;

const fixtureCommandArgs = (fixture: string): string[] => [
    "-e",
    "const {readFileSync}=require('node:fs');process.stdout.write(readFileSync(process.argv[1],'utf8'));",
    "--",
    fixture
];

const sourcesOf = async (Runner: typeof ClaudeRunner | typeof CodexRunner, fixture: string, streamMode: "raw" | "events"): Promise<string[]> => {
    const sources = new Set<string>();
    const runner = new Runner({
        command: process.execPath,
        prefixArgs: fixtureCommandArgs(streamingFixturePath(fixture)),
        streamOutput: true,
        streamMode,
        onStream: (event: InstanceType<typeof LLMRunnerStreamEvent>) => {
            sources.add(event.source);
        }
    });

    await runner.run("PROMPT");

    return [...sources];
};

const state = await CTGTest.init("ctg-ai-agent-proc built package")
    .assert("class names survive minification", () => ({
        claude: ClaudeRunner.name,
        codex: CodexRunner.name,
        error: LLMRunnerError.name,
        instance: ClaudeRunner.init().constructor.name
    }), P.equals({
        claude: "ClaudeRunner",
        codex: "CodexRunner",
        error: "LLMRunnerError",
        instance: "ClaudeRunner"
    }))
    .assert("Claude events mode: every event source is the runner class name", async () => {
        return await sourcesOf(ClaudeRunner, "claude-stream-json.txt", "events");
    }, P.equals(["ClaudeRunner"]))
    .assert("Codex events mode: every event source is the runner class name", async () => {
        return await sourcesOf(CodexRunner, "codex-jsonl.txt", "events");
    }, P.equals(["CodexRunner"]))
    .assert("raw mode: output event source is the runner class name", async () => {
        const events: unknown[] = [];
        const runner = new ClaudeRunner({
            command: process.execPath,
            prefixArgs: fixtureCommandArgs(streamingFixturePath("claude-stream-json.txt")),
            streamOutput: true,
            streamMode: "raw",
            onStream: (event: unknown) => {
                events.push(event);
            }
        });

        await runner.run("PROMPT");

        const output = events.find((event) => event instanceof LLMRunnerOutputEvent) as { source: string } | undefined;

        return output?.source;
    }, P.equals("ClaudeRunner"))
    .start(undefined, {
        haltOnFailure: false,
        timeout: 5000
    });

console.log(CTGTestConsoleFormatter.format(state));

if (state.status === CTGTestResult.STATUS.FAIL || state.status === CTGTestResult.STATUS.ERROR) {
    throw new Error("ctg-ai-agent-proc built-package suite failed.");
}
