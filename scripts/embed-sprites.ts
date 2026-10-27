import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Packs assets/sprites into src/generated/sprites.json (base64), so the page
// can inline the sprites it uses and the .exe needs no extra files.

const root = path.join(import.meta.dirname, "..");
const out: Record<string, string> = {};
for (const kind of ["monster", "trainer"]) {
  const dir = path.join(root, "assets", "sprites", kind);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".png")).sort())
    out[`${kind}/${file}`] = (await readFile(path.join(dir, file))).toString("base64");
}
await mkdir(path.join(root, "src", "generated"), { recursive: true });
await writeFile(path.join(root, "src", "generated", "sprites.json"), JSON.stringify(out));
console.log(`Embedded ${Object.keys(out).length} sprites.`);
