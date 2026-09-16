import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const clientId = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID?.trim();
const clientSecret = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) {
  throw new Error("Quran Foundation production credentials are required");
}

const tokenResponse = await fetch("https://oauth2.quran.foundation/oauth2/token", {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials&scope=content",
  redirect: "error",
});
if (!tokenResponse.ok) throw new Error(`Token request failed: ${tokenResponse.status}`);
const tokenPayload = await tokenResponse.json();
if (typeof tokenPayload.access_token !== "string") throw new Error("Missing access token");

const wordsByPage = new Map();
const pageNumbers = Array.from({ length: 604 }, (_, index) => index + 1);
const wordFields = "code_v2,text_qpc_hafs,page_number,line_number,position";

async function fetchPage(pageNumber, attempt = 1) {
  const response = await fetch(
    `https://apis.quran.foundation/content/api/v4/verses/by_page/${pageNumber}?mushaf=1&words=true&per_page=50&word_fields=${wordFields}`,
    {
      headers: {
        "x-auth-token": tokenPayload.access_token,
        "x-client-id": clientId,
      },
      redirect: "error",
    },
  );
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
    return fetchPage(pageNumber, attempt + 1);
  }
  if (!response.ok) throw new Error(`Page ${pageNumber} failed: ${response.status}`);
  return response.json();
}

for (let offset = 0; offset < pageNumbers.length; offset += 8) {
  const batch = pageNumbers.slice(offset, offset + 8);
  const payloads = await Promise.all(batch.map(fetchPage));
  payloads.forEach((payload) => {
    for (const verse of payload.verses ?? []) {
      for (const word of verse.words ?? []) {
        if (!Number.isInteger(word.page_number) || !Number.isInteger(word.id)) continue;
        const pageWords = wordsByPage.get(word.page_number) ?? new Map();
        pageWords.set(word.id, {
          id: word.id,
          position: word.position,
          lineNumber: word.line_number,
          verseKey: verse.verse_key,
          glyph: word.code_v2,
        });
        wordsByPage.set(word.page_number, pageWords);
      }
    }
  });
  process.stdout.write(`\rFetched ${Math.min(offset + batch.length, 604)}/604 pages`);
}
process.stdout.write("\n");

const pages = {};
for (const pageNumber of pageNumbers) {
  const words = [...(wordsByPage.get(pageNumber)?.values() ?? [])].sort((left, right) => {
    const [leftSurah, leftVerse] = left.verseKey.split(":").map(Number);
    const [rightSurah, rightVerse] = right.verseKey.split(":").map(Number);
    return left.lineNumber - right.lineNumber
      || leftSurah - rightSurah
      || leftVerse - rightVerse
      || left.position - right.position;
  });
  if (words.length === 0) throw new Error(`Page ${pageNumber} has no words`);
  const signature = createHash("sha256")
    .update(words.map((word) =>
      `${word.id}:${word.position}:${word.lineNumber}:${word.verseKey}:${word.glyph}`
    ).join("|"))
    .digest("hex");
  pages[String(pageNumber)] = {
    wordCount: words.length,
    lineCount: new Set(words.map((word) => word.lineNumber)).size,
    signature,
  };
}

const outputPath = resolve("src/data/qcf-v2-page-integrity.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  version: "qcf-v2-mushaf-1",
  generatedFrom: "Quran Foundation Content API v4",
  pages,
}, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);