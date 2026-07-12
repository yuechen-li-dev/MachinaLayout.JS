import { runTinyTownSpriteWorkflow } from "./tinytown-sprite-workflow";

const result = await runTinyTownSpriteWorkflow();
for (const entry of result.logs) {
  console.log(`[${entry.level}] ${entry.at} ${entry.message}`);
}

if (result.kind === "err") {
  process.exitCode = 1;
}
