/* The model never writes Quran wording. It writes a reference token inside a talking point —
     [[آية:8:9]]            surah 8, verse 9
     [[آية:2:255-256|البقرة]]  a range, with the surah name so the number can be cross-checked
   and this module replaces the token with the official Uthmani text from the platform's Quran source. When
   the text cannot be fetched, is too long for a slide, or the name does not match the number, the token becomes
   a plain pointer so nothing unverified is shown. */

import { getQuranFoundationSurahContent } from "./quran-foundation-client";

const TOKEN = /\[\[\s*(?:آية|اية|ayah|quran)\s*:\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*(?:\|\s*([^\]]{1,40}?))?\s*\]\]/gi;
const MAX_VERSE_CHARS = 280;

const plain = (s: string) =>
  s.replace(/[ً-ْٰـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/^سوره\s+/, "").replace(/^سورة\s+/, "").replace(/[^؀-ۿ]/g, "").replace(/^ال/, "");

function pointer(surah: number, from: number, to?: number): string {
  return `(سورة رقم ${surah}، الآية ${from}${to && to !== from ? `–${to}` : ""} — راجع النص في المصحف)`;
}

async function resolveToken(surah: number, from: number, to: number | undefined, name: string | undefined): Promise<string> {
  const last = to && to >= from ? Math.min(to, from + 5) : from;
  try {
    const content = await getQuranFoundationSurahContent(surah);
    const surahName = content.name || "";
    if (name && plain(name) !== plain(surahName) && !plain(surahName).includes(plain(name))) return pointer(surah, from, to);
    const picked = content.ayahs.filter((a) => a.index >= from && a.index <= last);
    if (picked.length === 0 || picked.length !== last - from + 1) return pointer(surah, from, to);
    const text = picked.map((a) => a.text).join(" ");
    if (text.length > MAX_VERSE_CHARS) return pointer(surah, from, to);
    const label = `${surahName.replace(/^سورة\s+/, "")}: ${from}${last !== from ? `–${last}` : ""}`;
    return `﴿${text}﴾ [${label}]`;
  } catch {
    return pointer(surah, from, to);
  }
}

export async function resolveQuranRefsInText(text: string): Promise<string> {
  const matches = [...text.matchAll(TOKEN)];
  if (matches.length === 0) return text;
  let out = text;
  for (const m of matches) {
    const repl = await resolveToken(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined, m[4]?.trim() || undefined);
    out = out.replace(m[0], repl);
  }
  return out;
}

/** Resolves every reference token in an outline's talking points, in place. */
export async function resolveQuranRefsInOutline(outline: { slides: Array<{ talkingPoints: string[]; teacherNotes?: string }> }): Promise<number> {
  let resolved = 0;
  for (const slide of outline.slides) {
    if (slide.teacherNotes && slide.teacherNotes.includes("[[")) {
      const after = await resolveQuranRefsInText(slide.teacherNotes);
      if (after !== slide.teacherNotes) { slide.teacherNotes = after.slice(0, 1500); resolved++; }
    }
    for (let i = 0; i < slide.talkingPoints.length; i++) {
      const before = slide.talkingPoints[i];
      if (!before.includes("[[")) continue;
      const after = await resolveQuranRefsInText(before);
      if (after !== before) { slide.talkingPoints[i] = after.slice(0, 360); resolved++; }
    }
  }
  return resolved;
}
