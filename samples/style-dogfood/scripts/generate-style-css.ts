import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { artifact } from "../src/style";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDir, `../src/${artifact.path}`);

await writeFile(outputPath, artifact.css, "utf8");
