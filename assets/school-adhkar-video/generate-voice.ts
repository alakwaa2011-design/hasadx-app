import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { textToSpeech, speechToText } from "../../lib/integrations-openai-ai-server/src/audio/client";

type Item = { id: string; type: string; lines: string[] };
const root = fileURLToPath(new URL(".", import.meta.url));

// Short clauses make the visual highlight follow the actual speech without a guessed
// word clock. Do not synthesize Qur'an; those sections use human recitations.
async function main() {
  const content = JSON.parse(await readFile(resolve(root, "content.json"), "utf8")) as Item[];
  await mkdir(resolve(root, "audio"), { recursive: true });
  for (const item of content.filter((entry) => entry.type === "dhikr")) {
    for (const [index, line] of item.lines.entries()) {
      const file = resolve(root, "audio", `${item.id}-${index}.wav`);
      let recorded: Buffer;
      try {
        recorded = await readFile(file);
      } catch {
        console.log(`Generating ${item.id} ${index + 1}/${item.lines.length}`);
        recorded = await textToSpeech(line, "onyx", "wav", 180_000);
        if (recorded.length < 3000) throw new Error(`Empty voice recording for ${item.id}-${index}`);
        await writeFile(file, recorded);
      }
      const transcript = await speechToText(recorded, "wav");
      console.log(`${item.id}-${index}:\n  expected: ${line}\n  heard:    ${transcript}`);
    }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });