import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, Keyboard, Modal, PanResponder, Platform,
  Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { getListQuranRecitersQueryKey, useListQuranReciters } from '@workspace/api-client-react';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReader, type Appearance, type PageDisplay } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';
import { privacyUrl, quranApiOrigin } from '@/lib/api-origin';
import { TafsirPanel } from '@/components/TafsirPanel';
import { GuidedPractice } from '@/components/GuidedPractice';
import { MadaniWordPage } from '@/components/MadaniWordPage';
import {
  PAGE_COUNT, chapterName, chapters, firstPageOfChapter, firstPageOfPart,
  normalize, pageImage, pageLabel, pageVerses, pages, parts, verses, type Verse,
} from '@/data/quran';

type Sheet = 'index' | 'search' | 'bookmarks' | 'settings' | 'verses' | 'verse' | 'memorize' | 'audio' | 'tafsir' | null;
type IndexTab = 'chapters' | 'parts' | 'bookmarks';
type StopAt = 'ayah' | 'page' | 'surah';
const repeats = [1, 3, 5, 10, -1] as const;
const iconSize = 22;

function IconButton({
  name, label, onPress, color, active = false,
}: { name: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color: string; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={`action-${label}`}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? .45 : 1, backgroundColor: active ? `${color}1e` : 'transparent' }]}>
      <Ionicons name={name} size={iconSize} color={color} />
    </Pressable>
  );
}

export default function MushafReader() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reader = useReader();
  const { page, goToPage, bookmarks, toggleBookmark, appearance, setAppearance, pageDisplay, setPageDisplay, readingMode, setReadingMode, practice, startPractice, storageError, audio, updateAudio } = reader;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tab, setTab] = useState<IndexTab>('chapters');
  const [query, setQuery] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const viewport = useWindowDimensions();
  const [imageError, setImageError] = useState(false);
  const [audioVerse, setAudioVerse] = useState<Verse | null>(null);
  const [played, setPlayed] = useState(0);
  const { reciterId, repeat, stopAt, speed } = audio;
  const setReciterId = (value: number) => updateAudio({ reciterId: value });
  const setRepeat = (value: number) => updateAudio({ repeat: value });
  const setStopAt = (value: StopAt) => updateAudio({ stopAt: value });
  const setSpeed = (value: number) => updateAudio({ speed: value });
  const [audioError, setAudioError] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(player);
  const catalog = useListQuranReciters({ query: { queryKey: getListQuranRecitersQueryKey(), enabled: !!quranApiOrigin } });
  const reciters = catalog.data?.reciters.filter(reciter => reciter.available === true) ?? [];
  const activeReciter = reciters.find(r => r.id === reciterId)?.id
    ?? reciters.find(r => r.id === catalog.data?.preferredRecitationId)?.id
    ?? reciters[0]?.id ?? null;
  const currentPage = useRef(page);
  currentPage.current = page;
  const surface = appearance === 'night' ? colors.background : appearance === 'warm' ? '#f2e9d8' : colors.background;
  const paper = appearance === 'night' ? '#ddd2b7' : appearance === 'warm' ? '#f3e7ce' : '#fffdf8';
  const fg = colors.foreground;
  const pageInfo = pages[page - 1];
  const visibleVerses = pageVerses.get(page) ?? [];
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const compactLandscape = viewport.width > viewport.height && viewport.height < 520;
  const topInset = Platform.OS === 'web' && !compactLandscape ? Math.max(67, insets.top) : insets.top;

  const close = useCallback(() => { Keyboard.dismiss(); setSheet(null); }, []);
  const navigate = useCallback((next: number) => {
    if (next < 1 || next > PAGE_COUNT) return;
    goToPage(next);
    setImageError(false);
    close();
    Haptics.selectionAsync().catch(() => undefined);
  }, [goToPage, close]);
  const pageRef = useRef(navigate);
  pageRef.current = navigate;
  const finishHandled = useRef(false);
  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 55) pageRef.current(currentPage.current + (gesture.dx > 0 ? 1 : -1));
    },
  }), []);

  useEffect(() => {
    if (!sheet || Platform.OS === 'web') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => listener.remove();
  }, [sheet, close]);
  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return [];
    return verses.filter(v => normalize(v.content).includes(term)).slice(0, 60);
  }, [query]);
  const matchingChapters = useMemo(() => {
    const term = normalize(query);
    return term ? chapters.filter(c => normalize(c.name).includes(term)).slice(0, 8) : [];
  }, [query]);
  const numericPage = Number(query.trim());
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(error => console.warn('Audio mode', error));
  }, []);
  useEffect(() => {
    if (audioStatus.error) setAudioError('تعذّر تشغيل التلاوة. تحقق من الاتصال أو اختر قارئًا آخر.');
  }, [audioStatus.error]);
  const playVerse = useCallback((verse: Verse, reciter = activeReciter) => {
    if (!quranApiOrigin || !reciter) {
      setAudioError('التلاوة غير متاحة الآن. تحقق من الاتصال وانتظر تحميل قائمة القرّاء.');
      return;
    }
    setAudioError(null);
    setAudioVerse(verse);
    player.replace({ uri: `${quranApiOrigin}/api/quran/audio/${reciter}/${verse.chapter_id}/${verse.number}` });
    player.setPlaybackRate(speed);
    player.play();
  }, [activeReciter, player, speed]);
  useEffect(() => {
    if (!audioStatus.didJustFinish) { finishHandled.current = false; return; }
    if (finishHandled.current) return;
    finishHandled.current = true;
    if (!audioStatus.didJustFinish || !audioVerse) return;
    if (repeat === -1 || played + 1 < repeat) {
      setPlayed(value => value + 1);
      player.seekTo(0).then(() => player.play()).catch(() => setAudioError('تعذّر تكرار الآية'));
      return;
    }
    setPlayed(0);
    const next = verses.find(v => v.chapter_id === audioVerse.chapter_id && v.number === audioVerse.number + 1);
    if (stopAt === 'ayah' || !next || (stopAt === 'page' && next.page_id !== audioVerse.page_id)) {
      setAudioVerse(null);
      return;
    }
    if (next.page_id !== currentPage.current) pageRef.current(next.page_id);
    playVerse(next);
  }, [audioStatus.didJustFinish, audioVerse, played, repeat, stopAt, player, playVerse]);
  const stopAudio = () => { player.pause(); setAudioVerse(null); setPlayed(0); };
  const moveAudio = (direction: -1 | 1) => {
    if (!audioVerse) return;
    const target = verses.find(v => v.chapter_id === audioVerse.chapter_id && v.number === audioVerse.number + direction);
    if (target) { setPlayed(0); if (target.page_id !== page) goToPage(target.page_id); playVerse(target); }
  };
  const openVerse = (verse: Verse) => {
    setSelectedVerse(verse);
    setSelectedWord(null);
    setSheet('verse');
  };
  const openPrintedWord = (verseKey: string, word: string | null) => {
    const [chapter, verseNumber] = verseKey.split(':').map(Number);
    const verse = visibleVerses.find(v => v.chapter_id === chapter && v.number === verseNumber);
    if (!verse) return;
    setSelectedVerse(verse);
    setSelectedWord(word);
    setSheet('verse');
  };
  const beginPractice = (verse: Verse) => {
    setSelectedVerse(verse);
    startPractice(verse.chapter_id, verse.number);
    setSheet('memorize');
  };
  const resumePractice = () => {
    const saved = practice && verses.find(v => v.chapter_id === practice.chapter && v.number === practice.verse);
    const target = saved ?? visibleVerses[0];
    if (target) {
      if (!saved) startPractice(target.chapter_id, target.number);
      setSelectedVerse(target);
      setSheet('memorize');
    }
  };
  const shareVerse = async () => {
    if (!selectedVerse) return;
    await Share.share({ message: `${selectedVerse.content}\nسورة ${chapterName(selectedVerse.chapter_id)}، الآية ${selectedVerse.number}` });
  };
  const copyVerse = async () => {
    if (selectedVerse) await Clipboard.setStringAsync(`${selectedVerse.content}\nسورة ${chapterName(selectedVerse.chapter_id)}، الآية ${selectedVerse.number}`);
  };

  if (!reader.ready) return <View style={[styles.center, { backgroundColor: surface }]}><ActivityIndicator color={colors.primary} /></View>;
  const stageHeight = compactLandscape
    ? viewport.height - Math.max(topInset, 8) - bottomInset - (audioVerse ? 54 : 12)
    : viewport.height - topInset - bottomInset - (readingMode ? 36 : audioVerse ? 180 : 132);
  const imageWidth = Math.min(viewport.width - (compactLandscape ? 110 : 12), Math.max(0, stageHeight) * (382.677 / 547.086));
  const imageHeight = imageWidth * (547.086 / 382.677);
  const wordWidth = Math.min(viewport.width - (compactLandscape ? 110 : 12), compactLandscape ? 450 : 640);
  const menuStyle = { backgroundColor: colors.card, borderColor: colors.border };

  return (
    <View testID="mushaf-reader" style={[styles.root, { backgroundColor: surface }]}>
      <View style={[styles.header, compactLandscape && styles.landscapeHeader, { paddingTop: compactLandscape ? topInset + 4 : topInset + 4 }]}>
        {!readingMode && (
          <>
            <IconButton name="menu-outline" label="الفهرس" onPress={() => setSheet('index')} color={fg} />
            <View style={[styles.headerTitle, compactLandscape && { opacity: 0 }]}>
              <Text numberOfLines={1} style={[styles.surahName, { color: fg }]}>{pageLabel(page)}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>الجزء {pageInfo?.part_id}  ·  صفحة {page}</Text>
            </View>
            <IconButton name="search-outline" label="البحث" onPress={() => setSheet('search')} color={fg} />
            <IconButton name="bookmark-outline" label="العلامات" onPress={() => setSheet('bookmarks')} color={fg} />
            <IconButton name="headset-outline" label="التلاوة" onPress={() => setSheet('audio')} color={fg} active={!!audioVerse} />
            <IconButton name="layers-outline" label="حفظني" onPress={resumePractice} color={fg} />
          </>
        )}
        {readingMode && !compactLandscape && <Text style={[styles.readingHint, { color: colors.mutedForeground }]}>وضع القراءة · المس الصفحة لإظهار الأدوات</Text>}
      </View>
      {!!storageError && <Text style={[styles.storageWarning, { color: colors.destructive }]}>{storageError}</Text>}
      <View style={[styles.pageStage, compactLandscape && { paddingTop: topInset, paddingBottom: bottomInset }]} {...swipe.panHandlers}>
        {pageDisplay === 'words'
          ? <MadaniWordPage key={page} page={page} width={wordWidth} height={Math.max(240, stageHeight)}
              background={paper} selectedVerseKey={selectedVerse ? `${selectedVerse.chapter_id}:${selectedVerse.number}` : null}
              onVersePress={openPrintedWord} />
          : <Pressable testID="mushaf-page" accessibilityRole="button" accessibilityLabel={`صورة صفحة المصحف ${page}، اضغط لإظهار أدوات القراءة`}
              onPress={() => setReadingMode(!readingMode)} style={[styles.paper, {
                backgroundColor: paper, width: imageWidth, height: imageHeight,
                borderColor: colors.border,
              }, Platform.OS === 'web'
                ? { boxShadow: '0 7px 16px rgba(27,56,35,.09)' }
                : { shadowColor: '#1b3823', shadowRadius: 15, shadowOpacity: .09, elevation: 3 }]}>
              {!imageError
                ? <Image source={pageImage(page)} style={[styles.pageImage, page <= 2 && { transform: [{ scale: 1.65 }] }]}
                    contentFit="contain" cachePolicy="disk"
                    onError={() => setImageError(true)} accessible accessibilityLabel={`صورة الصفحة ${page} من مصحف المدينة`} />
                : <View style={styles.center}>
                    <Text style={[styles.feedback, { color: colors.destructive }]}>تعذّر عرض الصفحة {page}</Text>
                    <Pressable onPress={() => setImageError(false)}><Text style={{ color: colors.primary }}>إعادة المحاولة</Text></Pressable>
                  </View>}
            </Pressable>}
        {pageDisplay === 'words' && readingMode &&
          <View style={styles.showTools}>
            <IconButton name="options-outline" label="إظهار أدوات القراءة" onPress={() => setReadingMode(false)} color={fg} />
          </View>}
      </View>
      {!!audioVerse && <View style={[styles.audioDock, compactLandscape && [styles.landscapeAudioDock, { bottom: bottomInset + 2 }], { backgroundColor: colors.secondary }]}>
        <IconButton name="close" label="إيقاف التلاوة" onPress={stopAudio} color={fg} />
        <IconButton name="play-skip-forward" label="الآية السابقة" onPress={() => moveAudio(-1)} color={fg} />
        <IconButton name={audioStatus.playing ? 'pause' : 'play'} label={audioStatus.playing ? 'إيقاف مؤقت' : 'استئناف'}
          onPress={() => audioStatus.playing ? player.pause() : player.play()} color={colors.primary} />
        <IconButton name="play-skip-back" label="الآية التالية" onPress={() => moveAudio(1)} color={fg} />
        <Pressable onPress={() => setSheet('audio')} style={styles.audioCaption}><Text numberOfLines={1} style={{ color: fg }}>سورة {chapterName(audioVerse.chapter_id)} · {audioVerse.number}</Text></Pressable>
      </View>}
      {!readingMode && <View style={[styles.dock, compactLandscape && {
        position: 'absolute', right: 7, top: Math.max(topInset, 8) + 64,
        flexDirection: 'column', paddingTop: 0,
      }, { paddingBottom: compactLandscape ? 0 : bottomInset + 6 }]}>
        <IconButton name="chevron-forward" label="الصفحة السابقة" onPress={() => navigate(page - 1)} color={fg} />
        <Pressable onPress={() => { setPageInput(String(page)); setSheet('index'); }}
          style={[styles.pagePill, menuStyle]} accessibilityRole="button" accessibilityLabel={`الانتقال إلى صفحة، الحالية ${page}`}>
          <Text style={[styles.pagePillText, { color: fg }]}>{page} / {PAGE_COUNT}</Text>
        </Pressable>
        <IconButton name="chevron-back" label="الصفحة التالية" onPress={() => navigate(page + 1)} color={fg} />
        <View style={[styles.dockDivider, compactLandscape && { height: 1, width: 26 }, { backgroundColor: colors.border }]} />
        <IconButton name="list-outline" label="آيات الصفحة" onPress={() => setSheet('verses')} color={fg} />
        <IconButton name="settings-outline" label="الإعدادات" onPress={() => setSheet('settings')} color={fg} />
      </View>}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.modalFrame}>
          <Pressable style={styles.scrim} onPress={close} accessibilityLabel="إغلاق اللوحة" />
          <View style={[styles.sheet, menuStyle, { paddingBottom: bottomInset + 14, maxHeight: viewport.height * .84 }]}>
            <View style={styles.sheetHeading}>
              <IconButton name="close" label="إغلاق" color={fg} onPress={close} />
              <Text style={[styles.sheetTitle, { color: fg }]}>{
                sheet === 'index' ? 'فهرس المصحف' : sheet === 'search' ? 'البحث في القرآن' :
                  sheet === 'bookmarks' ? 'علاماتي' : sheet === 'settings' ? 'إعدادات القراءة' :
                    sheet === 'verses' ? `آيات الصفحة ${page}` : sheet === 'memorize' ? 'حفظني' :
                      sheet === 'audio' ? 'التلاوة والتكرار' : sheet === 'tafsir' ? 'تفسير الآية' : 'خيارات الآية'
              }</Text>
              <View style={{ width: 44 }} />
            </View>
            {sheet === 'index' && <>
              <View style={styles.pageFormInline}>
                <TextInput value={pageInput} onChangeText={setPageInput} keyboardType="number-pad" maxLength={3}
                  style={[styles.input, styles.pageInput, { color: fg, borderColor: colors.border }]}
                  placeholder="رقم الصفحة" placeholderTextColor={colors.mutedForeground} textAlign="right" />
                <Pressable style={[styles.primaryButton, styles.pageSubmit, { backgroundColor: colors.primary }]}
                  onPress={() => navigate(Number(pageInput))}><Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>انتقال</Text></Pressable>
              </View>
              <View style={styles.segment}>
                {([['chapters', 'السور'], ['parts', 'الأجزاء'], ['bookmarks', 'العلامات']] as const).map(([id, label]) =>
                  <Pressable key={id} style={[styles.segmentItem, tab === id && { backgroundColor: colors.secondary }]}
                    onPress={() => setTab(id)}><Text style={[styles.segmentText, { color: tab === id ? colors.primary : colors.mutedForeground }]}>{label}</Text></Pressable>)}
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
                  {tab === 'chapters' ? chapters.map(chapter =>
                    <Row key={chapter.id} title={chapter.name} detail={`سورة ${chapter.id} · ${chapter.verse_count} آية · ص ${firstPageOfChapter(chapter.id)}`}
                      onPress={() => navigate(firstPageOfChapter(chapter.id))} colors={colors} />)
                    : tab === 'parts' ? parts.map(part => <Row key={part.id} title={part.name} detail={`ص ${firstPageOfPart(part.id)}`}
                      onPress={() => navigate(firstPageOfPart(part.id))} colors={colors} />)
                      : bookmarks.map(bookmark => <Row key={`${bookmark.chapter}:${bookmark.verse}`}
                        title={`سورة ${chapterName(bookmark.chapter)} · الآية ${bookmark.verse}`}
                        detail={`الصفحة ${bookmark.page}`} onPress={() => navigate(bookmark.page)} colors={colors} />)}
                  {tab === 'bookmarks' && !bookmarks.length && <Text style={[styles.empty, { color: colors.mutedForeground }]}>لا توجد علامات محفوظة</Text>}
              </ScrollView>
            </>}
            {sheet === 'search' && <>
              <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="ابحث عن كلمة أو سورة أو صفحة"
                placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.searchInput, { color: fg, borderColor: colors.border }]}
                textAlign="right" testID="search-input" />
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {Number.isInteger(numericPage) && numericPage >= 1 && numericPage <= PAGE_COUNT &&
                  <Row title={`الصفحة ${numericPage}`} detail="انتقال مباشر" onPress={() => navigate(numericPage)} colors={colors} />}
                {matchingChapters.map(chapter => <Row key={`c${chapter.id}`} title={`سورة ${chapter.name}`}
                  detail={`صفحة ${firstPageOfChapter(chapter.id)}`} onPress={() => navigate(firstPageOfChapter(chapter.id))} colors={colors} />)}
                {results.map(verse => <Row key={verse.id} title={verse.content} detail={`سورة ${chapterName(verse.chapter_id)} · آية ${verse.number} · صفحة ${verse.page_id}`}
                  onPress={() => { navigate(verse.page_id); setSelectedWord(null); setSelectedVerse(verse); setSheet('verse'); }} colors={colors} />)}
                {!!query.trim() && !results.length && !matchingChapters.length && !(numericPage >= 1 && numericPage <= PAGE_COUNT) &&
                  <Text style={[styles.empty, { color: colors.mutedForeground }]}>لا توجد نتائج مطابقة</Text>}
                {!query.trim() && <Text style={[styles.empty, { color: colors.mutedForeground }]}>البحث متاح دون إنترنت في النص المعتمد بالمشروع</Text>}
              </ScrollView>
            </>}
            {sheet === 'bookmarks' && <ScrollView style={styles.list}>
              {bookmarks.length ? bookmarks.map(bookmark =>
                <Row key={`${bookmark.chapter}:${bookmark.verse}`} title={`سورة ${chapterName(bookmark.chapter)} · الآية ${bookmark.verse}`}
                  detail={`الصفحة ${bookmark.page}`} onPress={() => {
                    navigate(bookmark.page);
                    setSelectedWord(null);
                    setSelectedVerse(verses.find(v => v.chapter_id === bookmark.chapter && v.number === bookmark.verse) ?? null);
                    setSheet('verse');
                  }} colors={colors} />)
                : <Text style={[styles.empty, { color: colors.mutedForeground }]}>لا توجد علامات بعد. اختر آية من قائمة آيات الصفحة لإضافتها.</Text>}
            </ScrollView>}
            {sheet === 'settings' && <ScrollView style={styles.list}>
              <Row title="القارئ والتكرار" detail="إعدادات التلاوة" onPress={() => setSheet('audio')} colors={colors} />
              <Text style={[styles.sectionTitle, { color: fg }]}>طريقة عرض المصحف</Text>
              <View style={styles.segment}>
                {([['words', 'كلمات تفاعلية'], ['images', 'صور الصفحات']] as [PageDisplay, string][]).map(([id, label]) =>
                  <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} testID={`display-${id}`}
                    style={[styles.segmentItem, pageDisplay === id && { backgroundColor: colors.secondary }]}
                    onPress={() => setPageDisplay(id)}>
                    <Text style={[styles.segmentText, { color: pageDisplay === id ? colors.primary : fg }]}>{label}</Text>
                  </Pressable>)}
              </View>
              <Text style={[styles.note, { color: colors.mutedForeground }]}>الكلمات التفاعلية هي العرض الأساسي وتتطلب اتصالًا لتحميل الصفحة وخطها؛ صور الصفحات محفوظة على الجهاز للقراءة دون إنترنت.</Text>
              <Text style={[styles.sectionTitle, { color: fg }]}>مظهر المصحف</Text>
              <View style={styles.segment}>
                {([['day', 'نهاري'], ['warm', 'دافئ'], ['night', 'ليلي']] as [Appearance, string][]).map(([id, label]) =>
                  <Pressable key={id} style={[styles.segmentItem, appearance === id && { backgroundColor: colors.secondary }]}
                    onPress={() => setAppearance(id)}><Text style={[styles.segmentText, { color: appearance === id ? colors.primary : fg }]}>{label}</Text></Pressable>)}
              </View>
              <Row title="وضع القراءة" detail="إخفاء الأدوات لعرض المصحف بوضوح" onPress={() => { setReadingMode(!readingMode); close(); }} colors={colors} />
              <Text style={[styles.sectionTitle, { color: fg }]}>حول مصحف حصاد</Text>
              <Text style={[styles.note, { color: colors.mutedForeground }]}>صفحات مصحف المدينة برواية حفص من مجمع الملك فهد لطباعة المصحف الشريف. القراءة والبحث والعلامات تعمل دون إنترنت. التلاوة والتفسير يحتاجان اتصالًا.</Text>
              {privacyUrl
                ? <Row title="سياسة الخصوصية" detail="تفتح في المتصفح"
                    onPress={() => { if (privacyUrl) Linking.openURL(privacyUrl).catch(() => undefined); }} colors={colors} />
                : <Text style={[styles.note, { color: colors.destructive }]}>رابط سياسة الخصوصية غير مُعدّ لنسخة التطبيق النهائية.</Text>}
              <Text style={[styles.note, { color: colors.mutedForeground }]}>الإصدار 1.0.0 · تُحفظ اختيارات القراءة على هذا الجهاز.</Text>
            </ScrollView>}
            {sheet === 'verses' && <ScrollView style={styles.list}>
               <Text style={[styles.note, { color: colors.mutedForeground }]}>{pageDisplay === 'images' ? 'في وضع الصور، اختر الآية هنا؛ الصور ليست مناطق لمس.' : 'يمكنك لمس الكلمة أو رقم الآية على صفحة المصحف، أو اختيار الآية من هذه القائمة.'}</Text>
              {visibleVerses.map(verse => <Row key={verse.id} title={verse.content}
                detail={`سورة ${chapterName(verse.chapter_id)} · الآية ${verse.number}`}
                onPress={() => openVerse(verse)} colors={colors} />)}
            </ScrollView>}
            {sheet === 'verse' && selectedVerse && <ScrollView style={styles.list}>
              {!!selectedWord && <>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>الكلمة المحددة: {selectedWord}</Text>
                <Row title="نسخ الكلمة" detail="نسخ الكلمة من بيانات المصحف" onPress={() => { Clipboard.setStringAsync(selectedWord).catch(() => undefined); }} colors={colors} />
              </>}
              <Text selectable style={[styles.verseText, { color: fg }]}>{selectedVerse.content}</Text>
              <Text style={[styles.note, { color: colors.mutedForeground }]}>سورة {chapterName(selectedVerse.chapter_id)} · الآية {selectedVerse.number}</Text>
              <Row title={bookmarks.some(b => b.chapter === selectedVerse.chapter_id && b.verse === selectedVerse.number)
                ? 'إزالة العلامة' : 'إضافة علامة'} detail="تحفظ على هذا الجهاز"
                onPress={() => toggleBookmark(selectedVerse.chapter_id, selectedVerse.number)} colors={colors} />
              <Row title="مشاركة الآية" detail="باستخدام مشاركة الجهاز" onPress={() => { shareVerse().catch(() => undefined); }} colors={colors} />
              <Row title="نسخ الآية" detail="نسخ النص الموثق" onPress={() => { copyVerse().catch(() => undefined); }} colors={colors} />
              <Row title="استماع وتكرار" detail="اختر القارئ وعدد المرات" onPress={() => setSheet('audio')} colors={colors} />
              <Row title="تفسير الآية" detail="من المصدر الموثق في حصاد" onPress={() => setSheet('tafsir')} colors={colors} />
              <Row title="ابدأ حفظ هذه الآية" detail="جلسة حفظ موجهة على الجهاز" onPress={() => beginPractice(selectedVerse)} colors={colors} />
            </ScrollView>}
            {sheet === 'tafsir' && selectedVerse && <ScrollView style={styles.list}>
              <Text style={[styles.note, { color: colors.mutedForeground }]}>سورة {chapterName(selectedVerse.chapter_id)} · الآية {selectedVerse.number}</Text>
              <TafsirPanel verse={selectedVerse} />
            </ScrollView>}
            {sheet === 'memorize' && practice && <ScrollView style={styles.list}>
              <GuidedPractice key={`${practice.chapter}:${practice.verse}`}
                verse={verses.find(v => v.chapter_id === practice.chapter && v.number === practice.verse)!}
                onPlay={(verse, times) => { setRepeat(times); setStopAt('ayah'); setPlayed(0); playVerse(verse); }}
                onPause={() => player.pause()} playing={audioStatus.playing} audioError={audioError}
                onNext={next => { startPractice(next.chapter_id, next.number); setSelectedVerse(next); goToPage(next.page_id); }} />
            </ScrollView>}
            {sheet === 'audio' && <ScrollView style={styles.list}>
              <Text style={[styles.sectionTitle, { color: fg }]}>الآية</Text>
              <Text style={[styles.note, { color: colors.mutedForeground }]}>
                {selectedVerse ? `سورة ${chapterName(selectedVerse.chapter_id)} · الآية ${selectedVerse.number}` : `الآية الأولى في الصفحة ${page}`}
              </Text>
              <Text style={[styles.sectionTitle, { color: fg }]}>القارئ</Text>
              {catalog.isPending && !!quranApiOrigin && <ActivityIndicator color={colors.primary} />}
              {!quranApiOrigin && <Text style={[styles.note, { color: colors.destructive }]}>تحتاج نسخة الجوال النهائية إلى عنوان خدمة حصاد الموثوقة للتلاوة.</Text>}
              {catalog.isError && <Text style={[styles.note, { color: colors.destructive }]}>تعذّر تحميل القرّاء. تحقق من اتصال الإنترنت.</Text>}
              {reciters.map(reciter => <Row key={reciter.id} title={`${activeReciter === reciter.id ? '✓  ' : ''}${reciter.name}`}
                detail={reciter.style ?? 'تلاوة'} onPress={() => { setReciterId(reciter.id); if (audioVerse) { setPlayed(0); playVerse(audioVerse, reciter.id); } }} colors={colors} />)}
              <Text style={[styles.sectionTitle, { color: fg }]}>عدد مرات التكرار</Text>
              <View style={styles.segment}>
                {repeats.map(value => <Pressable key={value}
                  style={[styles.segmentItem, repeat === value && { backgroundColor: colors.secondary }]}
                  onPress={() => { setRepeat(value); setPlayed(0); }}>
                  <Text style={{ color: fg }}>{value === -1 ? 'مستمر' : value}</Text>
                </Pressable>)}
              </View>
              <Text style={[styles.sectionTitle, { color: fg }]}>التوقف بعد</Text>
              <View style={styles.segment}>
                {([['ayah', 'آية'], ['page', 'صفحة'], ['surah', 'سورة']] as [StopAt, string][]).map(([id, label]) =>
                  <Pressable key={id} style={[styles.segmentItem, stopAt === id && { backgroundColor: colors.secondary }]}
                    onPress={() => setStopAt(id)}><Text style={{ color: fg }}>{label}</Text></Pressable>)}
              </View>
              <Text style={[styles.sectionTitle, { color: fg }]}>السرعة</Text>
              <View style={styles.segment}>{[.75, 1, 1.25].map(value =>
                <Pressable key={value} style={[styles.segmentItem, speed === value && { backgroundColor: colors.secondary }]}
                  onPress={() => { setSpeed(value); player.setPlaybackRate(value); }}><Text style={{ color: fg }}>{value}×</Text></Pressable>)}</View>
              {!!audioError && <Text style={[styles.note, { color: colors.destructive }]}>{audioError}</Text>}
              <Pressable disabled={!activeReciter} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: activeReciter ? 1 : .5 }]}
                onPress={() => {
                  const start = selectedVerse ?? visibleVerses[0];
                  if (start) { setPlayed(0); playVerse(start); close(); }
                }}>
                <Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>بدء التلاوة</Text>
              </Pressable>
              <Text style={[styles.note, { color: colors.mutedForeground }]}>يُجلب الصوت من مصدر التلاوة المعتمد عند الاتصال بالإنترنت. لا تُحفظ ملفات الصوت دون إذن موثق.</Text>
            </ScrollView>}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ title, detail, onPress, colors }: { title: string; detail: string; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? .55 : 1 }]}>
    <Ionicons name="chevron-back" size={19} color={colors.mutedForeground} />
    <View style={styles.rowBody}>
      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>{detail}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  header: { minHeight: 64, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 6 },
  landscapeHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, minHeight: 44 },
  headerTitle: { flex: 1, alignItems: 'center', minWidth: 80 },
  surahName: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  iconButton: { width: 43, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  readingHint: { flex: 1, textAlign: 'center', fontSize: 12 },
  storageWarning: { textAlign: 'center', fontSize: 12, paddingHorizontal: 12 },
  pageStage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  showTools: { position: 'absolute', top: 10, right: 10 },
  paper: { borderWidth: 1, overflow: 'hidden' },
  pageImage: { width: '100%', height: '100%' },
  feedback: { fontSize: 15 },
  dock: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', paddingTop: 8, gap: 6 },
  audioDock: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 8, minHeight: 46 },
  landscapeAudioDock: { position: 'absolute', left: 8, bottom: 0, zIndex: 3, borderRadius: 14, maxWidth: 260 },
  audioCaption: { flex: 1, alignItems: 'flex-end', paddingRight: 8 },
  pagePill: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, minWidth: 85, alignItems: 'center' },
  pagePillText: { fontSize: 15, fontWeight: '700' },
  dockDivider: { height: 26, width: 1, marginHorizontal: 3 },
  modalFrame: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,27,17,.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, minHeight: 220, paddingHorizontal: 18 },
  sheetHeading: { height: 62, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 19, fontWeight: '700' },
  segment: { flexDirection: 'row-reverse', gap: 7, marginVertical: 10 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12 },
  segmentText: { fontSize: 14, fontWeight: '700' },
  list: { maxHeight: 520 },
  pageFormInline: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginVertical: 8 },
  pageInput: { flex: 1 },
  pageSubmit: { minWidth: 84, paddingHorizontal: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  searchInput: { marginBottom: 8 },
  primaryButton: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 64, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  rowBody: { flex: 1, alignItems: 'flex-end' },
  rowTitle: { textAlign: 'right', fontSize: 16, fontWeight: '600', writingDirection: 'rtl' },
  rowDetail: { textAlign: 'right', fontSize: 12, marginTop: 3, writingDirection: 'rtl' },
  empty: { textAlign: 'center', paddingVertical: 30, lineHeight: 24 },
  note: { fontSize: 13, lineHeight: 22, textAlign: 'right', marginVertical: 12, writingDirection: 'rtl' },
  sectionTitle: { fontSize: 16, fontWeight: '700', textAlign: 'right', marginTop: 15 },
  verseText: { fontSize: 23, lineHeight: 42, textAlign: 'center', writingDirection: 'rtl', paddingVertical: 15 },
});