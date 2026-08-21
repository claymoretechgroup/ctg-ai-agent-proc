import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import * as api from "../../src/index.ts";

export default CTGTest.init("exports")
    .assert("root exports public runtime names", () => {
        return Object.keys(api).sort();
    }, P.equals([
        "CTGAgentProc",
        "CTGAgentProcError",
        "ClaudeRunner",
        "CodexRunner",
        "LLMPrompt",
        "LLMPromptError",
        "LLMPromptTemplate",
        "LLMPromptTemplateError",
        "LLMRunner",
        "LLMTokenMetric",
        "LLMTokenMetricError",
        "LLMRunnerError"
    ].sort()));
