import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { getQuranOfflineContent } from '@workspace/api-client-react';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { quranApiOrigin } from './api-origin';
import { PAGE_COUNT, verses } from '@/data/quran';

type Group = 'mushafs' | 'tafsirs';
type Row = Record<string, unknown> & { id: number; record_type?: string };
type Manifest = { generation: number; token: string; checkedAt: number; bytes: number; chunks: number };
type Change = {
  type: string; resource_group: Group; resource_id: number;
  record_type: string | null; record_key: string | null; data: Row | null; snapshot_url: string | null;
};
type SyncResponse = { sync: {
  mutations: Change[]; has_more: boolean; next_page_url: string | null; next_sync_token: string | null;
} };
type Snapshot = { resource_group: Group; resource_id: number; records: Row[] };
export type OfflinePage = {
  pageNumber: number;
  lines: { lineNumber: number; words: { id: number; position: number; verseKey: string; glyph: string; text: string; type: string }[] }[];
  surahStarts: { surahNumber: number; lineNumber: number }[];
};
const ids: Record<Group, number> = { mushafs: 1, tafsirs: 16 };
const groups: Group[] = ['mushafs', 'tafsirs'];
const WEEK = 7 * 24 * 60 * 60 * 1000;
const key = (group: Group) => `mushaf:sync:v1:${group}`;
const chunkFile = (group: Group, generation: number, i: number) =>
  new File(Paths.document, `mushaf-sync-v1-${group}-${generation}-${i}.json`);
const valid = (meta?: Manifest) => !!meta && meta.checkedAt > 0 && Date.now() - meta.checkedAt < WEEK;
const verseById = new Map(verses.map(v => [v.id, v]));

function chunk(group: Group, row: Row): number {
  if (group === 'mushafs') return row.record_type === 'mushaf_word' || row.record_type === 'mushaf_page'
    ? Math.max(1, Math.min(PAGE_COUNT, Number(row.page_number) || 1)) : 0;
  return Math.max(0, Math.floor((Number(row.start_verse_id ?? row.verse_id) || 0) / 50));
}
function rowType(group: Group, row: Row) {
  return row.record_type ?? (group === 'tafsirs' ? 'tafsir' : 'mushaf_word');
}
function rowsToChunks(group: Group, rows: Row[]): Map<number, Row[]> {
  const result = new Map<number, Row[]>();
  for (const row of rows) {
    const i = chunk(group, row);
    const bucket = result.get(i) ?? [];
    bucket.push(row);
    result.set(i, bucket);
  }
  return result;
}
async function readRows(group: Group, meta: Manifest): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < meta.chunks; i += 12) {
    const files = Array.from({ length: Math.min(12, meta.chunks - i) }, (_, n) => chunkFile(group, meta.generation, i + n));
    if (files.some(file => !file.exists)) throw new Error(`Missing ${group} storage chunk`);
    rows.push(...(await Promise.all(files.map(file => file.text()))).flatMap(value => JSON.parse(value) as Row[]));
  }
  return rows;
}
async function save(
  group: Group, rows: Row[], token: string, previous: Manifest | undefined,
  onProgress: (done: number, total: number) => void,
): Promise<Manifest> {
  const buckets = rowsToChunks(group, rows);
  const generation = (previous?.generation ?? 0) + 1;
  const count = group === 'mushafs' ? PAGE_COUNT + 1 : Math.ceil(6236 / 50) + 1;
  let bytes = 0;
  for (let i = 0; i < count; i++) {
    const text = JSON.stringify(buckets.get(i) ?? []);
    const file = chunkFile(group, generation, i);
    file.create({ overwrite: true });
    file.write(text);
    bytes += file.size ?? text.length * 2;
    if (i % 12 === 0 || i === count - 1) {
      onProgress(i + 1, count);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  // The small AsyncStorage manifest is the commit point. A crash before it
  // cannot expose any incomplete generation of files.
  const next = { generation, token, checkedAt: Date.now(), bytes, chunks: count };
  await AsyncStorage.setItem(key(group), JSON.stringify(next));
  if (previous) {
    for (let i = 0; i < previous.chunks; i++) {
      try {
        const file = chunkFile(group, previous.generation, i);
        if (file.exists) file.delete();
      } catch { /* cleanup failure does not roll back the committed generation */ }
    }
  }
  return next;
}
function verify(group: Group, snapshot: Snapshot) {
  if (snapshot.resource_group !== group || snapshot.resource_id !== ids[group] || !Array.isArray(snapshot.records)) {
    throw new Error(`Invalid ${group} snapshot`);
  }
  if (group === 'mushafs') {
    const pages = new Set(snapshot.records.filter(r => r.record_type === 'mushaf_page').map(r => r.page_number));
    const positions = new Map<number, Set<number>>();
    const versesCovered = new Set<number>();
    for (const row of snapshot.records) {
      if (row.record_type !== 'mushaf_word') continue;
      const p = Number(row.page_number);
      const line = Number(row.line_number);
      const position = Number(row.position_in_page);
      if (!Number.isInteger(p) || p < 1 || p > PAGE_COUNT || !Number.isInteger(line) || line < 1 || line > 15
        || !Number.isInteger(position) || position < 1 || typeof row.text !== 'string' || !row.text
        || !verseById.has(Number(row.verse_id)) || !Number.isInteger(row.word_id)) throw new Error('Invalid Mushaf word');
      const set = positions.get(p) ?? new Set<number>();
      if (set.has(position)) throw new Error('Duplicate Mushaf word position');
      set.add(position); positions.set(p, set);
      versesCovered.add(Number(row.verse_id));
    }
    if (!snapshot.records.some(r => r.record_type === 'mushaf')
      || pages.size !== PAGE_COUNT || positions.size !== PAGE_COUNT || versesCovered.size !== 6236
      || [...positions.values()].some(set => set.size !== Math.max(...set))) throw new Error('Incomplete Mushaf snapshot');
  } else {
    const covered = new Set<number>();
    for (const row of snapshot.records) {
      const from = Number(row.start_verse_id ?? row.verse_id);
      const to = Number(row.end_verse_id ?? row.verse_id);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 6236 || to < from
        || typeof row.text !== 'string' || !row.text.trim()) throw new Error('Invalid tafsir row');
      for (let i = from; i <= to; i++) covered.add(i);
    }
    if (covered.size !== 6236) throw new Error('Incomplete tafsir snapshot');
  }
}
function apply(rows: Row[], group: Group, changes: Change[]): Row[] {
  const map = new Map(rows.map(r => [`${rowType(group, r)}:${r.id}`, r]));
  for (const change of changes) {
    if (change.resource_group !== group || change.resource_id !== ids[group]) throw new Error('Unexpected sync resource');
    if (change.type === 'RESOURCE_DELETE') { map.clear(); continue; }
    if (change.type === 'RESOURCE_UPDATE') continue;
    if (change.type === 'ROW_DELETE' || change.type === 'ROW_UPDATE' || change.type === 'ROW_CREATE') {
      if (!change.record_type || !/^\d+$/.test(change.record_key ?? '')) throw new Error('Invalid row key');
      const id = Number(change.record_key);
      const recordKey = `${change.record_type}:${id}`;
      if (change.type === 'ROW_DELETE') map.delete(recordKey);
      else {
        if (!change.data || change.data.id !== id) throw new Error('Invalid sync row');
        map.set(recordKey, { ...change.data, record_type: change.record_type });
      }
      continue;
    }
    if (change.type !== 'RESOURCE_CREATE' && change.type !== 'RESOURCE_INVALIDATE') throw new Error('Unknown sync mutation');
  }
  return [...map.values()];
}

function fontFile(page: number) { return new File(Paths.document, `qcf-v2-p${page}.ttf`); }
const fontUrl = (page: number) => `https://static.qurancdn.com/fonts/quran/hafs/v2/ttf/p${page}.ttf`;
function tafsirPlainText(value: string) {
  return value.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
      const point = code[0].toLowerCase() === 'x'
        ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .replace(/\s+/g, ' ').trim();
}

type State = {
  manifests: Partial<Record<Group, Manifest>>; progress: string | null; error: string | null;
  freshnessTick: number;
  fontCount: number; fontBytes: number;
  syncNow: () => Promise<void>; downloadFonts: () => Promise<void>; cancelFonts: () => void;
  page: (number: number) => Promise<OfflinePage | null>;
  tafsir: (verseId: number) => Promise<string | null>;
  font: (number: number, online: boolean) => Promise<string | null>;
  available: (group: Group) => boolean;
};
const Context = createContext<State | null>(null);
export function useOfflineContent() {
  const state = useContext(Context);
  if (!state) throw new Error('OfflineContentProvider required');
  return state;
}
export function OfflineContentProvider({ children }: { children: React.ReactNode }) {
  const [manifests, setManifests] = useState<Partial<Record<Group, Manifest>>>({});
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [fontProgress, setFontProgress] = useState<string | null>(null);
  const [freshnessTick, setFreshnessTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fontCount, setFontCount] = useState(0);
  const [fontBytes, setFontBytes] = useState(0);
  const syncBusy = useRef(false);
  const fontsBusy = useRef(false);
  const cancel = useRef(false);
  const mounted = useRef(true);
  const manifestsRef = useRef(manifests);
  manifestsRef.current = manifests;
  const refreshFonts = useCallback(() => {
    if (Platform.OS === 'web') return;
    let count = 0; let bytes = 0;
    for (let p = 1; p <= PAGE_COUNT; p++) {
      const file = fontFile(p);
      if (file.exists && file.size && file.size > 1000) { count++; bytes += file.size; }
    }
    if (mounted.current) { setFontCount(count); setFontBytes(bytes); }
  }, []);
  const syncNow = useCallback(async () => {
    if (syncBusy.current || !quranApiOrigin || Platform.OS === 'web') return;
    syncBusy.current = true;
    setError(null);
    try {
      for (const group of groups) {
        const previous = manifestsRef.current[group];
        setSyncProgress(`${group === 'mushafs' ? 'بيانات الكلمات' : 'التفسير الميسر'}: التحقق من التحديثات…`);
        let cursor: string | undefined;
        let finalToken: string | null = null;
        const changes: Change[] = [];
        let bootstrap = !previous?.token;
        for (let page = 0; page < 100; page++) {
          let response: SyncResponse;
          try {
            response = await getQuranOfflineContent(group, 'sync',
              cursor ? { cursor } : bootstrap ? undefined : { token: previous!.token }) as SyncResponse;
          } catch (e) {
            if (!bootstrap && !cursor && e instanceof Error && e.message.includes('HTTP 410')) {
              // Token expired or filter changed: the old generation remains
              // readable until bootstrap and all snapshots commit.
              bootstrap = true;
              page--;
              continue;
            }
            throw e;
          }
          if (!response.sync || !Array.isArray(response.sync.mutations)) throw new Error('Invalid Content Sync response');
          changes.push(...response.sync.mutations);
          if (!response.sync.has_more) {
            finalToken = response.sync.next_sync_token;
            break;
          }
          const path = response.sync.next_page_url;
          if (!path?.startsWith('/api/v4/resources/sync?')) throw new Error('Invalid sync cursor');
          cursor = path;
        }
        if (!finalToken) throw new Error('Sync did not finish');
        let rows: Row[] = [];
        let loaded = false;
        let deleted = false;
        let changed = false;
        let snapshotTaken = false;
        for (const change of changes) {
          if (change.resource_group !== group || change.resource_id !== ids[group]) throw new Error('Unexpected resource');
          if (change.type === 'RESOURCE_CREATE' || change.type === 'RESOURCE_INVALIDATE') {
            if (change.snapshot_url !== `/api/v4/resources/snapshots/${group}/${ids[group]}`)
              throw new Error('Invalid snapshot reference');
            setSyncProgress(`${group === 'mushafs' ? 'بيانات الكلمات' : 'التفسير'}: تنزيل النسخة الكاملة…`);
            const snapshot = await getQuranOfflineContent(group, 'snapshot') as Snapshot;
            verify(group, snapshot);
            rows = snapshot.records;
            loaded = true;
            deleted = false;
            changed = true;
            snapshotTaken = true;
          } else {
            if (snapshotTaken && change.type.startsWith('ROW_')) continue;
            if (change.type.startsWith('ROW_') && !loaded) {
              if (!previous || bootstrap) throw new Error('Incremental rows without a bootstrap snapshot');
              rows = await readRows(group, previous);
              loaded = true;
            }
            rows = apply(rows, group, [change]);
            deleted = change.type === 'RESOURCE_DELETE';
            changed ||= change.type !== 'RESOURCE_UPDATE';
          }
        }
        if (!previous && !changed) throw new Error(`No ${group} snapshot available`);
        if (deleted) {
          await AsyncStorage.removeItem(key(group));
          manifestsRef.current = { ...manifestsRef.current, [group]: undefined };
          setManifests(manifestsRef.current);
          if (previous) {
            for (let i = 0; i < previous.chunks; i++) {
              const file = chunkFile(group, previous.generation, i);
              if (file.exists) file.delete();
            }
          }
          continue;
        }
        if (changed) {
          const title = group === 'mushafs' ? 'بيانات الكلمات' : 'التفسير';
          setSyncProgress(`${title}: حفظ ${rows.length} سجلًا…`);
          const next = await save(group, rows, finalToken, previous,
            (done, total) => setSyncProgress(`${title}: حفظ ${done} / ${total} ملفًا (${Math.round(done / total * 100)}٪)`));
          manifestsRef.current = { ...manifestsRef.current, [group]: next };
        } else {
          const next = { ...previous!, token: finalToken, checkedAt: Date.now() };
          await AsyncStorage.setItem(key(group), JSON.stringify(next));
          manifestsRef.current = { ...manifestsRef.current, [group]: next };
        }
        if (mounted.current) setManifests(manifestsRef.current);
      }
    } catch (e) {
      if (mounted.current) setError(`لم تكتمل مزامنة المحتوى: ${e instanceof Error ? e.message : 'خطأ غير معروف'}. المحتوى غير المُحدّث لا يُعرض بلا اتصال.`);
    } finally {
      syncBusy.current = false;
      if (mounted.current) setSyncProgress(null);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    Promise.all(groups.map(async group => {
      const raw = await AsyncStorage.getItem(key(group));
      return [group, raw ? JSON.parse(raw) as Manifest : undefined] as const;
    })).then(entries => {
      if (!mounted.current) return;
      manifestsRef.current = Object.fromEntries(entries);
      setManifests(manifestsRef.current);
      refreshFonts();
      if (entries.some(([, meta]) => meta)) void syncNow();
    }).catch(() => setError('تعذر قراءة بيانات المصحف المحفوظة على الجهاز.'));
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && groups.some(group => manifestsRef.current[group])) void syncNow();
    });
    const timer = setInterval(() => {
      setFreshnessTick(current => current + 1);
      if (AppState.currentState === 'active' && groups.some(group => manifestsRef.current[group])) void syncNow();
    }, 60 * 60 * 1000);
    if (Platform.OS === 'web') window.addEventListener('online', syncNow);
    return () => {
      mounted.current = false; subscription.remove(); clearInterval(timer);
      if (Platform.OS === 'web') window.removeEventListener('online', syncNow);
    };
  }, [refreshFonts, syncNow]);
  const available = useCallback((group: Group) => valid(manifests[group]), [manifests]);
  const page = useCallback(async (number: number): Promise<OfflinePage | null> => {
    const meta = manifestsRef.current.mushafs;
    if (!valid(meta) || number < 1 || number > PAGE_COUNT) return null;
    const file = chunkFile('mushafs', meta!.generation, number);
    if (!file.exists) return null;
    const raw = await file.text();
    const rows = JSON.parse(raw) as Row[];
    const words = rows.filter(r => r.record_type === 'mushaf_word');
    if (!words.length) return null;
    const lines = new Map<number, (OfflinePage['lines'][number]['words'][number] & { order: number })[]>();
    const starts = new Map<number, number>();
    for (const r of words) {
      const verse = verseById.get(Number(r.verse_id));
      const line = Number(r.line_number);
      if (!verse || !Number.isInteger(line) || line < 1 || line > 15
        || typeof r.text !== 'string' || !r.text || !Number.isInteger(r.word_id)) return null;
      // position_in_line is not unique in the official snapshot on some
      // lines (e.g. a verse transition). position_in_page is canonical.
      const order = Number(r.position_in_page);
      if (!Number.isInteger(order) || order < 1) return null;
      const list = lines.get(line) ?? [];
      list.push({
        id: Number(r.word_id), position: Number(r.position_in_verse), verseKey: `${verse.chapter_id}:${verse.number}`,
        glyph: r.text, text: r.text, type: String(r.char_type_name ?? 'word'), order,
      });
      lines.set(line, list);
      if (verse.number === 1 && !starts.has(verse.chapter_id)) starts.set(verse.chapter_id, line);
    }
    return {
      pageNumber: number,
      lines: [...lines.entries()].sort(([a], [b]) => a - b).map(([lineNumber, list]) => ({
        lineNumber, words: list.sort((a, b) => a.order - b.order),
      })),
      surahStarts: [...starts.entries()].map(([surahNumber, lineNumber]) => ({ surahNumber, lineNumber })),
    };
  }, []);
  const tafsir = useCallback(async (verseId: number): Promise<string | null> => {
    const meta = manifestsRef.current.tafsirs;
    if (!valid(meta)) return null;
    // A grouped tafsir row may begin in a preceding 50-verse chunk.
    const index = Math.floor(verseId / 50);
    for (const i of [index, index - 1]) {
      if (i < 0) continue;
      const file = chunkFile('tafsirs', meta!.generation, i);
      if (!file.exists) continue;
      const raw = await file.text();
      const row = (JSON.parse(raw) as Row[]).find(r =>
        Number(r.start_verse_id ?? r.verse_id) <= verseId
        && Number(r.end_verse_id ?? r.verse_id) >= verseId
        && typeof r.text === 'string' && !!r.text.trim());
      if (row) return tafsirPlainText(String(row.text));
    }
    return null;
  }, []);
  const font = useCallback(async (number: number, online: boolean) => {
    if (number < 1 || number > PAGE_COUNT) return null;
    if (Platform.OS === 'web') return online ? fontUrl(number) : null;
    const file = fontFile(number);
    const isTrueType = async (candidate: File) => {
      if (!candidate.exists || !candidate.size || candidate.size <= 1000) return false;
      const header = new Uint8Array((await candidate.arrayBuffer()).slice(0, 4));
      return header[0] === 0 && header[1] === 1 && header[2] === 0 && header[3] === 0;
    };
    if (await isTrueType(file)) return file.uri;
    if (!online || !quranApiOrigin) return null;
    // Android can leave a partial target after a failed download. Never serve
    // that partial font as an installed page font.
    const temporary = new File(Paths.document, `qcf-v2-p${number}.partial`);
    const downloaded = await File.downloadFileAsync(fontUrl(number), temporary, { idempotent: true });
    if (!(await isTrueType(downloaded))) { downloaded.delete(); throw new Error('خط الصفحة غير صالح'); }
    if (file.exists) file.delete();
    downloaded.move(file);
    refreshFonts();
    return file.uri;
  }, [refreshFonts]);
  const downloadFonts = useCallback(async () => {
    if (Platform.OS === 'web' || fontsBusy.current) return;
    fontsBusy.current = true; cancel.current = false; setError(null);
    try {
      for (let p = 1; p <= PAGE_COUNT; p++) {
        if (cancel.current) break;
        setFontProgress(`خطوط QCF V2: ${p} / ${PAGE_COUNT} (${Math.round(p / PAGE_COUNT * 100)}٪)`);
        await font(p, true);
      }
    } catch (e) {
      setError(`تعذّر تنزيل خط الصفحة: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`);
    } finally { fontsBusy.current = false; setFontProgress(null); refreshFonts(); }
  }, [font, refreshFonts]);
  return <Context.Provider value={{
    manifests, progress: fontProgress ?? syncProgress, error, freshnessTick, fontCount, fontBytes, syncNow, downloadFonts,
    cancelFonts: () => { cancel.current = true; }, page, tafsir, font, available,
  }}>{children}</Context.Provider>;
}