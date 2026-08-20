import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    assertExecutableAvailable,
    assertSentinel,
    captureVersion,
    parseExtraArgs,
    parsePrefixArgs,
    ParityFailure,
    runDirect,
    runnerDefinitions
} from "./helpers.ts";

const FILE_NAME = "agent-output.txt";
const FILE_CONTENT = "CTG_FILE_WRITE_OK\n";
const INPUT_FILE_NAME = "agent-input.txt";
const INPUT_FILE_CONTENT = "CTG_FILE_READ_OK\n";
const WRITE_PROMPT = [
    `Create a file named ${FILE_NAME} in the current working directory.`,
    `The file content must be exactly ${JSON.stringify(FILE_CONTENT)}.`,
    "Do not create or modify any other files.",
    "After writing the file, reply with exactly: CTG_PARITY_OK"
].join("\n");
const READ_PROMPT = [
    `Read the file named ${INPUT_FILE_NAME} in the current working directory.`,
    `If its content is exactly ${JSON.stringify(INPUT_FILE_CONTENT)}, reply with exactly: CTG_PARITY_OK.`,
    "Do not modify any files."
].join("\n");

const CODEX_WRITE_ARGS = [
    "--skip-git-repo-check",
    "-s",
    "workspace-write",
    "-c",
    "approval_policy=\"never\""
] as const;

const CLAUDE_WRITE_ARGS = [
    "--tools",
    "default",
    "--permission-mode",
    "bypassPermissions"
] as const;

const createWorkspace = (label: string): string => {
    return mkdtempSync(join(tmpdir(), `ctg-ai-agent-proc-${label}-`));
};

const assertWrittenFile = (label: string, cwd: string): void => {
    let content: string;

    try {
        content = readFileSync(join(cwd, FILE_NAME), "utf8");
    } catch (cause) {
        throw new ParityFailure("RUNNER_REGRESSION", `${label} did not create ${FILE_NAME}`);
    }

    if (content !== FILE_CONTENT) {
        throw new ParityFailure(
            "MODEL_VARIANCE",
            `${label} wrote unexpected file content ${JSON.stringify(content)}`
        );
    }
};

const prepareReadFile = (cwd: string): void => {
    writeFileSync(join(cwd, INPUT_FILE_NAME), INPUT_FILE_CONTENT, "utf8");
};

export const runFilesystemSideEffects = async (name: "claude" | "codex"): Promise<void> => {
    const definition = runnerDefinitions[name];
    const executable = await assertExecutableAvailable(definition.command);
    const version = await captureVersion(definition.command);
    const prefixArgs = parsePrefixArgs(definition);
    const extraArgs = [
        ...parseExtraArgs(definition),
        ...(name === "codex" ? CODEX_WRITE_ARGS : CLAUDE_WRITE_ARGS)
    ];
    const directCwd = createWorkspace(`direct-${name}-write`);
    const runnerCwd = createWorkspace(`runner-${name}-write`);

    console.log(`SETUP: ${name} filesystem executable=${executable}`);
    console.log(`SETUP: ${name} filesystem version=${version}`);
    console.log(`SETUP: ${name} filesystem prefixArgs=${JSON.stringify(prefixArgs)}`);
    console.log(`SETUP: ${name} filesystem extraArgs=${JSON.stringify(extraArgs)}`);
    console.log(`SETUP: ${name} filesystem directCwd=${directCwd}`);
    console.log(`SETUP: ${name} filesystem runnerCwd=${runnerCwd}`);

    try {
        const direct = await runDirect(definition, WRITE_PROMPT, prefixArgs, extraArgs, directCwd).catch((caught) => {
            const error = caught as {message?: unknown,stderr?: unknown};

            throw new ParityFailure(
                "CLI_DRIFT",
                `direct ${name} filesystem write failed: ${String(error.stderr ?? error.message ?? caught)}`
            );
        });
        assertSentinel(`direct ${name} filesystem write`, {
            result: direct.stdout,
            error: direct.stderr
        });
        assertWrittenFile(`direct ${name} filesystem write`, directCwd);

        const runner = definition.createRunner(prefixArgs, extraArgs, runnerCwd);
        const runnerResult = await runner.run(WRITE_PROMPT).catch((caught) => {
            const error = caught as {data?: {stderr?: unknown},message?: unknown};

            throw new ParityFailure(
                "RUNNER_REGRESSION",
                `${definition.name} runner filesystem write failed: ${String(error.data?.stderr ?? error.message ?? caught)}`
            );
        });
        assertSentinel(`${definition.name} runner filesystem write`, runnerResult);
        assertWrittenFile(`${definition.name} runner filesystem write`, runnerCwd);

        prepareReadFile(directCwd);
        prepareReadFile(runnerCwd);

        const directRead = await runDirect(definition, READ_PROMPT, prefixArgs, extraArgs, directCwd).catch((caught) => {
            const error = caught as {message?: unknown,stderr?: unknown};

            throw new ParityFailure(
                "CLI_DRIFT",
                `direct ${name} filesystem read failed: ${String(error.stderr ?? error.message ?? caught)}`
            );
        });
        assertSentinel(`direct ${name} filesystem read`, {
            result: directRead.stdout,
            error: directRead.stderr
        });

        const runnerRead = await runner.run(READ_PROMPT).catch((caught) => {
            const error = caught as {data?: {stderr?: unknown},message?: unknown};

            throw new ParityFailure(
                "RUNNER_REGRESSION",
                `${definition.name} runner filesystem read failed: ${String(error.data?.stderr ?? error.message ?? caught)}`
            );
        });
        assertSentinel(`${definition.name} runner filesystem read`, runnerRead);
    } finally {
        rmSync(directCwd, {recursive: true, force: true});
        rmSync(runnerCwd, {recursive: true, force: true});
    }
};
