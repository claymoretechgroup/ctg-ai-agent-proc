import {
    ClaudeRunner,
    CodexRunner,
    LLMRunner
} from "../../src/index.ts";

const baseRunner = LLMRunner.init({ command: "tool" });
const claudeRunner = ClaudeRunner.init();
const codexRunner = CodexRunner.init();

// @ts-expect-error Base LLMRunner construction requires a command config.
LLMRunner.init();

void baseRunner;
void claudeRunner;
void codexRunner;
