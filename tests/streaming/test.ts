import CTGTest, {
    CTGTestConsoleFormatter,
    CTGTestResult
} from "ctg-js-test";

import runnerStreaming from "./runnerStreaming.ts";
import codexStreaming from "./codexStreaming.ts";
import claudeStreaming from "./claudeStreaming.ts";

const state = await CTGTest.init("ctg-ai-agent-proc streaming")
    .chain("runner streaming", runnerStreaming)
    .chain("codex streaming", codexStreaming)
    .chain("claude streaming", claudeStreaming)
    .start(undefined, {
        haltOnFailure: false,
        timeout: 1000
    });

console.log(CTGTestConsoleFormatter.format(state));

if (state.status === CTGTestResult.STATUS.FAIL || state.status === CTGTestResult.STATUS.ERROR) {
    throw new Error("ctg-ai-agent-proc streaming suite failed.");
}
