import CTGTest, {
    CTGTestConsoleFormatter,
    CTGTestResult
} from "ctg-js-test";

import agentProc from "./agentProc.ts";

const state = await CTGTest.init("ctg-ai-agent-proc orchestration")
    .chain("agent proc orchestration", agentProc)
    .start(undefined, {
        haltOnFailure: false,
        timeout: 1000
    });

console.log(CTGTestConsoleFormatter.format(state));

if (state.status === CTGTestResult.STATUS.FAIL || state.status === CTGTestResult.STATUS.ERROR) {
    throw new Error("ctg-ai-agent-proc orchestration suite failed.");
}
