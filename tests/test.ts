import CTGTest, {
    CTGTestConsoleFormatter,
    CTGTestResult
} from "ctg-js-test";

import errorClass from "./conformance/errorClass.ts";
import prompt from "./conformance/prompt.ts";
import runner from "./conformance/runner.ts";
import claudeRunner from "./conformance/claudeRunner.ts";
import codexRunner from "./conformance/codexRunner.ts";

const state = await CTGTest.init("ctg-ai-agent-proc hermetic conformance")
    .chain("error class", errorClass)
    .chain("prompt", prompt)
    .chain("runner", runner)
    .chain("claude runner", claudeRunner)
    .chain("codex runner", codexRunner)
    .start(undefined, {
        haltOnFailure: false,
        timeout: 1000
    });

console.log(CTGTestConsoleFormatter.format(state));

if (state.status === CTGTestResult.STATUS.FAIL || state.status === CTGTestResult.STATUS.ERROR) {
    throw new Error("ctg-ai-agent-proc conformance suite failed.");
}
