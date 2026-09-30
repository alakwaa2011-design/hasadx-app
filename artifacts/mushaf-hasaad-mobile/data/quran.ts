import chaptersData from './chapters.json';
import pagesData from './pages.json';
import partsData from './parts.json';
import versesData from './verses.json';

export type Chapter = { id: number; name: string; verse_count: number };
export type Page = { id: number; chapter_id: number; part_id: number; verse_count: number };
export type Verse = { id: number; number: number; content: string; chapter_id: number; page_id: number; part_id: number };

export const chapters = chaptersData as Chapter[];
export const pages = pagesData as Page[];
export const parts = partsData as { id: number; name: string }[];
export const verses = versesData as Verse[];
export const PAGE_COUNT = 604;
export const pageVerses = new Map<number, Verse[]>();
for (const verse of verses) {
  const group = pageVerses.get(verse.page_id) ?? [];
  group.push(verse);
  pageVerses.set(verse.page_id, group);
}
export const chapterName = (id: number) => chapters[id - 1]?.name ?? '';
export const pageLabel = (page: number) => {
  const first = pageVerses.get(page)?.[0];
  return first ? `سورة ${chapterName(first.chapter_id)}` : `الصفحة ${page}`;
};
export const firstPageOfChapter = (id: number) => verses.find(v => v.chapter_id === id)?.page_id ?? 1;
export const firstPageOfPart = (id: number) => verses.find(v => v.part_id === id)?.page_id ?? 1;
export const normalize = (value: string) => value
  .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
  .replace(/[ٱآأإ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/ـ/g, '').toLowerCase().trim();

// Metro's static context bundles the approved 604 page images into the app.
// The images and their ordering are not altered or re-typeset here.
const pageAssets = (require as NodeRequire & {
  context: (directory: string, includeSubdirectories: boolean, filter: RegExp) => (path: string) => number;
}).context('../assets/pages', false, /^\.[/]\d{3}\.webp$/);
export function pageImage(page: number): number {
  if (!Number.isInteger(page) || page < 1 || page > PAGE_COUNT) throw new Error('Invalid Mushaf page');
  return pageAssets(`./${String(page).padStart(3, '0')}.webp`) as number;
}