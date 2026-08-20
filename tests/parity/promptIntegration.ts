import { readFileSync } from "node:fs";
import { LLMPrompt } from "../../src/index.ts";
import {
    assertExecutableAvailable,
    assertFixturesExist,
    assertSentinel,
    captureVersion,
    fixturePath,
    parseExtraArgs,
    parsePrefixArgs,
    type ParityRunnerName,
    runnerDefinitions
} from "./helpers.ts";

export const runPromptIntegration = async (name: ParityRunnerName): Promise<void> => {
    const definition = runnerDefinitions[name];
    const executable = await assertExecutableAvailable(definition.command);
    const version = await captureVersion(definition.command);
    const prefixArgs = parsePrefixArgs(definition);
    const extraArgs = parseExtraArgs(definition);

    await assertFixturesExist();

    console.log(`SETUP: ${name} prompt executable=${executable}`);
    console.log(`SETUP: ${name} prompt version=${version}`);
    console.log(`SETUP: ${name} prompt prefixArgs=${JSON.stringify(prefixArgs)}`);
    console.log(`SETUP: ${name} prompt extraArgs=${JSON.stringify(extraArgs)}`);

    const runner = definition.createRunner(prefixArgs, extraArgs);

    const templated = await new LLMPrompt()
        .applyTemplateFile(fixturePath("template.txt"), {
            project: "ctg-ai-agent-proc",
            version: "0.1"
        })
        .append("\nReturn exactly this sentinel after the JSON: CTG_PARITY_OK")
        .run(runner);
    assertSentinel(`${name} applyTemplateFile`, templated);

    const appended = await new LLMPrompt()
        .appendFile(fixturePath("structured.json"))
        .append("\nReply with exactly: CTG_PARITY_OK")
        .run(runner);
    assertSentinel(`${name} appendFile`, appended);

    const smallText = readFileSync(fixturePath("small.txt"), "utf8");
    const summarized = await new LLMPrompt()
        .summarizeText(smallText)
        .append("\nReply with exactly: CTG_PARITY_OK")
        .run(runner);
    assertSentinel(`${name} summarizeText`, summarized);
};
