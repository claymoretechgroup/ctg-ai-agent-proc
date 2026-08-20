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

export const runCodexParity = async (): Promise<void> => {
    const definition = runnerDefinitions.codex;
    const executable = await assertExecutableAvailable(definition.command);
    const version = await captureVersion(definition.command);
    const prefixArgs = parsePrefixArgs(definition);
    const extraArgs = parseExtraArgs(definition);

    console.log(`SETUP: codex executable=${executable}`);
    console.log(`SETUP: codex version=${version}`);
    console.log(`SETUP: codex prefixArgs=${JSON.stringify(prefixArgs)}`);
    console.log(`SETUP: codex extraArgs=${JSON.stringify(extraArgs)}`);

    const direct = await runDirect(definition, PROMPT, prefixArgs, extraArgs);
    assertSentinel("direct codex", {result: direct.stdout, error: direct.stderr});

    const runner = definition.createRunner(prefixArgs, extraArgs);
    const runnerResult = await runner.run(PROMPT);
    assertSentinel("CodexRunner", runnerResult);

    const directBad = await runDirect(definition, PROMPT, prefixArgs, [...extraArgs, BAD_ARG]).then(
        () => null,
        (caught) => caught
    );

    if (directBad === null) {
        throw new ParityFailure("CLI_DRIFT", `codex accepted known-bad arg ${BAD_ARG}`);
    }

    const badRunner = definition.createRunner(prefixArgs, [...extraArgs, BAD_ARG]);
    const runnerBad = await badRunner.run(PROMPT).then(
        () => null,
        (caught) => caught
    );
    assertRunnerCommandFailed(runnerBad, definition);
};
