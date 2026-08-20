import { ClaudeRunner, CodexRunner, LLMRunnerError } from "../../src/index.ts";
import {
    assertExecutableAvailable,
    captureVersion,
    execFileClosedStdin,
    parseExtraArgs,
    parsePrefixArgs,
    ParityFailure,
    runnerDefinitions,
    type ParityRunnerName
} from "./helpers.ts";

const TIMEOUT_MS = 1;
const PROMPT = "Reply with exactly: CTG_TIMEOUT_SHOULD_NOT_COMPLETE";

export const runTimeoutBehavior = async (name: ParityRunnerName): Promise<void> => {
    const definition = runnerDefinitions[name];
    const executable = await assertExecutableAvailable(definition.command);
    const version = await captureVersion(definition.command);
    const prefixArgs = parsePrefixArgs(definition);
    const extraArgs = parseExtraArgs(definition);

    console.log(`SETUP: ${name} timeout executable=${executable}`);
    console.log(`SETUP: ${name} timeout version=${version}`);
    console.log(`SETUP: ${name} timeout prefixArgs=${JSON.stringify(prefixArgs)}`);
    console.log(`SETUP: ${name} timeout extraArgs=${JSON.stringify(extraArgs)}`);
    console.log(`SETUP: ${name} timeout timeoutMs=${TIMEOUT_MS}`);

    const directCaught = await execFileClosedStdin(definition.command, [
        ...prefixArgs,
        ...definition.baseArgs,
        ...extraArgs,
        PROMPT
    ], {timeout: TIMEOUT_MS}).then(
        () => null,
        (caught) => caught
    );

    if (directCaught === null) {
        throw new ParityFailure("CLI_DRIFT", `direct ${name} timeout command unexpectedly completed`);
    }

    const runner = name === "claude"
        ? new ClaudeRunner({prefixArgs, args: extraArgs, timeout: TIMEOUT_MS})
        : new CodexRunner({prefixArgs, args: extraArgs, timeout: TIMEOUT_MS});

    const runnerCaught = await runner.run(PROMPT).then(
        () => null,
        (caught) => caught
    );

    if (!LLMRunnerError.is(runnerCaught) || runnerCaught.type !== "COMMAND_FAILED") {
        throw new ParityFailure(
            "RUNNER_REGRESSION",
            `${name} runner timeout did not settle as LLMRunnerError(COMMAND_FAILED)`
        );
    }
};
