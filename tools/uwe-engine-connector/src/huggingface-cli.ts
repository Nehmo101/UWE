import { resolveConnectorDataDir } from "./model-profile-store";
import { downloadHuggingFaceModel } from "./huggingface-download";

function usage(): never {
  console.error(`Usage:
  huggingface-cli pull <repoId> <filename> [revision]

Examples:
  huggingface-cli pull TheBloke/Mistral-7B-Instruct-v0.2-GGUF mistral-7b-instruct-v0.2.Q4_K_M.gguf
  huggingface-cli pull Qwen/Qwen2.5-Coder-7B-Instruct-GGUF qwen2.5-coder-7b-instruct-q4_k_m.gguf main
`);
  process.exit(1);
}

async function main(): Promise<void> {
  const [, , command, repoId, filename, revision] = process.argv;
  if (command !== "pull" || !repoId || !filename) {
    usage();
  }

  const result = await downloadHuggingFaceModel(
    resolveConnectorDataDir(),
    { repoId, filename, revision },
    (progress) => {
      process.stdout.write(`${JSON.stringify({ type: "progress", ...progress })}\n`);
    },
  );

  process.stdout.write(
    `${JSON.stringify({
      type: "done",
      provider: "huggingface",
      name: result.profile.name,
      repoId: result.profile.repoId,
      path: result.path,
      sizeBytes: result.sizeBytes,
    })}\n`,
  );
  process.stdout.write(`${JSON.stringify(result.store)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
