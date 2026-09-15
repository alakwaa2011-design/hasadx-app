export interface QuranAyah {
  index: number;
  text: string;
  bismillah?: string;
}

export interface QuranSurahParsed {
  index: number;
  name: string;
  ayahs: QuranAyah[];
}

function parseAttributes(tagStr: string) {
  const attrRegex = /([a-zA-Z0-9_]+)="([^"]*)"/g;
  const attrs: Record<string, string> = {};
  let match;
  while ((match = attrRegex.exec(tagStr)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

export function parseQuranXml(xml: string): QuranSurahParsed[] {
  const surahs: QuranSurahParsed[] = [];
  const suraRegex = /<sura\s+([^>]+)>([\s\S]*?)<\/sura>/g;
  const ayaRegex = /<aya\s+([^>]+)\/?>/g;

  let suraMatch;
  while ((suraMatch = suraRegex.exec(xml)) !== null) {
    const suraAttrs = parseAttributes(suraMatch[1]);
    const ayahsStr = suraMatch[2];

    const ayahs: QuranAyah[] = [];
    let ayaMatch;
    while ((ayaMatch = ayaRegex.exec(ayahsStr)) !== null) {
      const ayaAttrs = parseAttributes(ayaMatch[1]);
      ayahs.push({
        index: parseInt(ayaAttrs.index, 10),
        text: ayaAttrs.text,
        bismillah: ayaAttrs.bismillah
      });
    }

    surahs.push({
      index: parseInt(suraAttrs.index, 10),
      name: suraAttrs.name,
      ayahs
    });
  }
  return surahs;
}
