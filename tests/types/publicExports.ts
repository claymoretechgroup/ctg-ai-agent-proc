import type {
    CTGAgentProcAgentFunction,
    CTGAgentProcAgentProps,
    CTGAgentProcConfig,
    CTGAgentProcErrorData,
    CTGAgentProcErrorLogFormatter,
    LLMPromptErrorData,
    LLMPromptErrorLogFormatter,
    LLMPromptOptions,
    LLMPromptTemplateConfig,
    LLMPromptTemplateDelimiter,
    LLMPromptTemplateErrorData,
    LLMPromptTemplateErrorLogFormatter,
    LLMPromptTemplateOptions,
    LLMPromptTemplateValue,
    LLMPromptTemplateValues,
    LLMRunnerErrorData,
    LLMRunnerErrorLogFormatter,
    LLMRunnerConfig,
    LLMRunnerOutputStream,
    LLMRunnerRunConfig,
    LLMRunnerResult,
    LLMRunnerStreamHandler,
    LLMRunnerStreamMode,
    LLMTokenMetricErrorData,
    LLMTokenMetricErrorLogFormatter
} from "../../src/index.ts";
import {
    CTGAgentProc,
    CTGAgentProcError,
    ClaudeRunnerEvent,
    CodexRunnerEvent,
    LLMRunner,
    LLMPrompt,
    LLMPromptTemplate,
    LLMPromptTemplateError,
    LLMPromptError,
    LLMRunnerError,
    LLMRunnerOutputEvent,
    LLMRunnerStreamEvent,
    LLMTokenMetricError
} from "../../src/index.ts";

type Assert<T extends true> = T;
type IsAssignable<Actual, Expected> = Actual extends Expected ? true : false;

const runner = new LLMRunner({ command: "tool" });
const prompt = new LLMPrompt("hello");
const procConfig: CTGAgentProcConfig<{ retries: number }> = {
    env: { retries: 0 },
    runners: new Map([["main", runner]]),
    prompts: new Map([["base", prompt]])
};
const proc = new CTGAgentProc(procConfig);

const agentFn: CTGAgentProcAgentFunction<{ retries: number }> = async (
    props: CTGAgentProcAgentProps<{ retries: number }>
) => {
    const env = props.getEnv();

    props.setEnv(() => ({ retries: env.retries + 1 }));
    props.getPrompt("base");
    await props.done();
};

const promptTemplateDelimiter: LLMPromptTemplateDelimiter = ["[[", "]]"];
const promptTemplateValues: LLMPromptTemplateValues = {
    name: "Ada",
    count: 1
};
const promptTemplateValue: LLMPromptTemplateValue = "Ada";
const promptTemplateOptions: LLMPromptTemplateOptions = {
    delimiter: promptTemplateDelimiter,
    strict: true
};
const promptTemplateConfig: LLMPromptTemplateConfig = {
    values: promptTemplateValues,
    ...promptTemplateOptions
};
const promptOptions: LLMPromptOptions = {
    cache: true
};
const runnerConfig: LLMRunnerConfig = {
    command: "tool"
};
const runnerRunConfig: LLMRunnerRunConfig = {
    args: ["--flag"]
};
const runnerResult: LLMRunnerResult = {
    result: "ok",
    error: ""
};
const runnerOutputStream: LLMRunnerOutputStream = "stdout";
const runnerStreamMode: LLMRunnerStreamMode = "raw";
const runnerStreamHandler: LLMRunnerStreamHandler = () => undefined;

const agentProcErrorData: CTGAgentProcErrorData = {
    agentID: "agent",
    runnerID: "main",
    promptID: "base"
};
const promptErrorData: LLMPromptErrorData = {
    path: "prompt.txt"
};
const promptTemplateErrorData: LLMPromptTemplateErrorData = {
    key: "name"
};
const runnerErrorData: LLMRunnerErrorData = {
    command: "tool"
};
const tokenMetricErrorData: LLMTokenMetricErrorData = {
    measurement: -1
};

const agentProcErrorFormatter: CTGAgentProcErrorLogFormatter = (error) => error.type;
const promptErrorFormatter: LLMPromptErrorLogFormatter = (error) => error.type;
const promptTemplateErrorFormatter: LLMPromptTemplateErrorLogFormatter = (error) => error.type;
const runnerErrorFormatter: LLMRunnerErrorLogFormatter = (error) => error.type;
const tokenMetricErrorFormatter: LLMTokenMetricErrorLogFormatter = (error) => error.type;

type PublicTypeSmoke = Assert<IsAssignable<
    [
        CTGAgentProcAgentFunction<{ retries: number }>,
        CTGAgentProcAgentProps<{ retries: number }>,
        CTGAgentProcConfig<{ retries: number }>,
        CTGAgentProcErrorData,
        CTGAgentProcErrorLogFormatter,
        LLMPromptErrorData,
        LLMPromptErrorLogFormatter,
        LLMPromptOptions,
        LLMPromptTemplateConfig,
        LLMPromptTemplateDelimiter,
        LLMPromptTemplateErrorData,
        LLMPromptTemplateErrorLogFormatter,
        LLMPromptTemplateOptions,
        LLMPromptTemplateValue,
        LLMPromptTemplateValues,
        LLMRunnerErrorData,
        LLMRunnerErrorLogFormatter,
        LLMRunnerConfig,
        LLMRunnerOutputStream,
        LLMRunnerRunConfig,
        LLMRunnerResult,
        LLMRunnerStreamHandler,
        LLMRunnerStreamMode,
        LLMTokenMetricErrorData,
        LLMTokenMetricErrorLogFormatter
    ],
    unknown[]
>>;

void proc;
void agentFn;
void promptTemplateConfig;
void promptTemplateValue;
void promptOptions;
void runnerConfig;
void runnerRunConfig;
void runnerResult;
void runnerOutputStream;
void runnerStreamMode;
void runnerStreamHandler;
void agentProcErrorData;
void promptErrorData;
void promptTemplateErrorData;
void runnerErrorData;
void tokenMetricErrorData;
void agentProcErrorFormatter;
void promptErrorFormatter;
void promptTemplateErrorFormatter;
void runnerErrorFormatter;
void tokenMetricErrorFormatter;

new CTGAgentProcError("UNKNOWN_RUNNER", "Missing runner.");
new ClaudeRunnerEvent("runner", { type: "result" });
new CodexRunnerEvent("runner", { type: "turn.completed" });
new LLMPromptError("READ_FAILED", "Read failed.");
new LLMPromptTemplate(promptTemplateConfig);
new LLMPromptTemplateError("TEMPLATE_VALUE_NOT_FOUND", "Missing value.");
new LLMRunnerError("COMMAND_FAILED", "Command failed.");
new LLMRunnerStreamEvent("runner");
new LLMRunnerOutputEvent("runner", "stdout", "chunk");
new LLMTokenMetricError("INVALID_COUNT", "Invalid count.");
