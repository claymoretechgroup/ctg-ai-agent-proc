import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { CodexRunner } from "../../src/index.ts";

const BASE_ARGS = [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--ephemeral",
    "-c",
    "project_root_markers=[]",
    "-c",
    "project_doc_max_bytes=0",
    "-c",
    "features.memories=false",
    "-c",
    "memories.use_memories=false"
];

export default CTGTest.init("codex runner")
    .assert("uses codex as default command", () => {
        const runner = new CodexRunner();

        return (runner as unknown as { config: { command: string } }).config.command;
    }, P.equals("codex"))
    .assert("adds codex defaults before constructor args", async () => {
        const runner = new CodexRunner({
            command: "echo",
            args: ["--model", "gpt-5-codex"]
        });
        const result = await runner.run("PROMPT");

        return result.result.trim().split(" ");
    }, P.equals([...BASE_ARGS, "--model", "gpt-5-codex", "PROMPT"]))
    .assert("adds prompt args before prompt", async () => {
        const runner = new CodexRunner({
            command: "echo"
        });
        const result = await runner.run("PROMPT", {
            args: ["--model", "gpt-5-codex"]
        });

        return result.result.trim().split(" ");
    }, P.equals([...BASE_ARGS, "--model", "gpt-5-codex", "PROMPT"]));
