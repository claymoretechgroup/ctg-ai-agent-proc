import {
    assertExecutableAvailable,
    assertSentinel,
    captureVersion,
    parseExtraArgs,
    parsePrefixArgs,
    ParityFailure,
    runDirect,
    runnerDefinitions,
    type ParityRunnerName
} from "./helpers.ts";

const SEARCH_PROMPT = [
    "Use web search for this request.",
    "Search the web for the official OpenAI website.",
    "After the search completes, reply with exactly: CTG_PARITY_OK"
].join("\n");

const CODEX_SEARCH_PREFIX_ARGS = ["--search"] as const;
const CLAUDE_SEARCH_ARGS = [
    "--tools",
    "WebSearch",
    "--permission-mode",
    "bypassPermissions"
] as const;

export const runWebSearchParity = async (name: ParityRunnerName): Promise<void> => {
    const definition = runnerDefinitions[name];
    const executable = await assertExecutableAvailable(definition.command);
    const version = await captureVersion(definition.command);
    const prefixArgs = [
        ...parsePrefixArgs(definition),
        ...(name === "codex" ? CODEX_SEARCH_PREFIX_ARGS : [])
    ];
    const extraArgs = [
        ...parseExtraArgs(definition),
        ...(name === "claude" ? CLAUDE_SEARCH_ARGS : [])
    ];

    console.log(`SETUP: ${name} web-search executable=${executable}`);
    console.log(`SETUP: ${name} web-search version=${version}`);
    console.log(`SETUP: ${name} web-search prefixArgs=${JSON.stringify(prefixArgs)}`);
    console.log(`SETUP: ${name} web-search extraArgs=${JSON.stringify(extraArgs)}`);

    const direct = await runDirect(definition, SEARCH_PROMPT, prefixArgs, extraArgs).catch((caught) => {
        const error = caught as {message?: unknown,stderr?: unknown};

        throw new ParityFailure(
            "CLI_DRIFT",
            `direct ${name} web search failed: ${String(error.stderr ?? error.message ?? caught)}`
        );
    });
    assertSentinel(`direct ${name} web search`, {
        result: direct.stdout,
        error: direct.stderr
    });

    const runner = definition.createRunner(prefixArgs, extraArgs);
    const runnerResult = await runner.run(SEARCH_PROMPT).catch((caught) => {
        const error = caught as {data?: {stderr?: unknown},message?: unknown};

        throw new ParityFailure(
            "RUNNER_REGRESSION",
            `${definition.name} runner web search failed: ${String(error.data?.stderr ?? error.message ?? caught)}`
        );
    });
    assertSentinel(`${definition.name} runner web search`, runnerResult);
};
