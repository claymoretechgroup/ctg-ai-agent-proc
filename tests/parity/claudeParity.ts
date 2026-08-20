import {
    assertExecutableAvailable,
    assertRunnerCommandFailed,
    assertSentinel,
    captureVersion,
    parseExtraArgs,
    parsePrefixArgs,
    ParityFailure,
    runDirect,
    runnerDefinitions
} from "./helpers.ts";

const PROMPT = "Reply with exactly: CTG_PARITY_OK";
const BAD_ARG = "--ctg-agent-proc-definitely-invalid-arg";

export const runClaudeParity = async (): Promise<void> => {
    const definition = runnerDefinitions.claude;
    const executable = await assertExecutableAvailable(definition.command);
    const version = await captureVersion(definition.command);
    const prefixArgs = parsePrefixArgs(definition);
    const extraArgs = parseExtraArgs(definition);

    console.log(`SETUP: claude executable=${executable}`);
    console.log(`SETUP: claude version=${version}`);
    console.log(`SETUP: claude prefixArgs=${JSON.stringify(prefixArgs)}`);
    console.log(`SETUP: claude extraArgs=${JSON.stringify(extraArgs)}`);

    const direct = await runDirect(definition, PROMPT, prefixArgs, extraArgs);
    assertSentinel("direct claude", {result: direct.stdout, error: direct.stderr});

    const runner = definition.createRunner(prefixArgs, extraArgs);
    const runnerResult = await runner.run(PROMPT);
    assertSentinel("ClaudeRunner", runnerResult);

    const directBad = await runDirect(definition, PROMPT, prefixArgs, [...extraArgs, BAD_ARG]).then(
        () => null,
        (caught) => caught
    );

    if (directBad === null) {
        throw new ParityFailure("CLI_DRIFT", `claude accepted known-bad arg ${BAD_ARG}`);
    }

    const badRunner = definition.createRunner(prefixArgs, [...extraArgs, BAD_ARG]);
    const runnerBad = await badRunner.run(PROMPT).then(
        () => null,
        (caught) => caught
    );
    assertRunnerCommandFailed(runnerBad, definition);
};
