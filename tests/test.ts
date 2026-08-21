import CTGTest, {
    CTGTestConsoleFormatter,
    CTGTestResult
} from "ctg-js-test";

import errorClass from "./conformance/errorClass.ts";
import exports from "./conformance/exports.ts";
import prompt from "./conformance/prompt.ts";
import promptTemplate from "./conformance/promptTemplate.ts";
import runner from "./conformance/runner.ts";
import claudeRunner from "./conformance/claudeRunner.ts";
import codexRunner from "./conformance/codexRunner.ts";
import agentProc from "./conformance/agentProc.ts";
import runnerStreaming from "./streaming/runnerStreaming.ts";
import codexStreaming from "./streaming/codexStreaming.ts";
import claudeStreaming from "./streaming/claudeStreaming.ts";

const state = await CTGTest.init("ctg-ai-agent-proc hermetic conformance")
    .chain("error class", errorClass)
    .chain("exports", exports)
    .chain("prompt", prompt)
    .chain("prompt template", promptTemplate)
    .chain("runner", runner)
    .chain("claude runner", claudeRunner)
    .chain("codex runner", codexRunner)
    .chain("agent proc", agentProc)
    .chain("runner streaming", runnerStreaming)
    .chain("codex streaming", codexStreaming)
    .chain("claude streaming", claudeStreaming)
    .start(undefined, {
        haltOnFailure: false,
        timeout: 1000
    });

console.log(CTGTestConsoleFormatter.format(state));

if (state.status === CTGTestResult.STATUS.FAIL || state.status === CTGTestResult.STATUS.ERROR) {
    throw new Error("ctg-ai-agent-proc conformance suite failed.");
}
