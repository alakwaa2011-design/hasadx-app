import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const TARGETS = [
  path.resolve(here, "../../artifacts/homework-app/src/assets/arena-covers"),
  path.resolve(here, "../../artifacts/homework-app/public/arena-covers"),
];

const WIDTH = 480;
const QUALITY = 78;

async function processDir(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    console.warn(`skip missing dir: ${dir}`);
    return;
  }
  const pngs = entries.filter((n) => n.toLowerCase().endsWith(".png"));
  let made = 0;
  let skipped = 0;
  for (const name of pngs) {
    const src = path.join(dir, name);
    const out = path.join(dir, name.replace(/\.png$/i, ".webp"));
    try {
      const [srcStat, outStat] = await Promise.all([
        fs.stat(src),
        fs.stat(out).catch(() => null),
      ]);
      if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) {
        skipped++;
        continue;
      }
      await sharp(src)
        .resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 5 })
        .toFile(out);
      made++;
    } catch (err) {
      console.error(`failed ${src}:`, err);
    }
  }
  console.log(`[${dir}] generated=${made} skipped=${skipped} total=${pngs.length}`);
}

async function main(): Promise<void> {
  for (const dir of TARGETS) {
    await processDir(dir);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
