import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetPresentation,
  useUpdatePresentation,
  useGetPresentationUsage,
  getGetPresentationQueryKey,
  getGetPresentationUsageQueryKey,
  type Presentation,
  type Slide,
  type SlideElement,
  type PresentationTierWithUsage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import {
  ArrowRight, ArrowLeft, Loader2, Plus, Trash2, Copy, Play, Eye,
  ChevronUp, ChevronDown, ImagePlus, Save, CheckCircle2, X as XIcon,
  Download, FileText, Presentation as PresentationIcon,
  AlertCircle, Type as TypeIcon, Square, Circle as CircleIcon,
  Minus, MoveUpRight, GripVertical, Smile, Palette,
  Layers, ChevronsUp, ChevronsDown, Lock, Sparkles,
  Radio, History, MoreVertical, Image as ImageIcon, Shapes,
  Undo2, Redo2, Bold, CheckSquare, Pencil,
  Triangle, Diamond, Crown, Phone, Users, Flag, MapPin,
  Rocket, Swords, Dice5, Zap, Search, Crop,
  Cloud, MessageSquare, BarChart2, Film,
} from "lucide-react";
import { useIsBelowLg } from "@/hooks/use-mobile";
import * as LucideIcons from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SLIDE_THEMES, SLIDE_PATTERNS, getTheme, getPattern, defaultTextColorForSlide,
  pickDefaultTheme,
} from "@/lib/slide-themes";
import { LUCIDE_NAMES } from "@/lib/lucide-whitelist";
import { SlideStage, HasadGameRenderer } from "@/lib/slide-render";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ActivityPickerDialog } from "@/components/teacher/presentations/activity-picker-dialog";
import { ActivitySuggestionsBanner } from "@/components/teacher/presentations/activity-suggestions-banner";
import { SmartAddSlideDialog } from "@/components/teacher/presentations/smart-add-slide-dialog";
import { VideoEmbedDialog } from "@/components/teacher/presentations/video-embed-dialog";
import { ImageSearchDialog } from "@/components/teacher/presentations/image-search-dialog";
import { AiPresentationBuilder } from "./builder";
import { LinkedActivitySelector } from "@/components/teacher/presentations/linked-activity-selector";
import { ClassSelector, getRememberedTargetClass } from "@/components/teacher/class-selector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HelpCircle, Video } from "lucide-react";
import { parseVideoUrl } from "@/lib/video-url";

const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";
const CANVAS_W = 1280;
const CANVAS_H = 720;

/* Resolve a Lucide icon component by name with safe fallback. We
   rely on the whitelist (LUCIDE_NAMES) so the picker stays bounded,
   but rendering is forgiving — unknown names fall back to a square. */
function getLucideIcon(name: string | null | undefined): React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> {
  const safe = (name ?? "").trim();
  const mod = LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>;
  const Comp = safe ? mod[safe] : undefined;
  return Comp ?? mod.Square;
}
const API_BASE = import.meta.env.VITE_API_URL || "";

/* ── Curated GIF library ──────────────────────────────────────────── */
const GIF_LIBRARY: {
  id: string;
  labelAr: string;
  labelEn: string;
  items: { url: string; altAr: string; altEn: string }[];
}[] = [
  {
    id: "celebrate",
    labelAr: "🎉 احتفال",
    labelEn: "🎉 Celebrate",
    items: [
      { url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",  altAr: "قصاصات ورقية",   altEn: "Confetti" },
      { url: "https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif",  altAr: "مفرقعات",        altEn: "Party Poppers" },
      { url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",  altAr: "ألعاب نارية",    altEn: "Fireworks" },
      { url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif",      altAr: "ياي!",            altEn: "Yay!" },
      { url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",      altAr: "رقص",             altEn: "Happy Dance" },
      { url: "https://media.giphy.com/media/LHZyixOnHwDDy/giphy.gif",      altAr: "مبروك!",          altEn: "Congrats!" },
    ],
  },
  {
    id: "bravo",
    labelAr: "👏 أحسنت",
    labelEn: "👏 Bravo",
    items: [
      { url: "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif", altAr: "تصفيق بطيء",     altEn: "Slow Clap" },
      { url: "https://media.giphy.com/media/111ebonIs1cX0c/giphy.gif",     altAr: "إبهام لأعلى",    altEn: "Thumbs Up" },
      { url: "https://media.giphy.com/media/7yojoQtevjOci/giphy.gif",      altAr: "تصفيق مينيونز",  altEn: "Minions Clap" },
      { url: "https://media.giphy.com/media/xNrM4cGJ8u3ao/giphy.gif",      altAr: "عمل رائع!",      altEn: "Great Job!" },
      { url: "https://media.giphy.com/media/l41lI8X3bQ3AKIQM8/giphy.gif",  altAr: "ممتاز",          altEn: "Excellent" },
      { url: "https://media.giphy.com/media/ZdUnQhlmH0F4tT5LvO/giphy.gif", altAr: "فعلتها!",        altEn: "You Did It!" },
    ],
  },
  {
    id: "think",
    labelAr: "🤔 تفكير",
    labelEn: "🤔 Thinking",
    items: [
      { url: "https://media.giphy.com/media/a5viI92PAF89q/giphy.gif",      altAr: "وجه التفكير",    altEn: "Thinking Face" },
      { url: "https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/giphy.gif", altAr: "أفكّر…",         altEn: "Hmm..." },
      { url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif", altAr: "مندهش!",         altEn: "Surprised!" },
      { url: "https://media.giphy.com/media/3oKIPseqKZUd1XIFHK/giphy.gif", altAr: "محتار",          altEn: "Confused" },
      { url: "https://media.giphy.com/media/WRQBpd3G8TlZ6/giphy.gif",      altAr: "انتظر ماذا؟",    altEn: "Wait What?" },
    ],
  },
  {
    id: "fun",
    labelAr: "😂 مرح",
    labelEn: "😂 Fun",
    items: [
      { url: "https://media.giphy.com/media/MNmyTku20WHpCZIKB7/giphy.gif", altAr: "ضحك",             altEn: "LOL" },
      { url: "https://media.giphy.com/media/ely5Fud8a0HH6/giphy.gif",      altAr: "هههه",            altEn: "Hehe" },
      { url: "https://media.giphy.com/media/l3q2Kciqt3yNuqD5e/giphy.gif",  altAr: "قهقهة",          altEn: "Laughing" },
      { url: "https://media.giphy.com/media/Vccpm1O9gV1g4/giphy.gif",      altAr: "قطة مضحكة",      altEn: "Funny Cat" },
      { url: "https://media.giphy.com/media/JltOMwYmi0VrO/giphy.gif",      altAr: "لا أصدق",        altEn: "No Way" },
    ],
  },
  {
    id: "stars",
    labelAr: "⭐ نجوم",
    labelEn: "⭐ Stars",
    items: [
      { url: "https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif",  altAr: "بريق",            altEn: "Sparkles" },
      { url: "https://media.giphy.com/media/3o6gDWzmAzv1ALnkyk/giphy.gif", altAr: "سحر",             altEn: "Magic" },
      { url: "https://media.giphy.com/media/26tPnAAH7PhAYBJBW/giphy.gif",  altAr: "نجوم متساقطة",   altEn: "Star Rain" },
      { url: "https://media.giphy.com/media/1AgrwTATMjqbeFsYo9/giphy.gif", altAr: "نجمة ذهبية",     altEn: "Gold Star" },
      { url: "https://media.giphy.com/media/mf8uIoMpYhFBDmE6Qh/giphy.gif", altAr: "لامع",            altEn: "Glitter" },
    ],
  },
  {
    id: "education",
    labelAr: "📚 تعليم",
    labelEn: "📚 Education",
    items: [
      { url: "https://media.giphy.com/media/3oKIPdlB8uDHPBkAY0/giphy.gif", altAr: "قراءة",          altEn: "Reading" },
      { url: "https://media.giphy.com/media/l4FGmHTcdl3R4jGXi/giphy.gif",  altAr: "فكرة!",          altEn: "Lightbulb!" },
      { url: "https://media.giphy.com/media/xUOxf9EbYbFcWiLBYY/giphy.gif", altAr: "ذكي!",           altEn: "Smart!" },
      { url: "https://media.giphy.com/media/BFSRdwvNw0OvBH1Gqv/giphy.gif", altAr: "كتب",            altEn: "Books" },
      { url: "https://media.giphy.com/media/3oz8xRF0v9WMAUVLNK/giphy.gif", altAr: "يكتب",           altEn: "Typing" },
    ],
  },
];

const FONT_FAMILIES: Array<{ value: string; label: string }> = [
  { value: "inherit", label: "Default" },
  { value: "'Cairo', sans-serif", label: "Cairo" },
  { value: "'IBM Plex Sans Arabic', sans-serif", label: "IBM Plex Arabic" },
  { value: "'Tajawal', sans-serif", label: "Tajawal" },
  { value: "'Amiri', serif", label: "Amiri" },
  { value: "'Noto Naskh Arabic', serif", label: "Noto Naskh" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "Georgia, serif", label: "Georgia" },
];

/* Plain-text sanitizer for contentEditable inline edits. We never
   trust innerHTML from contentEditable: strip tags and collapse to
   text. Newlines preserved. */
function sanitizeText(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent ?? "").slice(0, 5000);
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeBlankSlide(language: "ar" | "en"): Slide {
  const ar = language === "ar";
  return {
    id: genId("s"),
    layout: "content",
    background: "#ffffff",
    elements: [
      {
        id: genId("t"),
        kind: "text",
        x: 80, y: 80, w: 1120, h: 100,
        text: ar ? "عنوان الشريحة" : "Slide title",
        fontSize: 44,
        fontWeight: "700",
        align: "start",
        /* Omit `color` so the renderer's theme-aware default kicks in
           — keeps new blank slides readable on dark themes without
           baking in a color the user would have to manually fix. */
      } as SlideElement,
      {
        id: genId("t"),
        kind: "text",
        x: 80, y: 220, w: 1120, h: 420,
        text: ar ? "اكتب محتوى الشريحة هنا..." : "Write slide content here...",
        fontSize: 24,
        align: "start",
      } as SlideElement,
    ],
  };
}

function duplicateSlide(slide: Slide): Slide {
  return {
    ...slide,
    id: genId("s"),
    elements: (slide.elements ?? []).map((el) => ({
      ...el,
      id: genId(el.kind.charAt(0)),
    })),
  };
}

async function uploadImage(file: File): Promise<string> {
  const reqRes = await fetch(`${API_BASE}/api/storage/uploads/request-image-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!reqRes.ok) throw new Error("upload-url");
  const { uploadURL, objectPath } = await reqRes.json();
  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("upload-put");
  return objectPath.startsWith("/")
    ? `${API_BASE}/api/storage${objectPath}`
    : objectPath;
}

async function registerAsset(
  presentationId: number,
  url: string,
  byteSize: number,
): Promise<{ ok: true } | { ok: false; limit?: LimitErrorInfo }> {
  // Returns the structured 403 LIMIT_EXCEEDED payload if the server
  // rejected the upload so the editor can surface a localized toast.
  try {
    const r = await fetch(`${API_BASE}/api/presentations/${presentationId}/assets`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "image", url, byteSize }),
    });
    if (r.status === 403) {
      const j = await r.json().catch(() => null);
      if (j && j.code === "LIMIT_EXCEEDED") {
        return { ok: false, limit: j as LimitErrorInfo };
      }
    }
    if (!r.ok) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

type LimitKind = "slides" | "images" | "files" | "sizeMb";
interface LimitErrorInfo {
  code: "LIMIT_EXCEEDED";
  kind: LimitKind;
  limit: number;
  current: number;
}

/* Pulls a structured LIMIT_EXCEEDED payload off either an ApiError
   (autosave/saveNow path) or a raw fetch failure. Returns null when
   the error is something else. */
function extractLimitError(err: unknown): LimitErrorInfo | null {
  const e = err as { status?: number; data?: unknown } | null;
  if (!e || e.status !== 403) return null;
  const d = e.data as { code?: string; kind?: string; limit?: number; current?: number } | null;
  if (!d || d.code !== "LIMIT_EXCEEDED") return null;
  if (!d.kind || typeof d.limit !== "number" || typeof d.current !== "number") return null;
  return d as LimitErrorInfo;
}

function limitKindLabel(kind: LimitKind, isAr: boolean): string {
  if (isAr) {
    return kind === "slides" ? "الشرائح"
      : kind === "images" ? "الصور"
      : kind === "files" ? "الملفات"
      : "حجم الملفات";
  }
  return kind === "slides" ? "slides"
    : kind === "images" ? "images"
    : kind === "files" ? "files"
    : "total file size";
}

function formatLimitValue(kind: LimitKind, n: number, isAr: boolean): string {
  if (kind === "sizeMb") return isAr ? `${n} م.ب` : `${n} MB`;
  return String(n);
}

export default function PresentationEditor() {
  const { lang } = useI18n();
  const [, params] = useRoute("/teacher/presentations/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? Number(params.id) : NaN;
  const queryClient = useQueryClient();

  /* Phase 1B handoff — when the editor is opened right after the
     AI build flow we receive `?draftId=N`. We use it to surface
     activity suggestions from the originating outline. Recomputed
     whenever `id` changes (i.e. wouter navigates the same route to
     a different presentation, e.g. after the AI build redirects
     from /teacher/presentations/123 → /456?draftId=N) so the banner
     shows up on the freshly-built deck. */
  const draftIdFromUrl = useMemo(() => {
    if (typeof window === "undefined") return NaN;
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get("draftId");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : NaN;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { data, isLoading, error } = useGetPresentation(id, {
    query: {
      queryKey: getGetPresentationQueryKey(id),
      enabled: Number.isFinite(id),
    },
  });

  const updateMutation = useUpdatePresentation();

  /* Per-deck usage + tier. Drives the visible counters and the
     "near/at cap" lock badge. Refetched after every save and after
     image uploads so the strip reflects the latest counts. */
  const { data: usageData } = useGetPresentationUsage(id, {
    query: {
      queryKey: getGetPresentationUsageQueryKey(id),
      enabled: Number.isFinite(id),
      staleTime: 0,
    },
  });
  const tier: PresentationTierWithUsage | undefined = usageData;

  const [showUpgrade, setShowUpgrade] = useState(false);

  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedElId, setSelectedElId] = useState<string | null>(null);
  /* Additional element ids selected on the active slide. Empty unless
     the user pressed Ctrl+A or shift-clicked. The primary inspector
     still binds to `selectedElId` (the last/anchor selection); bulk
     operations (delete, duplicate) apply to selectedElId ∪ multiSelectIds. */
  const [multiSelectIds, setMultiSelectIds] = useState<string[]>([]);
  /* Slide ids selected for bulk operations (delete / duplicate
     several slides at once). Independent from `activeIdx` — the
     active slide is always the one being edited; selectedSlideIds is
     the set acted on by the bulk action chip in the slide rail. */
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
  const [smartAddOpen, setSmartAddOpen] = useState(false);
  const [videoEmbedDialogOpen, setVideoEmbedDialogOpen] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  /* Phase 7 — Go-Live class picker. Opening a live session now
     prompts the teacher with an explicit class dropdown (same
     ClassSelector used by every game-setup page) instead of silently
     reusing the last-selected class from localStorage. The
     `goLiveTarget` field carries which navigation style to apply
     after the session is created so the desktop toolbar can keep
     using window.open while the mobile sheet falls back to a same-
     tab navigation (popup blockers swallow window.open after async
     work without a fresh user gesture). */
  const [goLiveOpen, setGoLiveOpen] = useState<null | { mode: "newTab" | "sameTab" }>(null);
  /* Deck-level theme/pattern, persisted independently of slides
     since they live on the presentation row, not the slide JSON. */
  const [theme, setTheme] = useState<string>(() => pickDefaultTheme());
  const [pattern, setPattern] = useState<string>("solid");
  /* Index of the slide shown in the in-editor Preview modal. `null`
     means the modal is closed. Lives outside the modal so the toolbar
     button can open it without remounting state. */
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  /* Seed values for the activity picker — populated when the teacher
     accepts a suggestion from the AI suggestions banner so the
     Compose tab opens prefilled instead of blank. */
  const [pickerInitial, setPickerInitial] = useState<{
    prompt?: string;
    kind?: "mcq" | "true_false" | "open" | "poll" | "word_cloud" | "open_wall";
  }>({});
  const [gifLibraryOpen, setGifLibraryOpen] = useState(false);
  /* Outline indices the editor has already inserted activities for via
     the AI suggestions banner. Reported back to the banner so the
     corresponding chip is dismissed only after a real insertion (not
     when the picker is cancelled). */
  const [dismissedSuggestionKeys, setDismissedSuggestionKeys] =
    useState<Set<number>>(new Set());
  /* Outline index of the suggestion currently waiting for the user to
     confirm via the picker. Cleared on cancel/close; promoted into
     `dismissedSuggestionKeys` on successful insert. */
  const [pendingSuggestionKey, setPendingSuggestionKey] =
    useState<number | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  /* Canva-style mobile/tablet shell (<1024px). Desktop is byte-for-byte
     unchanged when isMobile is false. The bottom sheet drives all the
     contextual editing surfaces. */
  const isMobile = useIsBelowLg();
  type MobileSheet = "none" | "add" | "inspect" | "theme" | "pattern" | "shapes" | "icons" | "notes" | "menu";
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>("none");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);
  /* Mirror readOnly into a ref so async/event handlers like DnD can
     bail out without a stale closure or extra re-binds. */
  const readOnlyRef = useRef(false);

  /* DnD sensors — pointer + keyboard for accessible reorder. */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* RTL is driven by the deck's language, not the UI locale, so a
     teacher with English UI can still author Arabic decks (and vice
     versa). */
  const deckLang = (data?.language ?? lang) as "ar" | "en";
  const isAr = deckLang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const Back = isAr ? ArrowRight : ArrowLeft;

  /* When the route swaps to a different presentation (e.g. the AI
     build flow navigates from /teacher/presentations/123 →
     /teacher/presentations/456?draftId=N within the same wouter
     route — no remount), reset the per-deck state so the next
     hydration loads the new deck instead of keeping the previous
     deck's slides in memory and silently autosaving them onto the
     new id. */
  const lastIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(id)) return;
    if (lastIdRef.current === id) return;
    lastIdRef.current = id;
    initRef.current = false;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSlides([]);
    setActiveIdx(0);
    setSelectedElId(null);
    setMultiSelectIds([]);
    setSelectedSlideIds(new Set());
    historyRef.current = { past: [], future: [] };
    setHistoryVersion((v) => v + 1);
    setDirty(false);
    setSavedAt(null);
    setTheme(pickDefaultTheme());
    setPattern("solid");
    setMobileSheet("none");
    setPickerInitial({});
    setPendingSuggestionKey(null);
    setDismissedSuggestionKeys(new Set());
    setPreviewIdx(null);
    setActivityPickerOpen(false);
    setGifLibraryOpen(false);
  }, [id]);

  /* Hydrate local state once when the deck first loads — and again
     after the id-change effect above clears `initRef`. The
     `data.id !== id` guard makes the invariant explicit so a
     stale react-query payload (e.g. previous deck served from
     cache while the new fetch is still in flight) cannot rehydrate
     the editor with the wrong slides. After hydration all
     mutations flow through `setSlides` + autosave. */
  useEffect(() => {
    if (!data || initRef.current) return;
    if (Number.isFinite(id) && (data as { id?: number }).id !== id) return;
    initRef.current = true;
    const incoming = Array.isArray(data.slides) && data.slides.length > 0
      ? data.slides
      : [makeBlankSlide((data.language ?? "ar") as "ar" | "en")];
    setSlides(incoming);
    setActiveIdx(0);
    if (data.theme) setTheme(data.theme);
    if (data.pattern) setPattern(data.pattern);
  }, [data]);

  /* Persist deck-level theme/pattern immediately (rare events, no
     debounce needed). Optimistically update local state first. */
  const persistTheme = useCallback(
    (next: { theme?: string; pattern?: string }) => {
      if (!Number.isFinite(id)) return;
      updateMutation.mutate(
        { id, data: next as never },
        {
          onSuccess: () => {
            setSavedAt(new Date());
            queryClient.invalidateQueries({ queryKey: getGetPresentationQueryKey(id) });
          },
          onError: () => toast.error("Save failed"),
        },
      );
    },
    [id, queryClient, updateMutation],
  );

  const onChangeTheme = (key: string) => {
    setTheme(key);
    persistTheme({ theme: key });
  };
  const onChangePattern = (key: string) => {
    setPattern(key);
    persistTheme({ pattern: key });
  };

  const activeSlide = slides[activeIdx];
  const selectedEl = useMemo(
    () => activeSlide?.elements?.find((e) => e.id === selectedElId) ?? null,
    [activeSlide, selectedElId],
  );

  /* ── Autosave: debounced PATCH 500ms after last edit. */
  const saveTimerRef = useRef<number | null>(null);
  const persist = useCallback(
    (next: Slide[]) => {
      if (!Number.isFinite(id)) return;
      updateMutation.mutate(
        { id, data: { slides: next as never } },
        {
          onSuccess: () => {
            setDirty(false);
            setSavedAt(new Date());
            queryClient.invalidateQueries({ queryKey: getGetPresentationQueryKey(id) });
            queryClient.invalidateQueries({ queryKey: getGetPresentationUsageQueryKey(id) });
          },
          onError: (err) => {
            const lim = extractLimitError(err);
            if (lim) {
              const resName = limitKindLabel(lim.kind, isAr);
              toast.error(
                isAr
                  ? `لقد تجاوزت حد ${resName} (${formatLimitValue(lim.kind, lim.current, isAr)} / ${formatLimitValue(lim.kind, lim.limit, isAr)}). رقّ إلى الباقة الاحترافية لإزالة الحدود.`
                  : `You've exceeded the ${resName} limit (${formatLimitValue(lim.kind, lim.current, isAr)} / ${formatLimitValue(lim.kind, lim.limit, isAr)}). Upgrade to Pro to remove caps.`,
                { duration: 6000 },
              );
              setShowUpgrade(true);
              return;
            }
            toast.error(isAr ? "فشل الحفظ التلقائي" : "Autosave failed");
          },
        },
      );
    },
    [id, isAr, queryClient, updateMutation],
  );

  useEffect(() => {
    if (!dirty) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persist(slides);
    }, 500);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [slides, dirty, persist]);

  /* Auto-sync the mobile inspector sheet with element selection.
     Selecting an element opens the contextual sheet; deselecting (or
     closing the sheet) hides it. Desktop is unaffected. */
  useEffect(() => {
    if (!isMobile) return;
    if (selectedElId) {
      setMobileSheet("inspect");
    } else {
      setMobileSheet((prev) => (prev === "inspect" ? "none" : prev));
    }
  }, [isMobile, selectedElId]);

  /* Warn before navigating away with unsaved edits. */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /* ── Undo / Redo ──────────────────────────────────────────────────
     Snapshot-based history: every `mutateSlides` push the previous
     `slides` array onto `past`; undo pops it back and pushes current
     onto `future`. We keep the history in a ref (avoid re-renders
     on every edit) and bump `historyVersion` only when the buttons'
     enabled state changes. Capped at 50 entries to bound memory. */
  const HISTORY_LIMIT = 50;
  const historyRef = useRef<{ past: Slide[][]; future: Slide[][] }>({
    past: [],
    future: [],
  });
  const [historyVersion, setHistoryVersion] = useState(0);
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const mutateSlides = (mutator: (prev: Slide[]) => Slide[]) => {
    let changed = false;
    setSlides((prev) => {
      const next = mutator(prev);
      /* Skip history push if nothing actually changed (mutator
         returned the same reference) — prevents Ctrl+Z "doing
         nothing" after no-op clicks, and avoids spurious autosave
         cycles when handlers are called with idempotent patches. */
      if (next === prev) return prev;
      changed = true;
      const h = historyRef.current;
      h.past.push(prev);
      if (h.past.length > HISTORY_LIMIT) h.past.shift();
      h.future = [];
      return next;
    });
    if (changed) {
      setHistoryVersion((v) => v + 1);
      setDirty(true);
    }
  };

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    setSlides((cur) => {
      const prev = h.past.pop()!;
      h.future.push(cur);
      if (h.future.length > HISTORY_LIMIT) h.future.shift();
      return prev;
    });
    setSelectedElId(null);
    setMultiSelectIds([]);
    setHistoryVersion((v) => v + 1);
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    setSlides((cur) => {
      const next = h.future.pop()!;
      h.past.push(cur);
      if (h.past.length > HISTORY_LIMIT) h.past.shift();
      return next;
    });
    setSelectedElId(null);
    setMultiSelectIds([]);
    setHistoryVersion((v) => v + 1);
    setDirty(true);
  }, []);

  const updateActiveSlide = (patch: Partial<Slide>) => {
    mutateSlides((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, ...patch } : s)),
    );
  };

  const updateElement = (elId: string, patch: Partial<SlideElement>) => {
    mutateSlides((prev) =>
      prev.map((s, i) =>
        i === activeIdx
          ? {
              ...s,
              elements: (s.elements ?? []).map((el) =>
                el.id === elId ? ({ ...el, ...patch } as SlideElement) : el,
              ),
            }
          : s,
      ),
    );
  };

  const addSlide = () => {
    mutateSlides((prev) => {
      const next = [...prev];
      next.splice(activeIdx + 1, 0, makeBlankSlide(deckLang));
      return next;
    });
    setActiveIdx((i) => i + 1);
    setSelectedElId(null);
  };

  const duplicateActive = () => {
    if (!activeSlide) return;
    mutateSlides((prev) => {
      const next = [...prev];
      next.splice(activeIdx + 1, 0, duplicateSlide(activeSlide));
      return next;
    });
    setActiveIdx((i) => i + 1);
    setSelectedElId(null);
  };

  const deleteActive = () => {
    if (slides.length <= 1) {
      toast.error(isAr ? "لا يمكن حذف الشريحة الأخيرة" : "Can't delete the last slide");
      return;
    }
    const removedId = slides[activeIdx]?.id;
    mutateSlides((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, i - 1));
    setSelectedElId(null);
    /* Drop the just-deleted slide from the bulk set so the rail
       doesn't keep showing select-mode for a slide that no longer
       exists. */
    if (removedId) {
      setSelectedSlideIds((prev) => {
        if (!prev.has(removedId)) return prev;
        const next = new Set(prev);
        next.delete(removedId);
        return next;
      });
    }
  };

  const moveSlide = (idx: number, delta: -1 | 1) => {
    const j = idx + delta;
    if (j < 0 || j >= slides.length) return;
    mutateSlides((prev) => {
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
    setActiveIdx((cur) => (cur === idx ? j : cur === j ? idx : cur));
  };

  /* DnD reorder — preserves the active selection by id. */
  const onDragEnd = (e: DragEndEvent) => {
    if (readOnlyRef.current) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = slides[activeIdx]?.id;
    mutateSlides((prev) => {
      const from = prev.findIndex((s) => s.id === active.id);
      const to = prev.findIndex((s) => s.id === over.id);
      if (from < 0 || to < 0) return prev;
      const next = arrayMove(prev, from, to);
      if (activeId) {
        const newIdx = next.findIndex((s) => s.id === activeId);
        if (newIdx >= 0) setActiveIdx(newIdx);
      }
      return next;
    });
  };

  /* Element helpers used by the inspector toolbar. */
  const insertElement = (el: SlideElement) => {
    mutateSlides((prev) =>
      prev.map((s, i) =>
        i === activeIdx ? { ...s, elements: [...(s.elements ?? []), el] } : s,
      ),
    );
    setSelectedElId(el.id);
  };

  /* Same as `insertElement` but targets a specific slide index instead
     of the currently-active one. Used by the AI activity-suggestions
     banner to drop an activity onto the suggested slide deterministically,
     without depending on async setActiveIdx state propagation. */
  const insertElementAt = (slideIdx: number, el: SlideElement) => {
    mutateSlides((prev) =>
      prev.map((s, i) =>
        i === slideIdx ? { ...s, elements: [...(s.elements ?? []), el] } : s,
      ),
    );
    setSelectedElId(el.id);
  };

  const duplicateElement = (elId: string) => {
    mutateSlides((prev) =>
      prev.map((s, i) => {
        if (i !== activeIdx) return s;
        const els = s.elements ?? [];
        const src = els.find((x) => x.id === elId);
        if (!src) return s;
        const copy: SlideElement = {
          ...src,
          id: genId(src.kind.charAt(0)),
          x: Math.min(CANVAS_W - src.w, src.x + 24),
          y: Math.min(CANVAS_H - src.h, src.y + 24),
        };
        return { ...s, elements: [...els, copy] };
      }),
    );
  };

  const moveElementZ = (elId: string, dir: "up" | "down" | "top" | "bottom") => {
    mutateSlides((prev) =>
      prev.map((s, i) => {
        if (i !== activeIdx) return s;
        const els = [...(s.elements ?? [])];
        const idx = els.findIndex((x) => x.id === elId);
        if (idx < 0) return s;
        const [it] = els.splice(idx, 1);
        if (dir === "up") els.splice(Math.min(els.length, idx + 1), 0, it);
        else if (dir === "down") els.splice(Math.max(0, idx - 1), 0, it);
        else if (dir === "top") els.push(it);
        else els.unshift(it);
        return { ...s, elements: els };
      }),
    );
  };

  const onPickImage = () => fileInputRef.current?.click();

  /* Insert an image element from a direct URL (used by ImageSearchDialog).
     We skip the upload step — the URL is already public. */
  const insertImageFromUrl = (url: string) => {
    const w = 480;
    const h = 320;
    mutateSlides((prev) =>
      prev.map((s, i) =>
        i === activeIdx
          ? {
              ...s,
              elements: [
                ...(s.elements ?? []),
                {
                  id: genId("i"),
                  kind: "image",
                  x: (CANVAS_W - w) / 2,
                  y: (CANVAS_H - h) / 2,
                  w, h,
                  url,
                  objectFit: "cover",
                } as SlideElement,
              ],
            }
          : s,
      ),
    );
    toast.success(isAr ? "تمت إضافة الصورة" : "Image added");
  };

  const onImageChosen = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(isAr ? "الملف يجب أن يكون صورة" : "Must be an image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isAr ? "الحد الأقصى 10 ميجابايت" : "Max size 10MB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(file);
      if (Number.isFinite(id)) {
        const reg = await registerAsset(id, url, file.size);
        if (!reg.ok && reg.limit) {
          const lim = reg.limit;
          const resName = limitKindLabel(lim.kind, isAr);
          toast.error(
            isAr
              ? `لقد تجاوزت حد ${resName} (${formatLimitValue(lim.kind, lim.current, isAr)} / ${formatLimitValue(lim.kind, lim.limit, isAr)}). رقّ إلى الباقة الاحترافية لإزالة الحدود.`
              : `You've exceeded the ${resName} limit (${formatLimitValue(lim.kind, lim.current, isAr)} / ${formatLimitValue(lim.kind, lim.limit, isAr)}). Upgrade to Pro to remove caps.`,
            { duration: 6000 },
          );
          setShowUpgrade(true);
          queryClient.invalidateQueries({ queryKey: getGetPresentationUsageQueryKey(id) });
          return;
        }
        queryClient.invalidateQueries({ queryKey: getGetPresentationUsageQueryKey(id) });
      }
      // Insert image roughly centered with safe bounds.
      const w = 480;
      const h = 320;
      mutateSlides((prev) =>
        prev.map((s, i) =>
          i === activeIdx
            ? {
                ...s,
                elements: [
                  ...(s.elements ?? []),
                  {
                    id: genId("i"),
                    kind: "image",
                    x: (CANVAS_W - w) / 2,
                    y: (CANVAS_H - h) / 2,
                    w, h,
                    url,
                  } as SlideElement,
                ],
              }
            : s,
        ),
      );
      toast.success(isAr ? "تمت إضافة الصورة" : "Image added");
    } catch {
      toast.error(isAr ? "تعذّر رفع الصورة" : "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeElement = (elId: string) => {
    mutateSlides((prev) =>
      prev.map((s, i) =>
        i === activeIdx
          ? { ...s, elements: (s.elements ?? []).filter((el) => el.id !== elId) }
          : s,
      ),
    );
    setSelectedElId(null);
  };

  /* Bulk-remove every id in `ids` from the active slide. Used by
     Delete/Backspace when more than one element is selected. */
  const removeElements = (ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    mutateSlides((prev) =>
      prev.map((s, i) =>
        i === activeIdx
          ? { ...s, elements: (s.elements ?? []).filter((el) => !set.has(el.id)) }
          : s,
      ),
    );
    setSelectedElId(null);
    setMultiSelectIds([]);
  };

  /* Bulk slide ops, driven by the slide-rail "select" mode. */
  const removeSlides = (ids: Set<string>) => {
    if (ids.size === 0) return;
    if (ids.size >= slides.length) {
      toast.error(isAr ? "لا يمكن حذف كل الشرائح" : "Can't delete every slide");
      return;
    }
    const activeId = slides[activeIdx]?.id;
    mutateSlides((prev) => prev.filter((s) => !ids.has(s.id)));
    /* Re-anchor active to the previous slide (or first remaining). */
    setActiveIdx((cur) => {
      const remaining = slides.filter((s) => !ids.has(s.id));
      const stillThere = activeId && !ids.has(activeId)
        ? remaining.findIndex((s) => s.id === activeId)
        : -1;
      if (stillThere >= 0) return stillThere;
      return Math.max(0, Math.min(cur, remaining.length - 1));
    });
    setSelectedElId(null);
    setMultiSelectIds([]);
    setSelectedSlideIds(new Set());
  };

  const duplicateSlides = (ids: Set<string>) => {
    if (ids.size === 0) return;
    mutateSlides((prev) => {
      const next: Slide[] = [];
      for (const s of prev) {
        next.push(s);
        if (ids.has(s.id)) next.push(duplicateSlide(s));
      }
      return next;
    });
    setSelectedSlideIds(new Set());
  };

  const saveNow = () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    persist(slides);
  };

  /* Derive read-only flag BEFORE any early return so the useEffect
     below sits above the loading/error guards — moving the early
     returns past this hook used to crash the editor with
     "Rendered more hooks than during the previous render" the
     moment the deck finished loading (Rules of Hooks violation). */
  const isOwner = data?.isOwner !== false;
  const readOnly = !isOwner;
  readOnlyRef.current = readOnly;

  /* Editor-wide keyboard shortcuts:
       Ctrl/⌘+Z         → undo
       Ctrl/⌘+Y         → redo
       Ctrl/⌘+Shift+Z   → redo
       Ctrl/⌘+A         → select every element on the active slide
                          (NOT the browser's "select all text" — we
                          preventDefault so editing feels like Canva,
                          not a web page).
     We deliberately ignore the shortcut when focus is inside an
     <input>, <textarea> or contentEditable so authors can still
     Ctrl+A inside a text element to pick the contents. */
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      /* Don't fight modal focus traps. If a Radix dialog/dropdown/sheet
         is open, or someone above us has already handled the key,
         leave it alone — otherwise Ctrl+Z behind a Preview/Activity
         picker can mutate slides invisibly. */
      if (e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      const tgt = e.target as HTMLElement | null;
      const inField =
        tgt && (tgt.tagName === "INPUT"
          || tgt.tagName === "TEXTAREA"
          || tgt.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        if (inField) return;
        e.preventDefault();
        undo();
        return;
      }
      if ((k === "z" && e.shiftKey) || k === "y") {
        if (inField) return;
        e.preventDefault();
        redo();
        return;
      }
      if (k === "a") {
        if (inField) return;
        const els = activeSlide?.elements ?? [];
        if (els.length === 0) return;
        e.preventDefault();
        const ids = els.map((el) => el.id);
        setSelectedElId(ids[0]);
        setMultiSelectIds(ids.slice(1));
        return;
      }
      if (k === "d") {
        if (inField) return;
        e.preventDefault();
        duplicateActive();
        return;
      }
      if (k === "s") {
        e.preventDefault();
        saveNow();
        return;
      }
      if (k === "/") {
        if (inField) return;
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, undo, redo, activeSlide, duplicateActive, saveNow]);

  /* Loading / error guards live AFTER every hook so the hook count
     stays identical between the loading render and the loaded render
     — this is what fixed the "white editor page" bug (React was
     bailing the whole tree out with a Rules-of-Hooks violation). */
  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Layout>
    );
  }
  if (error || !data) {
    return (
      <Layout>
        <div className="text-center py-16 text-muted-foreground" dir={dir}>
          {isAr ? "تعذّر تحميل العرض" : "Failed to load presentation"}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative flex flex-col h-[calc(100vh-64px)]" dir={dir}>
        {/* Toolbar — desktop / large tablet only. The mobile shell
            below renders its own compact 52px top bar instead. */}
        {!isMobile && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border bg-white/80 backdrop-blur-md shadow-sm relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (dirty) { setLeaveDialogOpen(true); return; }
                setLocation("/teacher/presentations");
              }}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={isAr ? "العودة" : "Back"}
            >
              <Back className="w-4 h-4" />
            </button>
            {/* Quick Mode shortcut — lets teachers jump straight to a new
                Quick Mode session without going through the list page. */}
            <button
              onClick={() => setLocation("/teacher/presentations/new")}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors hover:bg-amber-100/80 active:scale-95"
              style={{ color: "#92570a", background: "rgba(251,191,36,0.12)" }}
              title={isAr ? "إنشاء عرض سريع جديد" : "Create a new Quick Mode deck"}
            >
              ⚡ {isAr ? "وضع سريع" : "Quick Mode"}
            </button>
            <div className="min-w-0 flex flex-col">
              <h1 className="text-base sm:text-lg font-bold truncate flex items-center gap-2 tracking-tight" style={{ color: BRAND_GREEN }}>
                {data.title}
                {/* Pro Studio identity badge — always visible so teachers
                    know they are in the advanced editor, not Quick Mode. */}
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold shrink-0 select-none"
                  style={{
                    background: `${BRAND_GREEN}18`,
                    color: BRAND_GREEN,
                    border: `1px solid ${BRAND_GREEN}35`,
                  }}
                >
                  🎛 Pro Studio
                </span>
                {tier && !tier.isPro && (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    title={isAr ? "ترقية إلى الباقة الاحترافية" : "Upgrade to Pro"}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black transition-transform hover:scale-105"
                    style={{ background: `${BRAND_GOLD}1a`, color: BRAND_GREEN, border: `1px solid ${BRAND_GOLD}40` }}
                  >
                    <Lock className="w-3 h-3" />
                    {isAr ? "مجاني" : "Free"}
                  </button>
                )}
              </h1>
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap font-medium">
                <SaveStatus
                  dirty={dirty}
                  savedAt={savedAt}
                  saving={updateMutation.isPending}
                  isAr={isAr}
                />
                {tier && (
                  <>
                    <span className="opacity-40">•</span>
                    <UsageStrip tier={tier} isAr={isAr} onUpgrade={() => setShowUpgrade(true)} />
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Deck language toggle */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs bg-muted/20">
              {(["ar", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    if (readOnly || deckLang === l) return;
                    updateMutation.mutate(
                      { id, data: { language: l } },
                      {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: getGetPresentationQueryKey(id) });
                        },
                      },
                    );
                  }}
                  disabled={readOnly}
                  className="px-3 py-1.5 font-bold transition-all duration-200"
                  style={{
                    background: deckLang === l ? BRAND_GREEN : "transparent",
                    color: deckLang === l ? "white" : "inherit",
                  }}
                  title={l === "ar" ? "العربية (RTL)" : "English (LTR)"}
                >
                  {l === "ar" ? "ع" : "EN"}
                </button>
              ))}
            </div>
            
            {/* Action buttons - hidden text on mobile */}
            {Number.isFinite(id) && !readOnly && (
              <LinkedActivitySelector presentationId={id} isAr={isAr} disabled={readOnly} />
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setAiBuilderOpen(true)}
              disabled={readOnly}
              className="h-9 gap-2 rounded-lg font-semibold transition-colors"
              title={isAr ? "اقترح خطة من الذكاء" : "Suggest an AI outline"}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#225739" }} />
              <span className="hidden lg:inline">{isAr ? "اقترح خطة" : "AI outline"}</span>
            </Button>

            {/* Undo / Redo — small icon-only pair, sits with the rest of
                the secondary toolbar so it never competes with the
                primary "Present" button visually. Tooltip shows the
                shortcut so teachers learn it without any onboarding. */}
            <div className="hidden md:flex items-center rounded-lg border border-border overflow-hidden bg-muted/20" aria-label={isAr ? "تراجع/إعادة" : "Undo / Redo"}>
              <button
                type="button"
                onClick={undo}
                disabled={readOnly || !canUndo}
                className="px-2.5 h-9 flex items-center text-muted-foreground hover:text-emerald-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors"
                title={isAr ? "تراجع (Ctrl+Z)" : "Undo (Ctrl+Z)"}
                aria-label={isAr ? "تراجع" : "Undo"}
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-border" aria-hidden />
              <button
                type="button"
                onClick={redo}
                disabled={readOnly || !canRedo}
                className="px-2.5 h-9 flex items-center text-muted-foreground hover:text-emerald-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors"
                title={isAr ? "إعادة (Ctrl+Shift+Z)" : "Redo (Ctrl+Shift+Z)"}
                aria-label={isAr ? "إعادة" : "Redo"}
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={saveNow}
              disabled={!dirty || readOnly || updateMutation.isPending}
              className="h-9 gap-2 rounded-lg font-semibold transition-colors"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? "حفظ" : "Save"}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9 gap-2 rounded-lg font-semibold transition-colors" title={isAr ? "تصدير" : "Export"}>
                  <Download className="w-4 h-4" />
                  <span className="hidden lg:inline">{isAr ? "تصدير" : "Export"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isAr ? "start" : "end"} className="rounded-xl shadow-lg border-border/50">
                <DropdownMenuItem
                  onClick={async () => {
                    const tid = toast.loading(isAr ? "جارٍ تجهيز PDF…" : "Preparing PDF…");
                    try {
                      const res = await fetch(`/api/presentations/${id}/export/pdf`, {
                        method: "POST",
                        credentials: "include",
                      });
                      if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        throw new Error(j?.message || `HTTP ${res.status}`);
                      }
                      const blob = await res.blob();
                      const cd = res.headers.get("Content-Disposition") || "";
                      const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
                      const filename = m ? decodeURIComponent(m[1]) : `presentation-${id}.pdf`;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = filename;
                      document.body.appendChild(a); a.click(); a.remove();
                      URL.revokeObjectURL(url);
                      toast.success(isAr ? "تم التصدير" : "Exported", { id: tid });
                    } catch (e) {
                      toast.error(
                        isAr ? "تعذّر التصدير" : "Export failed",
                        { id: tid, description: (e as Error).message },
                      );
                    }
                  }}
                  className="gap-2 rounded-md font-medium"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {isAr ? "PDF" : "PDF"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    const tid = toast.loading(isAr ? "جارٍ تجهيز PPTX…" : "Preparing PPTX…");
                    try {
                      const res = await fetch(`/api/presentations/${id}/export/pptx`, {
                        method: "POST",
                        credentials: "include",
                      });
                      if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        throw new Error(j?.message || `HTTP ${res.status}`);
                      }
                      const blob = await res.blob();
                      const cd = res.headers.get("Content-Disposition") || "";
                      const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
                      const filename = m ? decodeURIComponent(m[1]) : `presentation-${id}.pptx`;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                      toast.success(isAr ? "تم التصدير" : "Exported", { id: tid });
                    } catch (e) {
                      toast.error(
                        isAr ? "تعذّر التصدير" : "Export failed",
                        { id: tid, description: (e as Error).message },
                      );
                    }
                  }}
                  className="gap-2 rounded-md font-medium"
                >
                  <PresentationIcon className="w-4 h-4 text-muted-foreground" />
                  {isAr ? "PPTX (PowerPoint)" : "PPTX (PowerPoint)"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewIdx(activeIdx)}
              className="h-9 gap-2 rounded-lg font-semibold transition-colors hidden sm:flex"
              title={isAr ? "معاينة" : "Preview"}
            >
              <Eye className="w-4 h-4" />
              <span className="hidden lg:inline">{isAr ? "معاينة" : "Preview"}</span>
            </Button>

            {/* Present split-button — primary action on the left, slide-anchored
                start on the right. Uses shadcn Button so size, focus ring, and
                disabled states stay consistent with the rest of the toolbar. */}
            <div className="flex items-center rounded-lg overflow-hidden shadow-sm shadow-emerald-900/20">
              <Button
                size="sm"
                onClick={() => {
                  window.open(`/teacher/presentations/${id}/present?slide=1`, "_blank", "noopener");
                }}
                className="h-9 px-4 sm:px-5 gap-2 rounded-none font-bold border-0 bg-[#225739] text-white hover:brightness-110"
                title={isAr ? "ابدأ من البداية" : "Start from beginning"}
              >
                <Play className="w-4 h-4 fill-white" />
                <span className="hidden sm:inline">{isAr ? "ابدأ العرض" : "Present"}</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  window.open(
                    `/teacher/presentations/${id}/present?slide=${activeIdx + 1}`,
                    "_blank", "noopener",
                  );
                }}
                className="h-9 px-2 sm:px-3 rounded-none border-0 border-s border-emerald-800/40 font-bold bg-[#225739] text-white hover:brightness-110"
                title={isAr ? "ابدأ من الشريحة الحالية" : "Start from current slide"}
              >
                <span className="font-mono opacity-90 text-xs">@{activeIdx + 1}</span>
              </Button>
            </div>
            {/* Presentations 2B — Live MVP launcher. Creates a session
                with a fresh PIN and opens the teacher control panel.
                Brand-gold to stand out as the primary live CTA. */}
            <Button
              size="sm"
              onClick={() => setGoLiveOpen({ mode: "newTab" })}
              className="h-9 px-3 sm:px-4 gap-2 rounded-lg font-bold shadow-sm border-0 bg-[#D9A521] text-[#1c1003] hover:brightness-110"
              title={isAr ? "بدء عرض مباشر بـ PIN للطلاب" : "Start live session"}
            >
              <Radio className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? "بدء مباشر" : "Go Live"}</span>
            </Button>
            {/* Single Sessions entry point — replaces the previous separate
                "Past results" and "Compare" toolbar buttons. Compare is one
                click away from the Sessions page header. */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/teacher/presentations/${id}/sessions`, "_blank", "noopener")}
              className="h-9 gap-2 rounded-lg font-semibold transition-colors"
              title={isAr ? "الجلسات والنتائج" : "Sessions & results"}
            >
              <History className="w-4 h-4" />
              <span className="hidden lg:inline">{isAr ? "الجلسات" : "Sessions"}</span>
            </Button>
            {/* Keyboard shortcuts help button */}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black text-muted-foreground border border-border hover:border-emerald-600/40 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors select-none"
              title={isAr ? "اختصارات لوحة المفاتيح (Ctrl+/)" : "Keyboard shortcuts (Ctrl+/)"}
              aria-label={isAr ? "اختصارات لوحة المفاتيح" : "Keyboard shortcuts"}
            >
              ?
            </button>
          </div>
        </div>
        )}

        {/* Preview modal — constrained, non-fullscreen, light controls. */}
        <UpgradeDialog
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          isAr={isAr}
          tier={tier}
        />

        {goLiveOpen && (
          <GoLiveDialog
            isAr={isAr}
            mode={goLiveOpen.mode}
            onClose={() => setGoLiveOpen(null)}
            onConfirm={async (targetClass, sessionMode) => {
              try {
                const r = await fetch(`/api/presentations/${id}/sessions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ targetClass: targetClass || null, sessionMode }),
                });
                if (!r.ok) {
                  const j = await r.json().catch(() => ({}));
                  toast.error(j?.message ?? (isAr ? "تعذّر بدء الجلسة" : "Failed to start live session"));
                  return;
                }
                const j = await r.json();
                const url = `/p/control/${j.sessionId}`;
                if (goLiveOpen.mode === "newTab") {
                  window.open(url, "_blank", "noopener");
                } else {
                  window.location.href = url;
                }
                setGoLiveOpen(null);
              } catch {
                toast.error(isAr ? "خطأ في الشبكة" : "Network error");
              }
            }}
          />
        )}

        {previewIdx !== null && activeSlide && (
          <PreviewModal
            slides={slides}
            startIdx={previewIdx}
            theme={theme}
            pattern={pattern}
            isAr={isAr}
            onClose={() => setPreviewIdx(null)}
          />
        )}

        {/* Workbench — desktop / large tablet only. */}
        {!isMobile && (
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[240px_1fr_320px] gap-0">
          {/* Slide rail */}
          <aside className="border-b lg:border-b-0 lg:border-e border-border bg-[#fcfcfc] overflow-x-auto lg:overflow-y-auto p-4 lg:p-5 flex flex-row lg:flex-col gap-4 shadow-[inset_-10px_0_15px_-15px_rgba(0,0,0,0.05)] z-0">
            <div className="flex items-center gap-2 lg:mb-2 shrink-0">
              <Button
                size="sm"
                onClick={() => setSmartAddOpen(true)}
                disabled={readOnly}
                className="flex-1 gap-2 rounded-lg font-bold shadow-sm shadow-emerald-900/10 hover:shadow-md transition-all active:scale-[0.98]"
                style={{ background: BRAND_GREEN, color: "white" }}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden lg:inline">{isAr ? "شريحة جديدة" : "New Slide"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={duplicateActive}
                disabled={readOnly || !activeSlide}
                className="rounded-lg px-2 text-muted-foreground hover:text-foreground"
                title={isAr ? "تكرار" : "Duplicate"}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={deleteActive}
                disabled={readOnly || slides.length <= 1}
                className="rounded-lg px-2 text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                title={isAr ? "حذف" : "Delete"}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {/* Quick-action toolbar — desktop only (left rail is hidden on mobile). */}
            {!readOnly && (
              <div className="hidden lg:block mb-1 shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {isAr ? "أنشطة" : "Activities"}
                </p>
                <div className="grid grid-cols-5 gap-1">
                  {([
                    { kind: "word_cloud" as const, Icon: Cloud,          labelAr: "سحابة", labelEn: "Cloud" },
                    { kind: "open_wall"  as const, Icon: MessageSquare,  labelAr: "جدار",  labelEn: "Wall"  },
                    { kind: "mcq"        as const, Icon: HelpCircle,     labelAr: "MCQ",   labelEn: "MCQ"   },
                    { kind: "true_false" as const, Icon: CheckCircle2,   labelAr: "صح/خطأ",labelEn: "T/F"   },
                    { kind: "poll"       as const, Icon: BarChart2,      labelAr: "تصويت", labelEn: "Poll"  },
                  ]).map(({ kind, Icon, labelAr, labelEn }) => (
                    <button
                      key={kind}
                      type="button"
                      title={isAr ? labelAr : labelEn}
                      onClick={() => {
                        setPickerInitial({ kind });
                        setPendingSuggestionKey(null);
                        setActivityPickerOpen(true);
                      }}
                      className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-0.5 hover:bg-emerald-50 hover:text-emerald-700 text-muted-foreground transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[9px] font-bold leading-none">{isAr ? labelAr : labelEn}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mt-2.5 mb-1.5">
                  {isAr ? "محتوى" : "Content"}
                </p>
                <div className="grid grid-cols-5 gap-1">
                  <button
                    type="button"
                    title={isAr ? "رفع صورة" : "Upload image"}
                    onClick={onPickImage}
                    className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-0.5 hover:bg-emerald-50 hover:text-emerald-700 text-muted-foreground transition-colors"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span className="text-[9px] font-bold leading-none">{isAr ? "صورة" : "Image"}</span>
                  </button>
                  <button
                    type="button"
                    title={isAr ? "بحث عن صور" : "Search images"}
                    onClick={() => setImageSearchOpen(true)}
                    className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-0.5 hover:bg-emerald-50 hover:text-emerald-700 text-muted-foreground transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    <span className="text-[9px] font-bold leading-none">{isAr ? "بحث" : "Search"}</span>
                  </button>
                  <button
                    type="button"
                    title={isAr ? "مكتبة GIF" : "GIF library"}
                    onClick={() => { setSelectedElId(null); setGifLibraryOpen(true); }}
                    className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-0.5 hover:bg-emerald-50 hover:text-emerald-700 text-muted-foreground transition-colors"
                  >
                    <Film className="w-4 h-4" />
                    <span className="text-[9px] font-bold leading-none">GIF</span>
                  </button>
                  <button
                    type="button"
                    title={isAr ? "تضمين فيديو" : "Embed video"}
                    onClick={() => setVideoEmbedDialogOpen(true)}
                    className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-0.5 hover:bg-emerald-50 hover:text-emerald-700 text-muted-foreground transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    <span className="text-[9px] font-bold leading-none">{isAr ? "فيديو" : "Video"}</span>
                  </button>
                  <button
                    type="button"
                    title={isAr ? "إضافة نص" : "Add text"}
                    onClick={() => insertElement({
                      id: genId("t"), kind: "text",
                      x: 100, y: 100, w: 800, h: 120,
                      text: isAr ? "نص جديد" : "New text",
                      fontSize: 32, align: "start",
                      fontWeight: "700",
                    } as SlideElement)}
                    className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-0.5 hover:bg-emerald-50 hover:text-emerald-700 text-muted-foreground transition-colors"
                  >
                    <TypeIcon className="w-4 h-4" />
                    <span className="text-[9px] font-bold leading-none">{isAr ? "نص" : "Text"}</span>
                  </button>
                </div>
                <div className="mt-2.5 border-t border-border/60" />
              </div>
            )}
            {/* Slide bulk-selection row — only renders when at least one
                slide is in the bulk set, OR shows a tiny "select all"
                chip otherwise. Stays out of the way visually. */}
            <div className="flex items-center gap-2 shrink-0 -mt-2">
              {selectedSlideIds.size === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (readOnly) return;
                    setSelectedSlideIds(new Set(slides.map((s) => s.id)));
                  }}
                  disabled={readOnly || slides.length === 0}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-emerald-700 disabled:opacity-40 transition-colors"
                  title={isAr ? "تحديد كل الشرائح" : "Select all slides"}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {isAr ? "تحديد الكل" : "Select all"}
                </button>
              ) : (
                <div
                  className="flex items-center gap-1 w-full rounded-lg px-2 py-1.5 shadow-sm"
                  style={{
                    background: `${BRAND_GREEN}0d`,
                    border: `1px solid ${BRAND_GREEN}33`,
                  }}
                >
                  <span className="text-[11px] font-bold" style={{ color: BRAND_GREEN }}>
                    {selectedSlideIds.size}
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden lg:inline">
                    {isAr ? "محدّدة" : "selected"}
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => duplicateSlides(selectedSlideIds)}
                    disabled={readOnly}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                    title={isAr ? "تكرار المحدد" : "Duplicate selected"}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlides(selectedSlideIds)}
                    disabled={readOnly}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title={isAr ? "حذف المحدد" : "Delete selected"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSlideIds(new Set())}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/70 transition-colors"
                    title={isAr ? "إلغاء التحديد" : "Clear"}
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={slides.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-row lg:flex-col gap-3 min-w-max lg:min-w-0 pb-2 lg:pb-0">
                  {slides.map((s, i) => (
                    <SortableSlideItem
                      key={s.id}
                      slide={s}
                      index={i}
                      active={i === activeIdx}
                      multi={selectedSlideIds.has(s.id)}
                      selectMode={selectedSlideIds.size > 0}
                      readOnly={readOnly}
                      isAr={isAr}
                      isLast={i === slides.length - 1}
                      theme={theme}
                      pattern={pattern}
                      onSelect={() => {
                        setActiveIdx(i);
                        setSelectedElId(null);
                        setMultiSelectIds([]);
                      }}
                      onToggleMulti={() => {
                        setSelectedSlideIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                      onMoveUp={() => moveSlide(i, -1)}
                      onMoveDown={() => moveSlide(i, 1)}
                    />
                  ))}
                  {slides.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground font-medium bg-white rounded-xl border border-dashed">
                      {isAr ? "لا توجد شرائح" : "No slides"}
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </aside>

          {/* Canvas */}
          <main
            className="flex-1 overflow-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-5 flex flex-col items-center justify-center relative min-h-[50vh] lg:min-h-0"
            style={{
              backgroundColor: '#eaeef3',
              backgroundImage: 'radial-gradient(circle at center, #c2cad6 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            {Number.isFinite(draftIdFromUrl) && (
              <div className="w-full max-w-5xl">
                <ActivitySuggestionsBanner
                  draftId={draftIdFromUrl}
                  isAr={isAr}
                  onJumpToSlide={(idx) => {
                    if (idx >= 0 && idx < slides.length) {
                      setActiveIdx(idx);
                      setSelectedElId(null);
                    }
                  }}
                  externallyDismissed={dismissedSuggestionKeys}
                  onAcceptSuggestion={(s, mode) => {
                    const target = s.outlineIndex - 1;
                    if (target < 0 || target >= slides.length) return;
                    /* Map outline hint -> activity kind. Hints like
                       "discussion" map cleanly to an open answer with
                       no further authoring needed; quiz/poll need
                       options so we route them through the picker. */
                    const hintKind = s.kind;
                    const activityKind: "mcq" | "open" | "poll" =
                      hintKind === "poll" ? "poll"
                      : hintKind === "quiz" ? "mcq"
                      : "open";
                    const seedPrompt = (s.title ?? "").trim().slice(0, 2000);
                    if (mode === "quick") {
                      /* High-confidence path: build the activity element
                         and drop it on the SUGGESTED slide directly
                         (do not depend on async setActiveIdx state). */
                      const newId = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
                      const el = {
                        id: newId,
                        kind: "activity",
                        activityKind,
                        prompt: seedPrompt,
                        options: activityKind === "open" ? undefined : ["", ""],
                        correctIndex: activityKind === "mcq" ? 0 : undefined,
                        x: 140, y: 120, w: 1000, h: 480,
                      } as SlideElement;
                      insertElementAt(target, el);
                      setActiveIdx(target);
                      /* Insertion succeeded — dismiss the chip via
                         the parent-owned dismissed set. */
                      setDismissedSuggestionKeys((prev) => {
                        const next = new Set(prev);
                        next.add(s.outlineIndex);
                        return next;
                      });
                      return;
                    }
                    /* Picker path: focus the target slide so the
                       picker's eventual onPick lands there, remember
                       the suggestion key so we can dismiss the chip
                       only on successful insertion (not on cancel). */
                    setActiveIdx(target);
                    setSelectedElId(null);
                    setPendingSuggestionKey(s.outlineIndex);
                    setPickerInitial({ prompt: seedPrompt, kind: activityKind });
                    setActivityPickerOpen(true);
                  }}
                />
              </div>
            )}
            {activeSlide ? (
              <div className="flex flex-col items-center gap-3 transition-all w-full max-w-full">
                <SlideCanvas
                  slide={activeSlide}
                  isAr={isAr}
                  readOnly={readOnly}
                  selectedElId={selectedElId}
                  multiSelectIds={multiSelectIds}
                  onSelectEl={(id) => { setSelectedElId(id); setMultiSelectIds([]); setGifLibraryOpen(false); }}
                  onToggleMultiSelect={(id) => {
                    /* Shift/Ctrl-click toggles a secondary selection.
                       The first click promotes the existing primary
                       into the multi-set, then either adds or removes
                       the new id. */
                    setMultiSelectIds((prev) => {
                      const set = new Set(prev);
                      if (selectedElId && selectedElId !== id) set.add(selectedElId);
                      if (set.has(id)) {
                        set.delete(id);
                        return Array.from(set);
                      }
                      if (selectedElId === id) return prev;
                      set.add(id);
                      return Array.from(set);
                    });
                    if (selectedElId !== id) setSelectedElId(id);
                  }}
                  onUpdateEl={updateElement}
                  onRemoveEl={removeElement}
                  onRemoveMany={removeElements}
                  theme={theme}
                  pattern={pattern}
                />
                <div className="text-[11px] font-medium text-slate-500 bg-white/70 px-3 py-1 rounded-full ring-1 ring-slate-200/70 backdrop-blur-sm tracking-wide">
                  16:9 · {isAr ? `شريحة ${activeIdx + 1} من ${slides.length}` : `Slide ${activeIdx + 1} of ${slides.length}`}
                </div>
              </div>
            ) : null}
          </main>

          {/* Inspector */}
          <aside className="border-t lg:border-t-0 lg:border-s border-border bg-white overflow-y-auto z-10 shadow-[inset_10px_0_15px_-15px_rgba(0,0,0,0.02)]">
            <div className="px-6 py-5">
              <Inspector
                isAr={isAr}
                readOnly={readOnly}
                slide={activeSlide}
                selectedEl={selectedEl}
                theme={theme}
                pattern={pattern}
                onChangeTheme={onChangeTheme}
                onChangePattern={onChangePattern}
                onUpdateSlide={updateActiveSlide}
                onUpdateEl={(patch) => selectedEl && updateElement(selectedEl.id, patch)}
                onRemoveEl={() => selectedEl && removeElement(selectedEl.id)}
                onDuplicateEl={() => selectedEl && duplicateElement(selectedEl.id)}
                onMoveZ={(dir) => selectedEl && moveElementZ(selectedEl.id, dir)}
                onPickImage={onPickImage}
                onInsertElement={insertElement}
                onOpenActivityPicker={() => {
                  setPickerInitial({});
                  setPendingSuggestionKey(null);
                  setActivityPickerOpen(true);
                }}
                onOpenVideoEmbedDialog={() => setVideoEmbedDialogOpen(true)}
                onOpenImageSearch={() => setImageSearchOpen(true)}
                uploading={uploading}
                onDeselect={() => setSelectedElId(null)}
                gifLibraryOpen={gifLibraryOpen}
                setGifLibraryOpen={setGifLibraryOpen}
              />
            </div>
          </aside>
        </div>
        )}

        {/* ── Canva-style mobile / tablet shell (<1024px). Layered as
            an absolute overlay inside the same flex container so the
            shared dialogs (preview, leave, upgrade, activity picker,
            file input) keep working without duplication. */}
        {isMobile && (
          <MobileShell
            isAr={isAr}
            dir={dir}
            readOnly={readOnly}
            title={data.title ?? ""}
            tier={tier}
            saving={updateMutation.isPending}
            dirty={dirty}
            savedAt={savedAt}
            slides={slides}
            activeIdx={activeIdx}
            activeSlide={activeSlide}
            selectedElId={selectedElId}
            selectedEl={selectedEl}
            theme={theme}
            pattern={pattern}
            uploading={uploading}
            sheet={mobileSheet}
            setSheet={setMobileSheet}
            onSelectSlide={(i) => { setActiveIdx(i); setSelectedElId(null); }}
            onSelectEl={setSelectedElId}
            onUpdateEl={updateElement}
            onUpdateActiveSlide={updateActiveSlide}
            onRemoveEl={(id) => removeElement(id)}
            onDuplicateEl={(id) => duplicateElement(id)}
            onMoveZ={(id, d) => moveElementZ(id, d)}
            onAddSlide={() => setSmartAddOpen(true)}
            onDuplicateSlide={duplicateActive}
            onDeleteSlide={deleteActive}
            onMoveSlide={(delta) => moveSlide(activeIdx, delta)}
            onChangeTheme={onChangeTheme}
            onChangePattern={onChangePattern}
            onPickImage={onPickImage}
            onInsertElement={insertElement}
            onOpenActivityPicker={() => setActivityPickerOpen(true)}
            onOpenVideoEmbedDialog={() => setVideoEmbedDialogOpen(true)}
            onOpenImageSearch={() => setImageSearchOpen(true)}
            onOpenPreview={() => setPreviewIdx(activeIdx)}
            onPresent={(fromCurrent) => {
              /* Mobile browsers block `window.open` for non-direct
                 user gestures (and especially after any async work),
                 so on the mobile shell we navigate the same tab
                 instead — that always works. The deep-link via
                 ?slide=N preserves "start from current slide". */
              const slideNum = fromCurrent ? activeIdx + 1 : 1;
              window.location.href = `/teacher/presentations/${id}/present?slide=${slideNum}`;
            }}
            onSaveNow={saveNow}
            onOpenAiBuilder={() => setAiBuilderOpen(true)}
            onOpenSessions={() => { window.location.href = `/teacher/presentations/${id}/sessions`; }}
            onGoLive={() => setGoLiveOpen({ mode: "sameTab" })}
            onExport={async (kind) => {
              const tid = toast.loading(isAr ? `جارٍ تجهيز ${kind.toUpperCase()}…` : `Preparing ${kind.toUpperCase()}…`);
              try {
                const res = await fetch(`/api/presentations/${id}/export/${kind}`, {
                  method: "POST",
                  credentials: "include",
                });
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}));
                  throw new Error(j?.message || `HTTP ${res.status}`);
                }
                const blob = await res.blob();
                const cd = res.headers.get("Content-Disposition") || "";
                const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
                const filename = m ? decodeURIComponent(m[1]) : `presentation-${id}.${kind}`;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = filename;
                document.body.appendChild(a); a.click(); a.remove();
                URL.revokeObjectURL(url);
                toast.success(isAr ? "تم التصدير" : "Exported", { id: tid });
              } catch (e) {
                toast.error(isAr ? "تعذّر التصدير" : "Export failed", { id: tid, description: (e as Error).message });
              }
            }}
            onBack={() => {
              if (dirty) { setLeaveDialogOpen(true); return; }
              setLocation("/teacher/presentations");
            }}
            onUpgrade={() => setShowUpgrade(true)}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onImageChosen(e.target.files?.[0])}
        />

        {/* AI outline builder — mounted at the shared-dialog level so
            it works from both the desktop top-bar button and the
            mobile More menu. (It used to live inside the desktop-only
            branch, which made the mobile "اقترح خطة" button silently
            no-op: state flipped to open but no dialog was mounted.) */}
        <AiPresentationBuilder open={aiBuilderOpen} onOpenChange={setAiBuilderOpen} />

        {/* Smart Add Slide — kind picker + AI generator, shared between
            desktop rail button and mobile shell add button so a single
            state drives both entry points. */}
        <VideoEmbedDialog
          open={videoEmbedDialogOpen}
          onClose={() => setVideoEmbedDialogOpen(false)}
          onInsert={(el) => {
            insertElement(el);
            setVideoEmbedDialogOpen(false);
          }}
          isAr={isAr}
        />

        <ImageSearchDialog
          open={imageSearchOpen}
          onClose={() => setImageSearchOpen(false)}
          onInsert={(url) => {
            insertImageFromUrl(url);
            setImageSearchOpen(false);
          }}
          isAr={isAr}
        />

        {Number.isFinite(id) && (
          <SmartAddSlideDialog
            open={smartAddOpen}
            onClose={() => setSmartAddOpen(false)}
            onInsert={(slide) => {
              mutateSlides((prev) => {
                const next = [...prev];
                next.splice(activeIdx + 1, 0, slide as Slide);
                return next;
              });
              setActiveIdx((i) => i + 1);
              setSelectedElId(null);
            }}
            onBlank={addSlide}
            presentationId={id}
            isAr={isAr}
            deckTitle={data?.title ?? ""}
            theme={theme}
          />
        )}

        <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
          <AlertDialogContent dir={dir}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isAr ? "لديك تغييرات غير محفوظة" : "You have unsaved changes"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isAr
                  ? "إذا غادرت الآن ستفقد التغييرات التي لم يتم حفظها بعد."
                  : "If you leave now, your unsaved edits will be lost."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isAr ? "البقاء" : "Stay"}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setLeaveDialogOpen(false);
                  setLocation("/teacher/presentations");
                }}
                style={{ background: BRAND_GREEN, color: "white" }}
              >
                {isAr ? "مغادرة بدون حفظ" : "Leave without saving"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {showShortcuts && (
          <KeyboardShortcutsPanel isAr={isAr} onClose={() => setShowShortcuts(false)} />
        )}

        <ActivityPickerDialog
          open={activityPickerOpen}
          onClose={() => {
            /* Cancel/close: clear seed + pending suggestion key so
               the chip stays on the banner (insertion didn't happen). */
            setActivityPickerOpen(false);
            setPickerInitial({});
            setPendingSuggestionKey(null);
          }}
          isAr={isAr}
          currentSlide={activeSlide}
          initialPrompt={pickerInitial.prompt}
          initialKind={pickerInitial.kind}
          onPick={({ element, saveToBank, replaceElementId }) => {
            /* Convert flow asks the editor to remove the source text
               element first so the activity replaces it instead of
               stacking on top. */
            if (replaceElementId) {
              mutateSlides((prev) =>
                prev.map((s, i) =>
                  i === activeIdx
                    ? { ...s, elements: (s.elements ?? []).filter((e) => e.id !== replaceElementId) }
                    : s,
                ),
              );
            }
            insertElement(element);
            /* Insertion succeeded — promote the pending suggestion key
               into the dismissed set so the banner chip is removed. */
            if (pendingSuggestionKey != null) {
              const key = pendingSuggestionKey;
              setDismissedSuggestionKeys((prev) => {
                const next = new Set(prev);
                next.add(key);
                return next;
              });
              setPendingSuggestionKey(null);
            }
            /* Optional: also persist this composed question into the
               teacher's question bank so it can be reused. We fire
               and forget — slide insert succeeds either way. */
            if (saveToBank && element.kind === "activity" && element.prompt) {
              const opts = element.options ?? [];
              const correctLetter = typeof element.correctIndex === "number"
                ? String.fromCharCode(65 + element.correctIndex)
                : null;
              fetch("/api/question-bank", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  /* The bank schema requires `subject`; we don't ask the
                     teacher for one inside the slide editor, so we use a
                     neutral default ("عام" / "General") matching the
                     deck language. */
                  subject: deckLang === "en" ? "General" : "عام",
                  text: element.prompt,
                  questionType: element.activityKind === "true_false"
                    ? "true_false"
                    : element.activityKind === "open" || element.activityKind === "poll"
                      ? "open"
                      : "mcq",
                  optionA: opts[0] ?? null,
                  optionB: opts[1] ?? null,
                  optionC: opts[2] ?? null,
                  optionD: opts[3] ?? null,
                  correctAnswer: correctLetter,
                  points: 1,
                }),
              })
                .then((r) => {
                  if (r.ok) toast.success(isAr ? "تمت الإضافة إلى البنك" : "Saved to bank");
                  else toast.error(isAr ? "تعذّر الحفظ في البنك" : "Failed to save to bank");
                })
                .catch(() => toast.error(isAr ? "تعذّر الحفظ في البنك" : "Failed to save to bank"));
            }
          }}
        />
      </div>
    </Layout>
  );
}

/* ── Save status badge — shows saving spinner, "Saved at HH:MM", or
   "Unsaved changes" with the right color cue. */
function SaveStatus({
  dirty, savedAt, saving, isAr,
}: { dirty: boolean; savedAt: Date | null; saving: boolean; isAr: boolean }) {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600">
        <Loader2 className="w-3 h-3 animate-spin" />
        {isAr ? "جاري الحفظ..." : "Saving..."}
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600">
        <AlertCircle className="w-3 h-3" />
        {isAr ? "تغييرات غير محفوظة" : "Unsaved changes"}
      </span>
    );
  }
  if (savedAt) {
    const t = savedAt.toLocaleTimeString(isAr ? "ar" : "en", { hour: "2-digit", minute: "2-digit" });
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="w-3 h-3" />
        {isAr ? `محفوظ ${t}` : `Saved ${t}`}
      </span>
    );
  }
  return <span className="text-muted-foreground">{isAr ? "جاهز" : "Ready"}</span>;
}

/* ── Usage strip: 4 inline counters (slides / images / files / size)
   shown beneath the deck title. For Pro tiers limits render as "—".
   For non-Pro tiers we surface a Lock + ترقية CTA whenever any
   resource is at or near (≥80%) its cap. */
function UsageStrip({
  tier, isAr, onUpgrade,
}: { tier: PresentationTierWithUsage; isAr: boolean; onUpgrade: () => void }) {
  const items: Array<{ kind: LimitKind; cur: number; lim: number; label: string }> = [
    { kind: "slides", cur: tier.usage.slides, lim: tier.limits.maxSlidesRegular, label: isAr ? "شريحة" : "slides" },
    { kind: "images", cur: tier.usage.images, lim: tier.limits.maxImagesRegular, label: isAr ? "صورة" : "images" },
    { kind: "files", cur: tier.usage.files, lim: tier.limits.maxFilesRegular, label: isAr ? "ملف" : "files" },
    { kind: "sizeMb", cur: tier.usage.sizeMb, lim: tier.limits.maxSizeMbRegular, label: isAr ? "م.ب" : "MB" },
  ];
  const anyNear = !tier.isPro && items.some((it) => it.lim > 0 && it.cur / it.lim >= 0.8);
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {items.map((it) => {
        const ratio = it.lim > 0 ? it.cur / it.lim : 0;
        const at = !tier.isPro && ratio >= 1;
        const near = !tier.isPro && !at && ratio >= 0.8;
        const valTxt = it.kind === "sizeMb"
          ? `${it.cur} / ${tier.isPro ? "—" : it.lim} ${it.label}`
          : `${it.cur} / ${tier.isPro ? "—" : it.lim} ${it.label}`;
        return (
          <span
            key={it.kind}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold"
            style={{
              color: at ? "#b91c1c" : near ? "#b45309" : undefined,
              background: at ? "#fee2e2" : near ? "#fef3c7" : undefined,
            }}
            title={limitKindLabel(it.kind, isAr)}
          >
            {valTxt}
          </span>
        );
      })}
      {anyNear && (
        <button
          onClick={onUpgrade}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px]"
          style={{ background: BRAND_GOLD, color: BRAND_GREEN }}
        >
          <Lock className="w-3 h-3" />
          {isAr ? "ترقية" : "Upgrade"}
        </button>
      )}
    </span>
  );
}

/* ── Upgrade dialog. Lightweight non-modal panel that explains the
   Pro tier and asks the teacher to contact the platform admin. We
   intentionally don't link to a paywall page (none exists yet) — the
   Pro flag is provisioned by an admin via the teachers panel. */
/* Phase 7 — explicit class picker shown when the teacher clicks
   "Go Live". Replaces the previous silent re-use of
   `getRememberedTargetClass()` from localStorage so a teacher who
   last picked a class in another game (Wameedh / Million / …) is
   never surprised by which class the presentation roster comes from.
   Pre-fills with the remembered class but lets them change it (or
   create a new one inline via the existing ClassSelector). */
function GoLiveDialog({
  isAr, mode, onClose, onConfirm,
}: {
  isAr: boolean;
  mode: "newTab" | "sameTab";
  onClose: () => void;
  onConfirm: (targetClass: string, sessionMode: "teacher" | "self_paced") => void | Promise<void>;
}) {
  const [targetClass, setTargetClass] = useState<string>(() => getRememberedTargetClass());
  const [sessionMode, setSessionMode] = useState<"teacher" | "self_paced">("teacher");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="p-5 text-white rounded-t-2xl"
          style={{ background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, #2d7050 100%)` }}
        >
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5" style={{ color: BRAND_GOLD }} />
            <h2 className="font-black text-lg">
              {isAr ? "بدء عرض مباشر" : "Start live session"}
            </h2>
          </div>
          <p className="text-sm opacity-90 mt-1">
            {isAr
              ? "يمكنك اختيار صف (اختياري) حتى يظهر الطلاب بأسمائهم، أو اتركه فارغاً للوضع الحر."
              : "Optionally pick a class so students join by name, or leave empty for guest mode."}
          </p>
        </div>
        <div className="p-5 space-y-4" style={{ overflow: "visible" }}>

          {/* Session pacing mode — Teacher-Paced vs Self-Paced */}
          <div>
            <div className="text-sm font-bold text-slate-700 mb-2">
              {isAr ? "كيف تريد تشغيل الجلسة؟" : "How do you want to run the session?"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSessionMode("teacher")}
                className="rounded-xl border-2 p-3 text-start transition-all"
                style={sessionMode === "teacher"
                  ? { borderColor: BRAND_GREEN, background: "rgba(34,87,57,0.07)" }
                  : { borderColor: "#e2e8f0", background: "transparent" }}
              >
                <div className="text-xl mb-1">🎓</div>
                <div className="font-bold text-sm text-slate-800">
                  {isAr ? "المعلم يتحكم" : "Teacher-Paced"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {isAr ? "أنت تتحكم بتقدم الشرائح" : "You drive the slides"}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSessionMode("self_paced")}
                className="rounded-xl border-2 p-3 text-start transition-all"
                style={sessionMode === "self_paced"
                  ? { borderColor: BRAND_GOLD, background: "rgba(217,165,33,0.08)" }
                  : { borderColor: "#e2e8f0", background: "transparent" }}
              >
                <div className="text-xl mb-1">🧑‍💻</div>
                <div className="font-bold text-sm text-slate-800">
                  {isAr ? "الطالب يتحكم" : "Self-Paced"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {isAr ? "كل طالب يتصفح بنفسه" : "Each student browses freely"}
                </div>
              </button>
            </div>
          </div>

          <ClassSelector
            value={targetClass}
            onChange={setTargetClass}
            accent={BRAND_GREEN}
            label={isAr ? "الصف (اختياري)" : "Class (optional)"}
          />
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "إذا لم تختر صفاً، يكتب الطلاب أسماءهم يدوياً عند الانضمام."
              : "Without a class, students type their name manually when joining."}
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onConfirm(targetClass, sessionMode);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="gap-2 font-bold border-0 bg-[#D9A521] text-[#1c1003] hover:brightness-110"
            >
              <Radio className="w-4 h-4" />
              {isAr
                ? (mode === "newTab" ? "بدء في نافذة جديدة" : "بدء")
                : (mode === "newTab" ? "Open in new tab" : "Start")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpgradeDialog({
  open, onClose, isAr, tier,
}: { open: boolean; onClose: () => void; isAr: boolean; tier: PresentationTierWithUsage | undefined }) {
  if (!open) return null;
  const lim = tier?.limits;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="p-5 text-white"
          style={{ background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, #2d7050 100%)` }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: BRAND_GOLD }} />
            <h2 className="font-black text-lg">
              {isAr ? "الباقة الاحترافية للعروض" : "Presentations Pro"}
            </h2>
          </div>
          <p className="text-sm opacity-90 mt-1">
            {isAr
              ? "أزِل حدود الشرائح والصور والملفات وحجم التخزين."
              : "Remove caps on slides, images, files, and storage."}
          </p>
        </div>
        <div className="p-5 space-y-3 text-sm">
          {lim && (
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <div className="font-bold mb-2 text-foreground">
                {isAr ? "حدود الباقة المجانية الحالية" : "Current free-tier limits"}
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• {isAr ? `الشرائح: ${lim.maxSlidesRegular}` : `Slides: ${lim.maxSlidesRegular}`}</li>
                <li>• {isAr ? `الصور: ${lim.maxImagesRegular}` : `Images: ${lim.maxImagesRegular}`}</li>
                <li>• {isAr ? `الملفات: ${lim.maxFilesRegular}` : `Files: ${lim.maxFilesRegular}`}</li>
                <li>• {isAr ? `الحجم: ${lim.maxSizeMbRegular} م.ب` : `Storage: ${lim.maxSizeMbRegular} MB`}</li>
              </ul>
            </div>
          )}
          <p className="text-muted-foreground leading-relaxed">
            {isAr
              ? "للترقية تواصل مع مسؤول المنصة وسيقوم بتفعيل الباقة الاحترافية لحسابك."
              : "To upgrade, contact your platform admin and they'll enable Pro on your account."}
          </p>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {isAr ? "إغلاق" : "Close"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Sortable slide rail item — wraps the thumbnail button with
   dnd-kit's useSortable so the whole rail supports drag-to-reorder
   plus keyboard reorder via ↑/↓ when focused on the grip. */
function SortableSlideItem({
  slide, index, active, multi, selectMode, readOnly, isAr, isLast, theme, pattern,
  onSelect, onToggleMulti, onMoveUp, onMoveDown,
}: {
  slide: Slide;
  index: number;
  active: boolean;
  /* True when this slide is in the bulk-selection set (separate
     from `active`, which is the slide being edited). */
  multi: boolean;
  /* True when the rail is in "select multiple" mode — clicking a
     thumbnail toggles bulk membership instead of switching active. */
  selectMode: boolean;
  readOnly: boolean;
  isAr: boolean;
  isLast: boolean;
  theme: string;
  pattern: string;
  onSelect: () => void;
  onToggleMulti: (additive: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: slide.id, disabled: readOnly });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={readOnly}
          className="px-1.5 flex items-center text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-md transition-colors"
          aria-label={isAr ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            /* In selectMode (rail "Select" toggle on) every click acts
               on bulk membership. Otherwise a plain click switches
               active; shift/ctrl/meta-click toggles bulk membership
               without losing the active slide. */
            if (selectMode || e.shiftKey || e.ctrlKey || e.metaKey) {
              onToggleMulti(e.shiftKey || e.ctrlKey || e.metaKey);
              return;
            }
            onSelect();
          }}
          className={`relative flex-1 text-start rounded-xl border-2 transition-all overflow-hidden ${active ? "shadow-md scale-[1.02]" : "shadow-sm hover:scale-[1.01]"}`}
          style={{
            borderColor: multi ? BRAND_GREEN : (active ? BRAND_GOLD : "transparent"),
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          }}
        >
          <SlideThumbnail slide={slide} theme={theme} pattern={pattern} />
          {(slide.elements ?? []).some((el) => el.kind === "activity") && (
            <span
              className="absolute top-1 start-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold leading-none shadow-sm pointer-events-none"
              style={{
                background: BRAND_GOLD,
                color: "#1f2937",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
              title={isAr ? "تحتوي على نشاط" : "Contains an activity"}
            >
              {isAr ? "نشاط" : "Activity"}
            </span>
          )}
          {(selectMode || multi) && (
            <span
              className="absolute top-1 end-1 inline-flex items-center justify-center rounded-md shadow-sm pointer-events-none"
              style={{
                width: 18, height: 18,
                background: multi ? BRAND_GREEN : "rgba(255,255,255,0.92)",
                border: `1.5px solid ${multi ? BRAND_GREEN : "#cbd5e1"}`,
                color: "white",
              }}
              title={multi ? (isAr ? "محدّدة" : "Selected") : (isAr ? "اضغط للتحديد" : "Click to select")}
            >
              {multi ? <CheckSquare className="w-3 h-3" strokeWidth={3} /> : null}
            </span>
          )}
        </button>
      </div>
      <div className="absolute top-1 end-1 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">
        <button
          onClick={onMoveUp}
          disabled={readOnly || index === 0}
          className="bg-white border border-border rounded-t-lg p-1.5 disabled:opacity-30 hover:bg-muted hover:text-emerald-700 transition-colors"
          title={isAr ? "أعلى" : "Up"}
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={readOnly || isLast}
          className="bg-white border border-border border-t-0 rounded-b-lg p-1.5 disabled:opacity-30 hover:bg-muted hover:text-emerald-700 transition-colors"
          title={isAr ? "أسفل" : "Down"}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      {active ? (
         <div className="absolute bottom-1.5 start-9 text-[10px] font-black text-white px-2 py-0.5 rounded-md shadow-sm" style={{ background: BRAND_GOLD }}>
           {index + 1}
         </div>
      ) : (
         <div className="absolute bottom-1.5 start-9 text-[10px] font-bold text-muted-foreground bg-white/90 backdrop-blur px-2 py-0.5 rounded-md shadow-sm">
           {index + 1}
         </div>
      )}
    </div>
  );
}

/* Resolve the visual background for a slide. Per-slide `background`
   wins (legacy / explicit pick); otherwise we fall back to the deck's
   theme + pattern from slide-themes. */
function slideBgStyle(
  slide: Slide,
  theme: string,
  pattern: string,
): React.CSSProperties {
  const p = getPattern(pattern);
  /* Per-slide solid color overrides the theme gradient but still
     stacks the pattern overlay on top so dots/grid/lines remain
     visible when a teacher picks a custom slide background. */
  if (slide.background && slide.background !== "#ffffff" && slide.background !== "#fff") {
    return { background: slide.background, ...p.style };
  }
  const t = getTheme(theme);
  return {
    background: t.cssGrad ?? "#ffffff",
    ...p.style,
  };
}

/* Render a shape element. `rect`/`circle` use a styled div, while
   `line`/`arrow`/`divider` are SVG so they look correct at any size. */
function ShapeRenderer({ el }: { el: SlideElement }) {
  const stroke = el.borderColor ?? "#1f2937";
  const sw = Math.max(1, el.borderWidth ?? 4);
  const fill = el.bgColor ?? "transparent";
  if (el.shape === "circle") {
    return (
      <div
        style={{
          width: "100%", height: "100%",
          background: fill,
          border: el.borderWidth ? `${sw}px solid ${stroke}` : undefined,
          borderRadius: "50%",
        }}
      />
    );
  }
  if (el.shape === "line" || el.shape === "divider") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (el.shape === "arrow") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker id={`ah_${el.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
          </marker>
        </defs>
        <line x1="0" y1="50" x2="92" y2="50" stroke={stroke} strokeWidth={sw} markerEnd={`url(#ah_${el.id})`} strokeLinecap="round" />
      </svg>
    );
  }
  // rect (default)
  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: fill,
        border: el.borderWidth ? `${sw}px solid ${stroke}` : undefined,
        borderRadius: 6,
      }}
    />
  );
}

/* ── Tiny read-only thumbnail of a slide, scaled into the rail
   container via CSS transform. */
function SlideThumbnail({
  slide, theme, pattern,
}: { slide: Slide; theme: string; pattern: string }) {
  const defaultTextColor = defaultTextColorForSlide(slide, theme);
  /* Mirror the same conditional backgroundImage logic used by the
     editor canvas and SlideRender — do NOT include the property as
     `undefined` or `""` because React would clear the `background`
     shorthand gradient. Build the style object conditionally instead. */
  const bg = slideBgStyle(slide, theme, pattern);
  const thumbBg = slide.backgroundImage
    ? { ...bg, backgroundImage: `url(${slide.backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : bg;
  return (
    <div className="relative w-full h-full" style={thumbBg}>
      {(slide.elements ?? []).slice(0, 12).map((el) => {
        const left = (el.x / CANVAS_W) * 100;
        const top = (el.y / CANVAS_H) * 100;
        const w = (el.w / CANVAS_W) * 100;
        const h = (el.h / CANVAS_H) * 100;
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${left}%`,
          top: `${top}%`,
          width: `${w}%`,
          height: `${h}%`,
          overflow: "hidden",
        };
        if (el.kind === "text") {
          return (
            <div
              key={el.id}
              style={{
                ...style,
                color: el.color ?? defaultTextColor,
                fontSize: `${Math.max(4, (el.fontSize ?? 18) / 6)}px`,
                fontWeight: el.fontWeight ?? "400",
                lineHeight: 1.1,
                textAlign: (el.align as React.CSSProperties["textAlign"]) ?? "start",
              }}
            >
              {(el.text ?? "").slice(0, 60)}
            </div>
          );
        }
        if (el.kind === "image" && el.url) {
          return <img key={el.id} src={el.url} alt="" style={{ ...style, objectFit: "cover" }} />;
        }
        if (el.kind === "icon") {
          const Icon = getLucideIcon(el.iconName);
          return (
            <div key={el.id} style={{ ...style, color: el.color ?? defaultTextColor }}>
              <Icon size={Math.max(6, (el.w * 60) / CANVAS_W)} />
            </div>
          );
        }
        if (el.kind === "shape") {
          return <div key={el.id} style={style}><ShapeRenderer el={el} /></div>;
        }
        if (el.kind === "activity") {
          return (
            <div key={el.id} style={{
              ...style,
              background: "#ffffff",
              border: `1px solid ${BRAND_GREEN}`,
              borderRadius: 4,
              padding: 2,
              fontSize: 4,
              color: BRAND_GREEN,
              fontWeight: 700,
              overflow: "hidden",
            }}>
              {(el.prompt ?? "").slice(0, 40) || "?"}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/* ── Editable canvas — the full A4-ish 1280×720 stage scaled to fit
   the available width. Elements are absolutely positioned. Text is
   inline-edited via contentEditable; image elements are clickable. */
/* ── SlideCanvas ───────────────────────────────────────────────────────
   Canva-style editable canvas. Each element is wrapped in an
   `EditableShell` that owns:
     • single-click select with a clear gold outline
     • pointer-event drag (mouse + touch + pen) with `touch-action: none`
       so iOS/Android won't try to scroll/zoom while you reposition
     • 8 corner/edge resize handles
     • a floating delete button (no need to hunt for the inspector)
     • z-index lift while selected so handles + delete sit above
       neighbouring elements
   Text elements still use `contentEditable`, but only after a
   double-click — single click on a text just selects so dragging it
   doesn't fight the caret. Editing exits on Escape / Enter / blur. */
function SlideCanvas({
  slide, isAr, readOnly, selectedElId, multiSelectIds, onSelectEl, onToggleMultiSelect,
  onUpdateEl, onRemoveEl, onRemoveMany, theme, pattern,
}: {
  slide: Slide;
  isAr: boolean;
  readOnly: boolean;
  selectedElId: string | null;
  multiSelectIds: string[];
  onSelectEl: (id: string | null) => void;
  onToggleMultiSelect: (id: string) => void;
  onUpdateEl: (id: string, patch: Partial<SlideElement>) => void;
  onRemoveEl: (id: string) => void;
  onRemoveMany: (ids: string[]) => void;
  theme: string;
  pattern: string;
}) {
  const bg = slideBgStyle(slide, theme, pattern);
  const containerRef = useRef<HTMLDivElement>(null);
  /* Live transform is held locally during a drag/resize so we don't
     dispatch a full slide patch on every pointermove (which would
     re-run the autosave debouncer + re-render the slide rail at 60fps).
     Final pos is committed on pointerup. */
  const [transform, setTransform] = useState<
    { id: string; dx: number; dy: number; dw: number; dh: number } | null
  >(null);
  /* Which element (if any) is in inline text-edit mode. We track it
     here so the EditableShell can disable its drag handler while the
     contentEditable inside owns the pointer. */
  const [editingId, setEditingId] = useState<string | null>(null);

  /* Esc/Delete keyboard support — feels broken without it. Bulk-aware:
     when Ctrl+A (or shift-click) populated `multiSelectIds`, Delete
     wipes every selected element in one step instead of just the
     primary anchor. */
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (!selectedElId) return;
      if (editingId === selectedElId) return;
      if (e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (e.key === "Escape") { onSelectEl(null); }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (multiSelectIds.length > 0) {
          onRemoveMany([selectedElId, ...multiSelectIds]);
        } else {
          onRemoveEl(selectedElId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedElId, multiSelectIds, editingId, readOnly, onRemoveEl, onRemoveMany, onSelectEl]);

  return (
    <div
      className="w-full max-w-[1400px]"
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full rounded-xl shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/10 overflow-hidden"
        style={{
          /* See SlideRender for the full rationale: the conditional
             override avoids React clearing the theme `background`
             shorthand by writing `backgroundImage: ""` on update. */
          ...(slide.backgroundImage
            ? {
                ...bg,
                backgroundImage: `url(${slide.backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : bg),
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          /* Background-only deselect — direct hit on the canvas, not
             on a child element. Without this guard we'd wipe the
             selection any time the bubble reached the container. */
          if (e.target === e.currentTarget && !readOnly) onSelectEl(null);
        }}
      >
        {(slide.elements ?? []).map((el) => {
          const live = transform && transform.id === el.id ? transform : null;
          const lw = Math.max(20, el.w + (live?.dw ?? 0));
          const lh = Math.max(20, el.h + (live?.dh ?? 0));
          /* Clamp the *visual* position to the canvas during live drag/
             resize so the user can't fling an element off-stage and
             then have it snap back on pointerup. Final commit re-clamps
             to the same bounds. */
          const lx = clamp(el.x + (live?.dx ?? 0), 0, CANVAS_W - lw);
          const ly = clamp(el.y + (live?.dy ?? 0), 0, CANVAS_H - lh);
          const pct = (val: number, base: number) => `${(val / base) * 100}%`;
          const positionStyle: React.CSSProperties = {
            position: "absolute",
            left: pct(lx, CANVAS_W),
            top: pct(ly, CANVAS_H),
            width: pct(lw, CANVAS_W),
            height: pct(lh, CANVAS_H),
          };
          const selected = selectedElId === el.id;
          const multi = multiSelectIds.includes(el.id);
          const editing = editingId === el.id;
          return (
            <EditableShell
              key={el.id}
              el={el}
              selected={selected}
              multi={multi}
              editing={editing}
              readOnly={readOnly}
              isAr={isAr}
              positionStyle={positionStyle}
              containerRef={containerRef}
              onSelect={(mod) => {
                if (mod) onToggleMultiSelect(el.id);
                else onSelectEl(el.id);
              }}
              onTransform={setTransform}
              onCommit={(patch) => {
                setTransform(null);
                if (patch && Object.keys(patch).length > 0) onUpdateEl(el.id, patch);
              }}
              onRemove={() => onRemoveEl(el.id)}
            >
              <ElementContent
                el={el}
                isAr={isAr}
                readOnly={readOnly}
                editing={editing}
                theme={theme}
                slide={slide}
                onEnterEdit={() => setEditingId(el.id)}
                onExitEdit={() => setEditingId(null)}
                onCommitText={(text) => onUpdateEl(el.id, { text })}
              />
            </EditableShell>
          );
        })}
      </div>
    </div>
  );
}

/* ── EditableShell ─────────────────────────────────────────────────────
   Selection / drag / resize / delete chrome wrapped around any element.
   Pure pointer-events for unified mouse + touch + pen support. */
function EditableShell({
  el, selected, multi, editing, readOnly, isAr, positionStyle, containerRef,
  onSelect, onTransform, onCommit, onRemove, children,
}: {
  el: SlideElement;
  selected: boolean;
  multi: boolean;
  editing: boolean;
  readOnly: boolean;
  isAr: boolean;
  positionStyle: React.CSSProperties;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /* `mod` is true when the click happened with shift/ctrl/meta — caller
     uses it to add to a multi-selection instead of replacing it. */
  onSelect: (mod: boolean) => void;
  onTransform: (t: { id: string; dx: number; dy: number; dw: number; dh: number } | null) => void;
  onCommit: (patch: Partial<SlideElement>) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const HANDLES: Array<{ k: ResizeHandle; cursor: string; style: React.CSSProperties }> = [
    { k: "nw", cursor: "nwse-resize", style: { top: -6, left: -6 } },
    { k: "ne", cursor: "nesw-resize", style: { top: -6, right: -6 } },
    { k: "sw", cursor: "nesw-resize", style: { bottom: -6, left: -6 } },
    { k: "se", cursor: "nwse-resize", style: { bottom: -6, right: -6 } },
    { k: "n",  cursor: "ns-resize",   style: { top: -6, left: "50%", marginLeft: -6 } },
    { k: "s",  cursor: "ns-resize",   style: { bottom: -6, left: "50%", marginLeft: -6 } },
    { k: "w",  cursor: "ew-resize",   style: { top: "50%", left: -6, marginTop: -6 } },
    { k: "e",  cursor: "ew-resize",   style: { top: "50%", right: -6, marginTop: -6 } },
  ];

  const startGesture = (
    e: React.PointerEvent<HTMLDivElement>,
    kind: "drag" | "resize",
    handle?: ResizeHandle,
  ) => {
    if (readOnly) return;
    /* While text is being edited, the contentEditable owns the pointer
       so the caret can be placed without us hijacking it for a drag. */
    if (kind === "drag" && editing) return;
    /* Ignore non-primary buttons (right-click etc.) */
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    target.setPointerCapture(pointerId);
    const startCx = e.clientX;
    const startCy = e.clientY;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    let didMove = false;
    onSelect(e.shiftKey || e.ctrlKey || e.metaKey);

    const computeDelta = (ev: PointerEvent) => {
      const px = (ev.clientX - startCx) * scaleX;
      const py = (ev.clientY - startCy) * scaleY;
      if (kind === "drag") {
        return { dx: px, dy: py, dw: 0, dh: 0 };
      }
      const east  = handle?.includes("e");
      const south = handle?.includes("s");
      const west  = handle?.includes("w");
      const north = handle?.includes("n");
      const dx = west  ? px : 0;
      const dy = north ? py : 0;
      const dw = (east ? px : 0) - (west ? px : 0);
      const dh = (south ? py : 0) - (north ? py : 0);
      /* Clamp size so the user can't shrink past a usable hitbox. */
      const minW = 20, minH = 20;
      const clampedDw = Math.max(dw, minW - el.w);
      const clampedDh = Math.max(dh, minH - el.h);
      const clampedDx = west ? Math.min(dx, el.w - minW) : 0;
      const clampedDy = north ? Math.min(dy, el.h - minH) : 0;
      return { dx: clampedDx, dy: clampedDy, dw: clampedDw, dh: clampedDh };
    };

    const move = (ev: PointerEvent) => {
      const d = computeDelta(ev);
      if (!didMove && (Math.abs(d.dx) + Math.abs(d.dy) + Math.abs(d.dw) + Math.abs(d.dh)) > 1) didMove = true;
      onTransform({ id: el.id, ...d });
    };
    const finish = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
      try { target.releasePointerCapture(pointerId); } catch { /* already released */ }
      if (!didMove) { onTransform(null); return; }
      const d = computeDelta(ev);
      const nx = clamp(Math.round(el.x + d.dx), 0, CANVAS_W - 8);
      const ny = clamp(Math.round(el.y + d.dy), 0, CANVAS_H - 8);
      const nw = Math.max(20, Math.round(el.w + d.dw));
      const nh = Math.max(20, Math.round(el.h + d.dh));
      const patch: Partial<SlideElement> = {};
      if (nx !== el.x) (patch as { x: number }).x = nx;
      if (ny !== el.y) (patch as { y: number }).y = ny;
      if (kind === "resize") {
        if (nw !== el.w) (patch as { w: number }).w = nw;
        if (nh !== el.h) (patch as { h: number }).h = nh;
      }
      onCommit(patch);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  };

  return (
    <div
      style={{
        ...positionStyle,
        outline: selected
          ? `2px solid ${BRAND_GOLD}`
          : multi
            ? `2px dashed ${BRAND_GOLD}`
            : "1px dashed transparent",
        outlineOffset: 2,
        cursor: readOnly ? "default" : (editing ? "text" : (selected || multi ? "move" : "pointer")),
        touchAction: editing ? "auto" : "none",
        userSelect: editing ? "text" : "none",
        WebkitUserSelect: editing ? "text" : "none",
        zIndex: selected ? 5 : multi ? 4 : 1,
      }}
      onPointerDown={(e) => startGesture(e, "drag")}
    >
      {children}
      {selected && !readOnly && (
        <>
          {/* Floating delete — top-right in LTR, top-left in RTL so it
              never overlaps where the user would naturally drag. */}
          <button
            type="button"
            onPointerDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={isAr ? "حذف العنصر" : "Delete element"}
            title={isAr ? "حذف" : "Delete"}
            className="absolute inline-flex items-center justify-center rounded-full bg-rose-500 text-white shadow-md ring-2 ring-white hover:bg-rose-600 active:scale-95 transition"
            style={{
              top: -14,
              [isAr ? "left" : "right"]: -14,
              width: 28, height: 28,
              touchAction: "none",
              zIndex: 20,
            }}
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          {HANDLES.map(({ k, cursor, style }) => (
            <div
              key={k}
              role="button"
              aria-label={`resize-${k}`}
              onPointerDown={(e) => startGesture(e, "resize", k)}
              style={{
                position: "absolute",
                width: 12, height: 12, ...style,
                background: "white",
                border: `2px solid ${BRAND_GOLD}`,
                borderRadius: 3,
                boxShadow: "0 1px 3px rgba(15,23,42,0.25)",
                cursor,
                touchAction: "none",
                zIndex: 15,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/* ── ElementContent ────────────────────────────────────────────────────
   Renders the actual element body (text/image/icon/activity/shape)
   inside the EditableShell. Kept as a separate component so the shell
   stays generic. */
function ElementContent({
  el, isAr, readOnly, editing, theme, slide, onEnterEdit, onExitEdit, onCommitText,
}: {
  el: SlideElement;
  isAr: boolean;
  readOnly: boolean;
  editing: boolean;
  theme: string;
  slide: Slide;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  onCommitText: (text: string) => void;
}) {
  const defaultTextColor = defaultTextColorForSlide(slide, theme);
  if (el.kind === "text") {
    return (
      <EditableText
        el={el}
        isAr={isAr}
        readOnly={readOnly}
        editing={editing}
        defaultColor={defaultTextColor}
        onEnterEdit={onEnterEdit}
        onExitEdit={onExitEdit}
        onCommit={onCommitText}
      />
    );
  }
  if (el.kind === "image") {
    const imgEl = el as typeof el & {
      objectFit?: string;
      objectPositionX?: number;
      objectPositionY?: number;
      cropPct?: { x: number; y: number; w: number; h: number };
      imageOpacity?: number;
      imageBorderRadius?: number;
      flipH?: boolean;
      flipV?: boolean;
      brightness?: number;
      contrast?: number;
      saturation?: number;
    };
    const transforms: string[] = [];
    if (imgEl.flipH) transforms.push("scaleX(-1)");
    if (imgEl.flipV) transforms.push("scaleY(-1)");
    const filters: string[] = [];
    if (imgEl.brightness !== undefined && imgEl.brightness !== 100) filters.push(`brightness(${imgEl.brightness}%)`);
    if (imgEl.contrast  !== undefined && imgEl.contrast  !== 100) filters.push(`contrast(${imgEl.contrast}%)`);
    if (imgEl.saturation !== undefined && imgEl.saturation !== 100) filters.push(`saturate(${imgEl.saturation}%)`);
    const crop = imgEl.cropPct;
    const transformStr = transforms.length ? transforms.join(" ") : undefined;
    const filterStr    = filters.length ? filters.join(" ") : undefined;
    return el.url ? (
      <div style={{
        width: "100%", height: "100%",
        borderRadius: imgEl.imageBorderRadius ? `${imgEl.imageBorderRadius}px` : undefined,
        overflow: "hidden",
        opacity: imgEl.imageOpacity ?? 1,
      }}>
        {crop ? (
          <div style={{
            width: `${100 / crop.w}%`,
            height: `${100 / crop.h}%`,
            transform: `translate(${-(crop.x / crop.w) * 100}%, ${-(crop.y / crop.h) * 100}%)`,
          }}>
            <img src={el.url} alt="" draggable={false}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "fill",
                transform: transformStr, filter: filterStr, userSelect: "none" }} />
          </div>
        ) : (
          <img
            src={el.url}
            alt=""
            style={{
              width: "100%", height: "100%",
              objectFit: (imgEl.objectFit ?? "cover") as React.CSSProperties["objectFit"],
              objectPosition: `${imgEl.objectPositionX ?? 50}% ${imgEl.objectPositionY ?? 50}%`,
              transform: transformStr,
              filter: filterStr,
              userSelect: "none",
            }}
            draggable={false}
          />
        )}
      </div>
    ) : (
      <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
        no image
      </div>
    );
  }
  if (el.kind === "icon") {
    const Icon = getLucideIcon(el.iconName);
    const size = Math.max(16, Math.min(el.w, el.h) * 0.85);
    return (
      <div
        style={{
          width: "100%", height: "100%",
          color: el.color ?? defaultTextColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          // Allow pointer events so clicks reach the EditableShell wrapper
          // and trigger selection. Drag still works because the shell stops
          // propagation in its own pointerdown handler.
        }}
      >
        <Icon size={size} strokeWidth={1.75} />
      </div>
    );
  }
  if (el.kind === "activity") {
    const accent = (el.accentColor as string | undefined) ?? BRAND_GREEN;
    /* Activity cards may carry a `questions` array (when materialized
       from a hasad-game launcher with inline questions) OR just a
       single `prompt`/`options`. Prefer the first question from the
       array when present so the editor surfaces the real content
       instead of a placeholder. */
    const allQuestions = ((el as { questions?: { prompt: string; options: string[]; correctIndex: number }[] }).questions) ?? [];
    const first = allQuestions[0];
    const optsRaw = first ? first.options : ((el.options as string[] | undefined) ?? []);
    const promptRaw = first ? first.prompt : (el.prompt as string | undefined);
    const tfOpts = el.activityKind === "true_false" && optsRaw.length === 0
      ? ["صح", "خطأ"]
      : optsRaw;
    const labelMap: Record<string, string> = {
      mcq: isAr ? "اختيار من متعدد" : "Multiple choice",
      true_false: isAr ? "صح / خطأ" : "True / False",
      open: isAr ? "إجابة مفتوحة" : "Open answer",
      poll: isAr ? "تصويت" : "Poll",
    };
    const label = labelMap[el.activityKind ?? "open"] ?? (isAr ? "نشاط" : "Activity");
    const correctIdx = first ? first.correctIndex : -1;
    return (
      <div style={{
        width: "100%", height: "100%",
        background: "#ffffff",
        border: `3px solid ${accent}`,
        borderRadius: 16,
        boxShadow: "0 6px 18px rgba(34,87,57,0.08)",
        padding: "18px 22px",
        display: "flex", flexDirection: "column", gap: 12,
        overflow: "hidden",
        userSelect: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{
            background: accent, color: "white",
            fontSize: 12, fontWeight: 700,
            padding: "4px 10px", borderRadius: 999,
          }}>{label}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {allQuestions.length > 1 && (
              <span style={{
                background: "#f1f5f9", color: "#475569",
                fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
              }}>
                {isAr ? `س 1 من ${allQuestions.length}` : `Q 1 of ${allQuestions.length}`}
              </span>
            )}
            <span style={{
              background: BRAND_GOLD, color: "#1f2937",
              fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
            }}>{isAr ? "نشاط" : "Activity"}</span>
          </div>
        </div>
        <div style={{ color: "#0f172a", fontWeight: 700, fontSize: 22, lineHeight: 1.35, wordBreak: "break-word" }}>
          {promptRaw || (isAr ? "نص السؤال…" : "Question text…")}
        </div>
        {(el.activityKind === "mcq" || el.activityKind === "poll" || el.activityKind === "true_false" || tfOpts.length > 0) && tfOpts.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {tfOpts.map((opt, i) => {
              const isCorrect = i === correctIdx;
              return (
                <div key={i} style={{
                  border: `1.5px solid ${isCorrect ? accent : `${accent}33`}`,
                  borderRadius: 10, padding: "8px 12px",
                  fontSize: 16, color: "#1f2937",
                  background: isCorrect ? `${accent}14` : "#f8fafc",
                  fontWeight: isCorrect ? 700 : 400,
                }}>
                  <span style={{ color: accent, fontWeight: 700, marginInlineEnd: 8 }}>
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt || (isAr ? "خيار" : "Option")}
                  {isCorrect && (
                    <span style={{ marginInlineStart: 8, color: accent, fontWeight: 900 }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {el.activityKind === "open" && tfOpts.length === 0 && (
          <div style={{
            flex: 1, minHeight: 40,
            border: `1.5px dashed ${accent}55`,
            borderRadius: 10, background: "#f8fafc",
            color: "#94a3b8", fontSize: 13, padding: "8px 12px",
          }}>
            {isAr ? "مساحة للإجابة" : "Answer space"}
          </div>
        )}
      </div>
    );
  }
  if (el.kind === "hasad-game") {
    /* Delegate to the shared HasadGameRenderer (same component used by
       SlideRender) so the editor card surfaces the real prompt, the
       first question's options, the correct answer, and a "+N more"
       hint when the launcher has additional questions. */
    return (
      <div style={{ width: "100%", height: "100%", userSelect: "none" }}>
        <HasadGameRenderer el={el} lang={isAr ? "ar" : "en"} />
      </div>
    );
  }
  if (el.kind === "video-embed") {
    const vEl = el as typeof el & { videoKind?: string; videoId?: string; title?: string; url?: string };
    const isYt = vEl.videoKind === "youtube";
    const thumbUrl = isYt && vEl.videoId
      ? `https://img.youtube.com/vi/${vEl.videoId}/hqdefault.jpg`
      : null;
    return (
      <div style={{
        width: "100%", height: "100%",
        background: isYt ? "#0f172a" : "#0c1e13",
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        userSelect: "none",
        // pointerEvents auto so clicking the video thumbnail selects it.
      }}>
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt="YouTube"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            draggable={false}
          />
        ) : null}
        <div style={{
          position: "absolute", inset: 0,
          background: thumbUrl ? "rgba(0,0,0,0.32)" : "transparent",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 8,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: isYt ? "#ff0000" : BRAND_GREEN,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}>
            <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span style={{
            color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 700,
            background: "rgba(0,0,0,0.5)", padding: "3px 10px", borderRadius: 999,
          }}>
            {isYt ? "YouTube" : (isAr ? "فيديو تفاعلي" : "Interactive Video")}
          </span>
        </div>
      </div>
    );
  }
  // shape
  return (
    <div style={{ width: "100%", height: "100%", userSelect: "none" }}>
      <ShapeRenderer el={el} />
    </div>
  );
}

function EditableText({
  el, isAr, readOnly, editing, defaultColor, onEnterEdit, onExitEdit, onCommit,
}: {
  el: SlideElement;
  isAr: boolean;
  readOnly: boolean;
  editing: boolean;
  defaultColor: string;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  onCommit: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /* Track time of last pointerdown so we can detect a double-click
     manually. We can't rely on e.detail because the EditableShell's
     startGesture calls e.preventDefault() on the first pointerdown,
     which stops the browser from counting subsequent clicks as part
     of the same sequence — so e.detail stays at 1 forever. */
  const lastPointerDownTime = useRef(0);
  /* contentEditable is uncontrolled to avoid caret-jump; we sync
     the DOM only when the underlying text changes externally
     (e.g. another element selected, slide switched). */
  useEffect(() => {
    if (ref.current && ref.current.textContent !== (el.text ?? "")) {
      ref.current.textContent = el.text ?? "";
    }
  }, [el.id, el.text]);

  /* When entering edit mode, focus and put the caret at the end so
     typing immediately appends instead of replacing the existing text. */
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const onBlur = () => {
    if (!ref.current) return;
    const next = sanitizeText(ref.current.innerHTML);
    if (next !== (el.text ?? "")) onCommit(next);
    onExitEdit();
  };

  return (
    <div
      ref={ref}
      style={{
        width: "100%", height: "100%",
        color: el.color ?? defaultColor,
        background: el.bgColor ?? "transparent",
        fontSize: `${Math.max(8, (el.fontSize ?? 24) / 1.6)}px`,
        fontWeight: el.fontWeight ?? "400",
        fontFamily: el.fontFamily ?? "inherit",
        textAlign: (el.align as React.CSSProperties["textAlign"]) ?? (isAr ? "right" : "left"),
        padding: "8px 12px",
        lineHeight: 1.3,
        outline: "none",
        whiteSpace: "pre-wrap",
        overflow: "hidden",
        cursor: editing ? "text" : "inherit",
        userSelect: editing ? "text" : "none",
        WebkitUserSelect: editing ? "text" : "none",
        /* Always auto so onDoubleClick fires. When NOT editing, the
           pointerdown still bubbles up to the EditableShell which
           handles selection + drag. When editing, we swallow it so
           the contentEditable owns the caret. */
        pointerEvents: "auto",
      }}
      contentEditable={!readOnly && editing}
      suppressContentEditableWarning
      onDoubleClick={(e) => {
        if (readOnly || editing) return;
        e.stopPropagation();
        e.preventDefault();
        onEnterEdit();
      }}
      onPointerDown={(e) => {
        /* While editing, swallow pointer-down so the shell's drag
           handler doesn't interpret a caret placement as a drag. */
        if (editing) {
          e.stopPropagation();
          return;
        }
        if (readOnly) return;
        /* Manual double-click detection: if a second pointerdown
           arrives within 400ms of the first, enter edit mode. We
           can't use e.detail or onDoubleClick because the shell's
           startGesture calls e.preventDefault() on pointerdown,
           which breaks the browser's click-sequence tracking and
           suppresses the synthetic dblclick event. Stop propagation
           so the shell never starts a drag for this pointerdown —
           the existing useEffect on `editing` will focus the
           contentEditable and place the caret at the end. */
        const now = Date.now();
        if (now - lastPointerDownTime.current < 400) {
          e.stopPropagation();
          lastPointerDownTime.current = 0;
          onEnterEdit();
          return;
        }
        lastPointerDownTime.current = now;
        /* Single click: let it bubble so the shell selects + can start
           a drag. */
      }}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          (e.currentTarget as HTMLDivElement).blur();
          return;
        }
        // Allow Shift+Enter linebreaks; Enter alone confirms (blur).
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLDivElement).blur();
        }
      }}
    />
  );
}

/* ── Right rail: slide-level settings + selected-element settings.
   Element-only when one is selected, slide-level otherwise. */
function Inspector({
  isAr, readOnly, slide, selectedEl, theme, pattern,
  onChangeTheme, onChangePattern,
  onUpdateSlide, onUpdateEl, onRemoveEl, onDuplicateEl, onMoveZ,
  onPickImage, onInsertElement, onOpenActivityPicker, onOpenVideoEmbedDialog,
  onOpenImageSearch, uploading,
  onDeselect,
  gifLibraryOpen, setGifLibraryOpen,
}: {
  isAr: boolean;
  readOnly: boolean;
  slide: Slide | undefined;
  selectedEl: SlideElement | null;
  theme: string;
  pattern: string;
  onChangeTheme: (key: string) => void;
  onChangePattern: (key: string) => void;
  onUpdateSlide: (patch: Partial<Slide>) => void;
  onUpdateEl: (patch: Partial<SlideElement>) => void;
  onRemoveEl: () => void;
  onDuplicateEl: () => void;
  onMoveZ: (dir: "up" | "down" | "top" | "bottom") => void;
  onPickImage: () => void;
  onInsertElement: (el: SlideElement) => void;
  onOpenActivityPicker: () => void;
  onOpenVideoEmbedDialog: () => void;
  onOpenImageSearch: () => void;
  uploading: boolean;
  onDeselect: () => void;
  gifLibraryOpen?: boolean;
  setGifLibraryOpen?: (v: boolean) => void;
}) {
  const [gifOpen, setGifOpen] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [gifLibraryCat, setGifLibraryCat] = useState("celebrate");
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [gifSearchResults, setGifSearchResults] = useState<{ url: string; alt: string }[]>([]);
  const [gifSearchLoading, setGifSearchLoading] = useState(false);
  /* When used from the desktop editor, gifLibraryOpen is lifted to the
     editor level so the left-rail toolbar can open it. When used from
     the mobile shell, these props are absent and the Inspector manages
     its own local GIF state instead (restoring original behaviour). */
  const [_localGifOpen, _setLocalGifOpen] = useState(false);
  const activeGifOpen = gifLibraryOpen !== undefined ? gifLibraryOpen : _localGifOpen;
  const activeSetGifOpen = (v: boolean) => {
    if (setGifLibraryOpen) setGifLibraryOpen(v);
    else _setLocalGifOpen(v);
  };

  /* Debounced GIPHY search */
  useEffect(() => {
    const q = gifSearchQuery.trim();
    if (!q) { setGifSearchResults([]); setGifSearchLoading(false); return; }
    setGifSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(q)}&limit=12&rating=g&lang=ar`
        );
        const json = await res.json() as { data: { images: { fixed_height: { url: string } }; title: string }[] };
        setGifSearchResults(
          (json.data ?? []).map(g => ({ url: g.images.fixed_height.url, alt: g.title || q }))
        );
      } catch {
        setGifSearchResults([]);
      } finally {
        setGifSearchLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [gifSearchQuery]);

  /* Auto-scroll the right panel to the GIF section whenever it opens
     from the left-rail toolbar so the teacher sees it immediately. */
  const gifSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeGifOpen && gifSectionRef.current) {
      gifSectionRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeGifOpen]);

  if (!slide) return null;

  if (selectedEl) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={onDeselect}
              title={isAr ? "رجوع للقائمة" : "Back to menu"}
              className="h-8 w-8 p-0 shrink-0 hover:bg-muted"
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </Button>
            <h3 className="font-bold text-sm truncate" style={{ color: BRAND_GREEN }}>
              {selectedEl.kind === "text"
                ? (isAr ? "إعدادات النص" : "Text settings")
                : selectedEl.kind === "image"
                ? (isAr ? "إعدادات الصورة" : "Image settings")
                : selectedEl.kind === "activity"
                ? (isAr ? "إعدادات النشاط" : "Activity settings")
                : selectedEl.kind === "icon"
                ? (isAr ? "إعدادات الأيقونة" : "Icon settings")
                : selectedEl.kind === "video-embed"
                ? (isAr ? "إعدادات الفيديو" : "Video settings")
                : (isAr ? "إعدادات الشكل" : "Shape settings")}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={onDuplicateEl} disabled={readOnly} title={isAr ? "تكرار" : "Duplicate"}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemoveEl} disabled={readOnly} title={isAr ? "حذف" : "Delete"}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>

        {/* Z-order toolbar — element layering across the slide stack. */}
        <div className="flex items-center gap-1">
          <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            {isAr ? "ترتيب الطبقات" : "Layer"}
          </Label>
          <div className="flex-1" />
          <Button size="sm" variant="outline" disabled={readOnly} onClick={() => onMoveZ("bottom")} title={isAr ? "للخلف" : "To back"}>
            <ChevronsDown className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" disabled={readOnly} onClick={() => onMoveZ("down")} title={isAr ? "خطوة خلف" : "Back"}>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" disabled={readOnly} onClick={() => onMoveZ("up")} title={isAr ? "خطوة أمام" : "Forward"}>
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" disabled={readOnly} onClick={() => onMoveZ("top")} title={isAr ? "للأمام" : "To front"}>
            <ChevronsUp className="w-3.5 h-3.5" />
          </Button>
        </div>

        {selectedEl.kind === "text" && (
          <>
            <Field label={isAr ? "الخط" : "Font family"}>
              <select
                value={selectedEl.fontFamily ?? "inherit"}
                onChange={(e) => onUpdateEl({ fontFamily: e.target.value })}
                disabled={readOnly}
                className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </Field>
            <Field label={isAr ? "حجم الخط" : "Font size"}>
              <Input
                type="number"
                min={8}
                max={120}
                value={selectedEl.fontSize ?? 24}
                onChange={(e) => onUpdateEl({ fontSize: Math.max(8, Math.min(120, Number(e.target.value) || 24)) })}
                disabled={readOnly}
              />
            </Field>
            <Field label={isAr ? "السماكة" : "Weight"}>
              <div className="flex items-stretch gap-1.5">
                {/* Quick Bold toggle — most-used text action in any
                    editor. Toggling B flips between 400 (Regular) and
                    700 (Bold) on the existing fontWeight field, so no
                    schema changes are needed. The full weight scale is
                    still available in the dropdown next to it. */}
                <button
                  type="button"
                  onClick={() => {
                    const w = selectedEl.fontWeight ?? "400";
                    const isBold = Number(w) >= 600;
                    onUpdateEl({ fontWeight: isBold ? "400" : "700" });
                  }}
                  disabled={readOnly}
                  className="inline-flex items-center justify-center w-9 rounded border transition-colors disabled:opacity-40"
                  style={{
                    background: Number(selectedEl.fontWeight ?? "400") >= 600 ? BRAND_GREEN : "transparent",
                    color: Number(selectedEl.fontWeight ?? "400") >= 600 ? "white" : "inherit",
                    borderColor: Number(selectedEl.fontWeight ?? "400") >= 600 ? BRAND_GREEN : "var(--border)",
                  }}
                  title={isAr ? "غامق" : "Bold"}
                  aria-pressed={Number(selectedEl.fontWeight ?? "400") >= 600}
                >
                  <Bold className="w-3.5 h-3.5" strokeWidth={2.75} />
                </button>
                <select
                  value={selectedEl.fontWeight ?? "400"}
                  onChange={(e) => onUpdateEl({ fontWeight: e.target.value })}
                  disabled={readOnly}
                  className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background"
                >
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                  <option value="800">Extrabold</option>
                </select>
              </div>
            </Field>
            <Field label={isAr ? "المحاذاة" : "Align"}>
              <div className="grid grid-cols-3 gap-1">
                {(["start", "center", "end"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => onUpdateEl({ align: a as never })}
                    disabled={readOnly}
                    className="px-2 py-1.5 text-xs rounded border"
                    style={{
                      background: (selectedEl.align ?? "start") === a ? BRAND_GREEN : "transparent",
                      color: (selectedEl.align ?? "start") === a ? "white" : "inherit",
                      borderColor: (selectedEl.align ?? "start") === a ? BRAND_GREEN : "var(--border)",
                    }}
                  >
                    {a === "start" ? (isAr ? "بداية" : "Start") : a === "center" ? (isAr ? "وسط" : "Center") : (isAr ? "نهاية" : "End")}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={isAr ? "لون النص" : "Text color"}>
              <ColorInput value={selectedEl.color ?? "#1f2937"} onChange={(v) => onUpdateEl({ color: v })} disabled={readOnly} />
            </Field>
          </>
        )}

        {selectedEl.kind === "image" && (
          <ImageInspector
            el={selectedEl}
            onUpdateEl={onUpdateEl}
            disabled={readOnly}
            isAr={isAr}
            onPickImage={onPickImage}
            onOpenImageSearch={onOpenImageSearch}
            uploading={uploading}
          />
        )}

        {selectedEl.kind === "icon" && (
          <>
            <Field label={isAr ? "اللون" : "Color"}>
              <ColorInput value={selectedEl.color ?? "#1f2937"} onChange={(v) => onUpdateEl({ color: v })} disabled={readOnly} />
            </Field>
            <Field label={isAr ? "اختيار الأيقونة" : "Pick icon"}>
              <IconPicker
                value={selectedEl.iconName ?? "Star"}
                onChange={(name) => onUpdateEl({ iconName: name })}
                disabled={readOnly}
              />
            </Field>
          </>
        )}

        {selectedEl.kind === "activity" && (
          <ActivityInspector
            el={selectedEl}
            onUpdateEl={onUpdateEl}
            disabled={readOnly}
            isAr={isAr}
          />
        )}

        {selectedEl.kind === "hasad-game" && (
          <HasadGameInspector el={selectedEl} onUpdateEl={onUpdateEl} disabled={readOnly} isAr={isAr} deckTheme={theme} />
        )}

        {selectedEl.kind === "video-embed" && (
          <VideoEmbedInspector el={selectedEl} onUpdateEl={onUpdateEl} disabled={readOnly} isAr={isAr} />
        )}

        {selectedEl.kind === "shape" && (
          <>
            <Field label={isAr ? "نوع الشكل" : "Shape"}>
              <div className="grid grid-cols-5 gap-1">
                {(["rect", "circle", "line", "arrow", "divider"] as const).map((sh) => (
                  <button
                    key={sh}
                    onClick={() => onUpdateEl({ shape: sh as never })}
                    disabled={readOnly}
                    className="aspect-square rounded border flex items-center justify-center"
                    style={{
                      background: (selectedEl.shape ?? "rect") === sh ? BRAND_GREEN : "transparent",
                      color: (selectedEl.shape ?? "rect") === sh ? "white" : "inherit",
                      borderColor: (selectedEl.shape ?? "rect") === sh ? BRAND_GREEN : "var(--border)",
                    }}
                    title={sh}
                  >
                    {sh === "rect" ? <Square className="w-4 h-4" />
                      : sh === "circle" ? <CircleIcon className="w-4 h-4" />
                      : sh === "arrow" ? <MoveUpRight className="w-4 h-4" />
                      : <Minus className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={isAr ? "لون التعبئة" : "Fill"}>
              <ColorInput value={selectedEl.bgColor ?? "#ffffff"} onChange={(v) => onUpdateEl({ bgColor: v })} disabled={readOnly} />
            </Field>
            <Field label={isAr ? "لون الحد" : "Border color"}>
              <ColorInput value={selectedEl.borderColor ?? "#1f2937"} onChange={(v) => onUpdateEl({ borderColor: v })} disabled={readOnly} />
            </Field>
            <Field label={isAr ? "سماكة الحد" : "Border width"}>
              <Input
                type="number"
                min={0}
                max={40}
                value={selectedEl.borderWidth ?? 0}
                onChange={(e) => onUpdateEl({ borderWidth: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })}
                disabled={readOnly}
              />
            </Field>
          </>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <Field label="W">
            <Input
              type="number"
              value={Math.round(selectedEl.w)}
              onChange={(e) => onUpdateEl({ w: Math.max(20, Math.min(CANVAS_W, Number(e.target.value) || 0)) })}
              disabled={readOnly}
            />
          </Field>
          <Field label="H">
            <Input
              type="number"
              value={Math.round(selectedEl.h)}
              onChange={(e) => onUpdateEl({ h: Math.max(20, Math.min(CANVAS_H, Number(e.target.value) || 0)) })}
              disabled={readOnly}
            />
          </Field>
          <Field label="X">
            <Input
              type="number"
              value={Math.round(selectedEl.x)}
              onChange={(e) => onUpdateEl({ x: Math.max(0, Math.min(CANVAS_W - 20, Number(e.target.value) || 0)) })}
              disabled={readOnly}
            />
          </Field>
          <Field label="Y">
            <Input
              type="number"
              value={Math.round(selectedEl.y)}
              onChange={(e) => onUpdateEl({ y: Math.max(0, Math.min(CANVAS_H - 20, Number(e.target.value) || 0)) })}
              disabled={readOnly}
            />
          </Field>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Section title={isAr ? "السمات" : "Themes"} icon={<Palette className="w-4 h-4" />} defaultOpen>
        <ThemePanel value={theme} onChange={onChangeTheme} disabled={readOnly} isAr={isAr} />
      </Section>

      <Section title={isAr ? "النصوص" : "Text"} icon={<TypeIcon className="w-4 h-4" />}>
        <div className="space-y-3">
          <Button
            variant="outline" size="sm" className="w-full justify-center gap-2 font-bold shadow-sm"
            disabled={readOnly}
            onClick={() => onInsertElement({
              id: genId("t"), kind: "text",
              x: 100, y: 100, w: 800, h: 120,
              text: isAr ? "نص جديد" : "New text",
              fontSize: 32, align: "start",
              fontWeight: "700"
            } as SlideElement)}
          >
            <TypeIcon className="w-4 h-4" />
            {isAr ? "إضافة عنوان" : "Add Heading"}
          </Button>
          <Button
            variant="outline" size="sm" className="w-full justify-center gap-2 shadow-sm"
            disabled={readOnly}
            onClick={() => onInsertElement({
              id: genId("t"), kind: "text",
              x: 100, y: 240, w: 800, h: 80,
              text: isAr ? "نص فرعي" : "Subtext",
              fontSize: 20, align: "start",
            } as SlideElement)}
          >
            <TypeIcon className="w-3.5 h-3.5" />
            {isAr ? "إضافة نص فرعي" : "Add Subtext"}
          </Button>
          <div className="text-center p-4 bg-muted/20 rounded-xl border border-dashed border-border mt-2">
            <span className="text-xs text-muted-foreground font-medium">
              {isAr ? "المزيد من إعدادات النصوص قريباً" : "More text settings coming soon"}
            </span>
          </div>
        </div>
      </Section>

      <Section title={isAr ? "العناصر" : "Elements"} icon={<Square className="w-4 h-4" />}>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-bold text-muted-foreground block mb-2 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              {isAr ? "نشاط تفاعلي" : "Interactive activity"}
            </Label>
            <Button
              variant="outline" size="sm"
              className="w-full justify-center gap-2 font-bold shadow-sm"
              disabled={readOnly}
              onClick={onOpenActivityPicker}
              style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {isAr ? "إضافة نشاط" : "Add activity"}
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
              {isAr ? "اختيار من متعدد، صح/خطأ، إجابة مفتوحة، أو تصويت." : "MCQ, true/false, open answer, or poll."}
            </p>
          </div>
          <div>
            <Label className="text-xs font-bold text-muted-foreground block mb-2">
              {isAr ? "الأشكال" : "Shapes"}
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {(["rect", "circle", "line", "arrow", "divider"] as const).map((sh) => (
                <button
                  key={sh}
                  disabled={readOnly}
                  onClick={() => onInsertElement({
                    id: genId("sh"), kind: "shape", shape: sh as never,
                    x: 200, y: 220, w: 320, h: sh === "line" || sh === "divider" ? 6 : sh === "arrow" ? 60 : 200,
                    bgColor: sh === "rect" || sh === "circle" ? "#ffffff" : "transparent",
                    borderColor: BRAND_GREEN, borderWidth: 4,
                  } as SlideElement)}
                  className="aspect-square rounded-lg border border-border hover:border-emerald-500 flex items-center justify-center bg-white shadow-sm transition-all hover:-translate-y-0.5"
                  title={sh}
                >
                  {sh === "rect" ? <Square className="w-4 h-4 text-emerald-800" />
                    : sh === "circle" ? <CircleIcon className="w-4 h-4 text-emerald-800" />
                    : sh === "arrow" ? <MoveUpRight className="w-4 h-4 text-emerald-800" />
                    : <Minus className="w-4 h-4 text-emerald-800" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold text-muted-foreground block mb-2 flex items-center gap-1">
              <Smile className="w-3.5 h-3.5" />
              {isAr ? "الأيقونات" : "Icons"}
            </Label>
            <IconPicker
              value=""
              onChange={(name) => onInsertElement({
                id: genId("ic"), kind: "icon", iconName: name,
                x: 540, y: 280, w: 200, h: 200,
                color: BRAND_GREEN,
              } as SlideElement)}
              disabled={readOnly}
              insertMode
            />
          </div>
        </div>
      </Section>

      <Section title={isAr ? "الوسائط" : "Media"} icon={<ImagePlus className="w-4 h-4" />}>
        <div className="space-y-3">
          <Button
            variant="outline" className="w-full justify-center gap-2 h-20 border-dashed hover:border-emerald-500 hover:bg-emerald-50/50 flex-col group rounded-xl"
            onClick={onPickImage} disabled={readOnly || uploading}
          >
            {uploading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600" /> : <ImagePlus className="w-6 h-6 text-muted-foreground group-hover:text-emerald-600 transition-colors" />}
            <span className="font-bold text-sm text-foreground">{uploading ? (isAr ? "جاري الرفع..." : "Uploading...") : (isAr ? "رفع صورة" : "Upload Image")}</span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center gap-2 border-dashed hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl"
            onClick={onOpenImageSearch}
            disabled={readOnly}
          >
            <Search className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold text-sm text-foreground">
              {isAr ? "بحث عن صورة من الإنترنت" : "Search image from web"}
            </span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center gap-2 border-dashed hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl"
            onClick={onOpenVideoEmbedDialog}
            disabled={readOnly}
          >
            <Video className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
            <span className="font-bold text-sm text-foreground">
              {isAr ? "إدراج فيديو (يوتيوب / حصاد)" : "Embed Video (YouTube / Hasad)"}
            </span>
          </Button>
          {/* GIF Library */}
          <div ref={gifSectionRef} className="space-y-2">
            <Button
              variant="outline"
              className={`w-full justify-center gap-2 border-dashed rounded-xl transition-colors ${activeGifOpen ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20" : "hover:border-emerald-500 hover:bg-emerald-50/50"}`}
              onClick={() => { activeSetGifOpen(!activeGifOpen); setGifOpen(false); }}
              disabled={readOnly}
            >
              <span className="text-base leading-none">🎞️</span>
              <span className="font-bold text-sm text-foreground">
                {isAr ? "مكتبة GIF" : "GIF Library"}
              </span>
              {activeGifOpen
                ? <XIcon className="w-3.5 h-3.5 text-muted-foreground ms-auto" />
                : <span className="text-xs text-muted-foreground ms-auto font-normal">{isAr ? "اضغط لفتح" : "click to open"}</span>}
            </Button>

            {activeGifOpen && (
              <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
                {/* Search input */}
                <div className="p-2 pb-1">
                  <div className="relative">
                    <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={gifSearchQuery}
                      onChange={e => setGifSearchQuery(e.target.value)}
                      placeholder={isAr ? "ابحث في GIFs..." : "Search GIFs..."}
                      dir={isAr ? "rtl" : "ltr"}
                      className="h-8 text-xs rounded-xl ps-8 pe-7"
                    />
                    {gifSearchQuery && (
                      <button
                        onClick={() => setGifSearchQuery("")}
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {gifSearchQuery.trim() ? (
                  /* ── Search results ── */
                  <div className="p-2 pt-1 min-h-[80px]">
                    {gifSearchLoading ? (
                      <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4A12 12 0 014 12z" />
                        </svg>
                        {isAr ? "جارٍ البحث..." : "Searching..."}
                      </div>
                    ) : gifSearchResults.length === 0 ? (
                      <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
                        {isAr ? "لا نتائج — جرّب كلمة أخرى" : "No results — try another term"}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {gifSearchResults.map((item, i) => (
                          <button
                            key={item.url + i}
                            title={item.alt}
                            disabled={readOnly}
                            onClick={() => {
                              onInsertElement({
                                id: `img-${Date.now()}`,
                                kind: "image",
                                url: item.url,
                                x: 440, y: 210, w: 380, h: 280,
                                objectFit: "contain",
                              } as SlideElement);
                              activeSetGifOpen(false);
                              setGifSearchQuery("");
                            }}
                            className="relative group overflow-hidden rounded-lg border border-border bg-muted/50 aspect-video hover:border-emerald-500 hover:ring-2 hover:ring-emerald-400/40 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
                          >
                            <img
                              src={item.url}
                              alt={item.alt}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-emerald-900/0 group-hover:bg-emerald-900/10 transition-colors pointer-events-none" />
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate px-1">
                              {item.alt}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* GIPHY attribution */}
                    {!gifSearchLoading && gifSearchResults.length > 0 && (
                      <p className="text-[9px] text-muted-foreground text-center mt-2 opacity-60">Powered by GIPHY</p>
                    )}
                  </div>
                ) : (
                  /* ── Curated categories ── */
                  <>
                    <div className="flex overflow-x-auto gap-1 p-2 pb-1 scrollbar-none">
                      {GIF_LIBRARY.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setGifLibraryCat(cat.id)}
                          className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                            gifLibraryCat === cat.id
                              ? "text-white shadow"
                              : "text-muted-foreground bg-background hover:bg-muted"
                          }`}
                          style={gifLibraryCat === cat.id ? { background: BRAND_GREEN } : {}}
                        >
                          {isAr ? cat.labelAr : cat.labelEn}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-2 pt-1.5">
                      {GIF_LIBRARY.find(c => c.id === gifLibraryCat)?.items.map(item => (
                        <button
                          key={item.url}
                          title={isAr ? item.altAr : item.altEn}
                          disabled={readOnly}
                          onClick={() => {
                            onInsertElement({
                              id: `img-${Date.now()}`,
                              kind: "image",
                              url: item.url,
                              x: 440, y: 210, w: 380, h: 280,
                              objectFit: "contain",
                            } as SlideElement);
                            activeSetGifOpen(false);
                          }}
                          className="relative group overflow-hidden rounded-lg border border-border bg-muted/50 aspect-video hover:border-emerald-500 hover:ring-2 hover:ring-emerald-400/40 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
                        >
                          <img
                            src={item.url}
                            alt={isAr ? item.altAr : item.altEn}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const fb = parent.querySelector(".gif-fallback") as HTMLElement | null;
                                if (fb) fb.style.display = "flex";
                              }
                            }}
                          />
                          <div className="gif-fallback hidden absolute inset-0 items-center justify-center text-muted-foreground text-xs text-center px-1">
                            {isAr ? item.altAr : item.altEn}
                          </div>
                          <div className="absolute inset-0 bg-emerald-900/0 group-hover:bg-emerald-900/10 transition-colors pointer-events-none" />
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate px-1">
                            {isAr ? item.altAr : item.altEn}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Custom URL fallback */}
            {!activeGifOpen && (
              gifOpen ? (
                <div className="flex gap-2">
                  <Input
                    value={gifUrl}
                    onChange={(e) => setGifUrl(e.target.value)}
                    placeholder={isAr ? "رابط GIF مخصص..." : "Custom GIF URL..."}
                    dir="ltr"
                    className="flex-1 h-9 text-xs rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && gifUrl.trim()) {
                        onInsertElement({ id: `img-${Date.now()}`, kind: "image", url: gifUrl.trim(), x: 440, y: 210, w: 380, h: 280, objectFit: "contain" } as SlideElement);
                        setGifUrl(""); setGifOpen(false);
                      }
                      if (e.key === "Escape") { setGifOpen(false); setGifUrl(""); }
                    }}
                    autoFocus
                  />
                  <Button size="sm" disabled={!gifUrl.trim() || readOnly}
                    className="shrink-0 rounded-xl" style={{ background: BRAND_GREEN }}
                    onClick={() => {
                      if (!gifUrl.trim()) return;
                      onInsertElement({ id: `img-${Date.now()}`, kind: "image", url: gifUrl.trim(), x: 440, y: 210, w: 380, h: 280, objectFit: "contain" } as SlideElement);
                      setGifUrl(""); setGifOpen(false);
                    }}>
                    {isAr ? "إضافة" : "Add"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setGifOpen(false); setGifUrl(""); }}
                    className="shrink-0 rounded-xl px-2">
                    <XIcon className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm"
                  className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  onClick={() => setGifOpen(true)} disabled={readOnly}>
                  <ImageIcon className="w-3.5 h-3.5" />
                  {isAr ? "أو أضف برابط مخصص" : "or add by custom URL"}
                </Button>
              )
            )}
          </div>
        </div>
      </Section>

      <Section title={isAr ? "الخلفيات" : "Backgrounds"} icon={<ImagePlus className="w-4 h-4" />}>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-bold text-muted-foreground block mb-2">
              {isAr ? "النقش" : "Pattern"}
            </Label>
            <PatternPanel value={pattern} onChange={onChangePattern} disabled={readOnly} isAr={isAr} />
          </div>
          <div className="pt-3 border-t border-border">
            <Field label={isAr ? "لون خلفية الشريحة (يتجاوز السمة)" : "Slide background (overrides theme)"}>
              <ColorInput
                value={slide.background ?? "#ffffff"}
                onChange={(v) => onUpdateSlide({ background: v })}
                disabled={readOnly}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title={isAr ? "ملاحظات" : "Notes"} icon={<FileText className="w-4 h-4" />}>
        <Field label={isAr ? "ملاحظات المعلم" : "Teacher notes"}>
          <textarea
            value={slide.notes ?? ""}
            onChange={(e) => onUpdateSlide({ notes: e.target.value.slice(0, 4000) })}
            disabled={readOnly}
            rows={5}
            className="w-full p-3 text-sm border border-border rounded-xl bg-white resize-y shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
            placeholder={isAr ? "اكتب ملاحظات لا تظهر للطلاب..." : "Notes hidden from students..."}
          />
        </Field>
      </Section>
    </div>
  );
}

/* Inspector panel for a "hasad-game" launcher element. Surfaces the
   game kind, prompt, and attached question count for context. The
   activity itself is launched live from the presentation control
   page — there is no longer a standalone in-tab runner. The teacher
   can also rehearse the attached questions in a preview modal and
   fix typos / wrong answers inline; edits are written back to the
   underlying element via onUpdateEl. */
function HasadGameInspector({
  el, onUpdateEl, disabled, isAr, deckTheme,
}: {
  el: SlideElement;
  onUpdateEl: (patch: Partial<SlideElement>) => void;
  disabled: boolean;
  isAr: boolean;
  deckTheme: string;
}) {
  const gameKind = String((el as { gameKind?: string }).gameKind ?? "");
  const questions = ((el as { questions?: { prompt: string; options: string[]; correctIndex: number }[] }).questions) ?? [];
  const prompt = String((el as { prompt?: string }).prompt ?? "");
  const [previewing, setPreviewing] = useState(false);
  const onUpdateQuestion = useCallback(
    (qIdx: number, next: { prompt: string; options: string[]; correctIndex: number }) => {
      const updated = questions.map((q, i) => (i === qIdx ? next : q));
      onUpdateEl({ questions: updated } as Partial<SlideElement>);
    },
    [questions, onUpdateEl],
  );
  const labelMap: Record<string, string> = {
    kahoot: isAr ? "وميض" : "Wameedh",
    wheel: isAr ? "عجلة الحظ" : "Wheel",
    millionaire: isAr ? "من سيربح المليون" : "Millionaire",
    "flag-quiz": isAr ? "اختبار الأعلام" : "Flag quiz",
    capitals: isAr ? "العواصم" : "Capitals",
    letrly: isAr ? "حروفلي" : "Letrly",
    rocket: isAr ? "سباق الصواريخ" : "Rocket race",
    tug: isAr ? "شد الحبل" : "Tug of war",
    maraqui: isAr ? "السلّم والثعبان" : "Maraqui",
    hack: isAr ? "تحدي الاختراق" : "Hack challenge",
  };
  return (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: BRAND_GREEN }}>
        {isAr ? "لعبة حصاد الحية" : "Hasad live game"}
      </div>
      <Field label={isAr ? "نوع اللعبة" : "Game"}>
        <div className="px-3 py-1.5 text-sm font-bold rounded border bg-white" style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}>
          {labelMap[gameKind] ?? gameKind}
        </div>
      </Field>
      {prompt && (
        <Field label={isAr ? "نص النشاط" : "Prompt"}>
          <div className="px-3 py-1.5 text-sm rounded border bg-white text-foreground/85 break-words">
            {prompt}
          </div>
        </Field>
      )}
      <Field label={isAr ? "الأسئلة الجاهزة" : "Ready questions"}>
        <div className="px-3 py-1.5 text-sm font-bold rounded" style={{ background: `${BRAND_GOLD}25`, color: "#1f2937" }}>
          {questions.length > 0
            ? (isAr ? `${questions.length} سؤال جاهز` : `${questions.length} questions ready`)
            : (isAr ? "لا توجد أسئلة بعد" : "No questions yet")}
        </div>
      </Field>
      {questions.length > 0 && (
        <>
          <Button
            size="sm"
            onClick={() => {
              /* Stash the payload in sessionStorage (the runner reads
                 it on mount). Using sessionStorage keeps URLs short and
                 avoids leaking question data through the address bar. */
              try {
                const elId = String((el as { id?: string }).id ?? "");
                /* Use localStorage (not sessionStorage) — `window.open(..., "noopener")`
                   creates a separate top-level browsing context whose sessionStorage is
                   isolated from the opener tab. localStorage is shared by origin so the
                   runner can pick the payload up. We stamp `expiresAt` and the runner
                   wipes the key after read so it doesn't linger. */
                const payload = {
                  gameKind,
                  gameLabel: labelMap[gameKind] ?? gameKind,
                  prompt,
                  questions,
                  themeKey: deckTheme,
                  expiresAt: Date.now() + 1000 * 60 * 60 * 6,
                };
                localStorage.setItem(`hasad:activity:${elId}`, JSON.stringify(payload));
                window.open(`/teacher/presentations/activity-runner/${encodeURIComponent(elId)}`, "_blank", "noopener");
              } catch {
                /* localStorage write can fail when quota exhausted — fall through silently. */
              }
            }}
            className="w-full h-9 text-sm font-bold"
            style={{ background: BRAND_GREEN, color: "white" }}
          >
            <Play className="w-4 h-4 me-1.5" />
            {isAr ? "تشغيل النشاط الآن" : "Run activity now"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreviewing(true)}
            className="w-full h-8 text-xs"
          >
            <Eye className="w-3.5 h-3.5 me-1.5" />
            {isAr ? "معاينة الأسئلة" : "Preview questions"}
          </Button>
        </>
      )}
      <div className="text-[11px] text-foreground/60 leading-relaxed">
        {isAr
          ? "يفتح النشاط في نافذة جديدة. أو شغّله مباشرةً من صفحة التحكم بالعرض الحي."
          : "Opens in a new tab. You can also launch it from the live presentation control page."}
      </div>
      {previewing && (
        <HasadGamePreviewModal
          questions={questions}
          gameKind={gameKind}
          gameLabel={labelMap[gameKind] ?? gameKind}
          isAr={isAr}
          canEdit={!disabled}
          onUpdateQuestion={onUpdateQuestion}
          onClose={() => setPreviewing(false)}
        />
      )}
    </>
  );
}

/* Inspector panel for a "video-embed" element. Lets the teacher
   update the URL (reparsed on change) and see a YouTube thumbnail or
   a Hasad branded preview. Title is editable for Hasad videos so the
   teacher can label a lesson (e.g. "مقدمة الكيمياء"). */
/* Inspector for an "image" element — fit mode, opacity, corner radius,
   and quick-replace shortcuts (re-upload or re-search). */
/* ── CropPanel ────────────────────────────────────────────────────────────
   Inline mini-preview crop UI. The user drags a crop rect over a scaled
   preview of the image; on Apply we compute cropPct (all values 0..1)
   that the image renderer uses to zoom + offset the image. */
type CropPct = { x: number; y: number; w: number; h: number };
const CPREV_W = 220;
const CPREV_H = 138;
const CROP_MIN = 20;

function CropPanel({ url, value, isAr, onApply, onCancel }: {
  url: string;
  value?: CropPct;
  isAr: boolean;
  onApply: (c: CropPct) => void;
  onCancel: () => void;
}) {
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number }>(() =>
    value
      ? { x: value.x * CPREV_W, y: value.y * CPREV_H, w: value.w * CPREV_W, h: value.h * CPREV_H }
      : { x: 8, y: 5, w: CPREV_W - 16, h: CPREV_H - 10 }
  );
  const dragRef = useRef<{
    kind: "move" | "tl" | "tr" | "bl" | "br";
    sx: number; sy: number;
    sr: typeof rect;
  } | null>(null);

  function clamp(r: typeof rect) {
    const x = Math.max(0, Math.min(CPREV_W - CROP_MIN, r.x));
    const y = Math.max(0, Math.min(CPREV_H - CROP_MIN, r.y));
    const w = Math.max(CROP_MIN, Math.min(CPREV_W - x, r.w));
    const h = Math.max(CROP_MIN, Math.min(CPREV_H - y, r.h));
    return { x, y, w, h };
  }

  function startDrag(kind: NonNullable<typeof dragRef.current>["kind"], e: React.PointerEvent) {
    e.stopPropagation();
    dragRef.current = { kind, sx: e.clientX, sy: e.clientY, sr: { ...rect } };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const { kind, sx, sy, sr } = dragRef.current;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    let nr = { ...sr };
    if      (kind === "move") nr = { ...sr, x: sr.x + dx, y: sr.y + dy };
    else if (kind === "br")   nr = { ...sr, w: sr.w + dx, h: sr.h + dy };
    else if (kind === "bl")   nr = { x: sr.x + dx, y: sr.y,      w: sr.w - dx, h: sr.h + dy };
    else if (kind === "tr")   nr = { x: sr.x,      y: sr.y + dy, w: sr.w + dx, h: sr.h - dy };
    else if (kind === "tl")   nr = { x: sr.x + dx, y: sr.y + dy, w: sr.w - dx, h: sr.h - dy };
    setRect(clamp(nr));
  }

  const { x, y, w, h } = rect;
  const cp = [
    `0 0`, `${CPREV_W}px 0`, `${CPREV_W}px ${CPREV_H}px`, `0 ${CPREV_H}px`,
    `0 ${y}px`, `${x}px ${y}px`, `${x}px ${y + h}px`,
    `${x + w}px ${y + h}px`, `${x + w}px ${y}px`, `0 ${y}px`,
  ].join(", ");

  const handle = (kind: NonNullable<typeof dragRef.current>["kind"], style: React.CSSProperties) => (
    <div
      key={kind}
      onPointerDown={(e) => startDrag(kind, e)}
      style={{
        position: "absolute", width: 14, height: 14,
        background: "#fff", border: "2px solid #225739", borderRadius: 3,
        cursor: (kind === "tl" || kind === "br") ? "nwse-resize" : "nesw-resize",
        ...style,
      }}
    />
  );

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-center text-muted-foreground">
        {isAr ? "اسحب لتحديد منطقة القص" : "Drag to set crop area"}
      </p>
      <div
        className="relative overflow-hidden rounded-lg border border-border mx-auto select-none"
        style={{ width: CPREV_W, height: CPREV_H }}
        onPointerMove={onMove}
        onPointerUp={() => { dragRef.current = null; }}
      >
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-black/50 pointer-events-none"
          style={{ clipPath: `polygon(${cp})` }} />
        <div
          className="absolute border-2 border-white cursor-move"
          style={{ left: x, top: y, width: w, height: h }}
          onPointerDown={(e) => startDrag("move", e)}
        >
          {handle("tl", { top: -7, left: -7 })}
          {handle("tr", { top: -7, right: -7 })}
          {handle("bl", { bottom: -7, left: -7 })}
          {handle("br", { bottom: -7, right: -7 })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm"
          className="text-xs gap-1"
          style={{ background: BRAND_GREEN }}
          onClick={() => onApply({ x: x / CPREV_W, y: y / CPREV_H, w: w / CPREV_W, h: h / CPREV_H })}
        >
          <XIcon className="w-3 h-3 rotate-45" />
          {isAr ? "تطبيق" : "Apply"}
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={onCancel}>
          <XIcon className="w-3 h-3" />
          {isAr ? "إلغاء" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

function ImageInspector({
  el, onUpdateEl, disabled, isAr, onPickImage, onOpenImageSearch, uploading,
}: {
  el: SlideElement;
  onUpdateEl: (patch: Partial<SlideElement>) => void;
  disabled: boolean;
  isAr: boolean;
  onPickImage: () => void;
  onOpenImageSearch: () => void;
  uploading: boolean;
}) {
  type ImgEl = SlideElement & {
    objectFit?: string;
    objectPositionX?: number;
    objectPositionY?: number;
    cropPct?: CropPct;
    imageOpacity?: number;
    imageBorderRadius?: number;
    flipH?: boolean;
    flipV?: boolean;
    brightness?: number;
    contrast?: number;
    saturation?: number;
  };
  const imgEl = el as ImgEl;
  const fit        = imgEl.objectFit          ?? "cover";
  const posX       = imgEl.objectPositionX    ?? 50;
  const posY       = imgEl.objectPositionY    ?? 50;
  const cropPct    = imgEl.cropPct;
  const opacity    = imgEl.imageOpacity       ?? 1;
  const radius     = imgEl.imageBorderRadius  ?? 0;
  const flipH      = imgEl.flipH              ?? false;
  const flipV      = imgEl.flipV              ?? false;
  const brightness = imgEl.brightness         ?? 100;
  const contrast   = imgEl.contrast           ?? 100;
  const saturation = imgEl.saturation         ?? 100;

  const [cropOpen, setCropOpen] = useState(false);

  const fitOptions: Array<{ value: string; labelAr: string; label: string }> = [
    { value: "cover",   labelAr: "تملأ الإطار", label: "Cover"   },
    { value: "contain", labelAr: "داخل الإطار", label: "Contain" },
    { value: "fill",    labelAr: "تمتد",         label: "Stretch" },
    { value: "none",    labelAr: "بلا تغيير",    label: "None"    },
  ];

  function resetFilters() {
    onUpdateEl({ brightness: 100, contrast: 100, saturation: 100, imageOpacity: 1 } as Partial<SlideElement>);
  }
  const filtersChanged = brightness !== 100 || contrast !== 100 || saturation !== 100 || opacity !== 1;

  return (
    <div className="space-y-4">
      {/* ── Fit mode ── */}
      <div>
        <Label className="text-xs font-bold text-muted-foreground block mb-1.5">
          {isAr ? "ملاءمة الصورة" : "Image fit"}
        </Label>
        <div className="grid grid-cols-2 gap-1">
          {fitOptions.map((opt) => (
            <button
              key={opt.value}
              disabled={disabled}
              onClick={() => onUpdateEl({ objectFit: opt.value } as Partial<SlideElement>)}
              className="px-2 py-1.5 text-xs rounded-lg border transition-colors text-center"
              style={{
                background: fit === opt.value ? BRAND_GREEN : "transparent",
                color: fit === opt.value ? "#fff" : "inherit",
                borderColor: fit === opt.value ? BRAND_GREEN : undefined,
              }}
            >
              {isAr ? opt.labelAr : opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Object-position (only when cover & no crop) ── */}
      {fit === "cover" && !cropPct && (
        <div>
          <Label className="text-xs font-bold text-muted-foreground block mb-1.5">
            {isAr ? "موضع الصورة داخل الإطار" : "Image position"}
          </Label>
          <div className="space-y-2 bg-muted/30 rounded-lg p-2">
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-0.5">
                <span>{isAr ? "أفقي" : "Horizontal"}</span>
                <span>{posX}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={posX} disabled={disabled}
                onChange={(e) => onUpdateEl({ objectPositionX: parseInt(e.target.value, 10) } as Partial<SlideElement>)}
                className="w-full accent-emerald-700" />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-0.5">
                <span>{isAr ? "رأسي" : "Vertical"}</span>
                <span>{posY}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={posY} disabled={disabled}
                onChange={(e) => onUpdateEl({ objectPositionY: parseInt(e.target.value, 10) } as Partial<SlideElement>)}
                className="w-full accent-emerald-700" />
            </div>
          </div>
        </div>
      )}

      {/* ── Crop ── */}
      <div>
        <Label className="text-xs font-bold text-muted-foreground block mb-1.5">
          {isAr ? "قص الصورة" : "Crop"}
        </Label>
        {cropOpen && el.url ? (
          <CropPanel
            url={el.url}
            value={cropPct}
            isAr={isAr}
            onApply={(c) => {
              onUpdateEl({ cropPct: c } as Partial<SlideElement>);
              setCropOpen(false);
            }}
            onCancel={() => setCropOpen(false)}
          />
        ) : (
          <div className="flex gap-2">
            <button
              disabled={disabled}
              onClick={() => setCropOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border-2 border-dashed transition-all hover:border-emerald-500 hover:bg-emerald-50/50"
              style={cropPct
                ? { borderColor: BRAND_GREEN, color: BRAND_GREEN, background: "#e8f4ed" }
                : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <Crop className="w-3.5 h-3.5" />
              {cropPct
                ? (isAr ? "✓ تعديل القص" : "✓ Edit crop")
                : (isAr ? "قص الصورة" : "Crop image")}
            </button>
            {cropPct && (
              <button
                disabled={disabled}
                onClick={() => onUpdateEl({ cropPct: undefined } as Partial<SlideElement>)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-dashed text-red-500 hover:bg-red-50 transition-colors"
                title={isAr ? "إزالة القص" : "Remove crop"}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-bold text-muted-foreground">
            {isAr ? "تعديل الصورة" : "Adjustments"}
          </Label>
          {filtersChanged && (
            <button disabled={disabled} onClick={resetFilters}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5">
              ↺ {isAr ? "إعادة ضبط" : "Reset"}
            </button>
          )}
        </div>
        <div className="space-y-2">
          <Field label={`${isAr ? "الشفافية" : "Opacity"}: ${Math.round(opacity * 100)}%`}>
            <input type="range" min={0} max={1} step={0.05} value={opacity} disabled={disabled}
              onChange={(e) => onUpdateEl({ imageOpacity: parseFloat(e.target.value) } as Partial<SlideElement>)}
              className="w-full accent-emerald-700" />
          </Field>
          <Field label={`${isAr ? "السطوع" : "Brightness"}: ${brightness}%`}>
            <input type="range" min={0} max={200} step={5} value={brightness} disabled={disabled}
              onChange={(e) => onUpdateEl({ brightness: parseInt(e.target.value, 10) } as Partial<SlideElement>)}
              className="w-full accent-emerald-700" />
          </Field>
          <Field label={`${isAr ? "التباين" : "Contrast"}: ${contrast}%`}>
            <input type="range" min={0} max={200} step={5} value={contrast} disabled={disabled}
              onChange={(e) => onUpdateEl({ contrast: parseInt(e.target.value, 10) } as Partial<SlideElement>)}
              className="w-full accent-emerald-700" />
          </Field>
          <Field label={`${isAr ? "التشبّع" : "Saturation"}: ${saturation}%`}>
            <input type="range" min={0} max={200} step={5} value={saturation} disabled={disabled}
              onChange={(e) => onUpdateEl({ saturation: parseInt(e.target.value, 10) } as Partial<SlideElement>)}
              className="w-full accent-emerald-700" />
          </Field>
        </div>
      </div>

      {/* ── Flip ── */}
      <div>
        <Label className="text-xs font-bold text-muted-foreground block mb-1.5">
          {isAr ? "قلب الصورة" : "Flip"}
        </Label>
        <div className="grid grid-cols-2 gap-1">
          <button disabled={disabled} onClick={() => onUpdateEl({ flipH: !flipH } as Partial<SlideElement>)}
            className="px-2 py-1.5 text-xs rounded-lg border transition-colors flex items-center justify-center gap-1"
            style={{ background: flipH ? BRAND_GREEN : "transparent", color: flipH ? "#fff" : "inherit", borderColor: flipH ? BRAND_GREEN : undefined }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v12M4 5l-3 3 3 3M12 5l3 3-3 3" />
            </svg>
            {isAr ? "أفقي" : "Horiz."}
          </button>
          <button disabled={disabled} onClick={() => onUpdateEl({ flipV: !flipV } as Partial<SlideElement>)}
            className="px-2 py-1.5 text-xs rounded-lg border transition-colors flex items-center justify-center gap-1"
            style={{ background: flipV ? BRAND_GREEN : "transparent", color: flipV ? "#fff" : "inherit", borderColor: flipV ? BRAND_GREEN : undefined }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8h12M5 4l3-3 3 3M5 12l3 3 3-3" />
            </svg>
            {isAr ? "رأسي" : "Vert."}
          </button>
        </div>
      </div>

      {/* ── Border radius ── */}
      <Field label={`${isAr ? "تدوير الزوايا" : "Corner radius"}: ${radius}px`}>
        <input type="range" min={0} max={200} step={4} value={radius} disabled={disabled}
          onChange={(e) => onUpdateEl({ imageBorderRadius: parseInt(e.target.value, 10) } as Partial<SlideElement>)}
          className="w-full accent-emerald-700" />
      </Field>

      {/* ── Replace shortcuts ── */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="flex-1 gap-1 rounded-lg h-8 text-xs"
          disabled={disabled || uploading} onClick={onPickImage}>
          <ImagePlus className="w-3.5 h-3.5" />
          {isAr ? "استبدال" : "Replace"}
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-1 rounded-lg h-8 text-xs"
          disabled={disabled} onClick={onOpenImageSearch}>
          <Search className="w-3.5 h-3.5" />
          {isAr ? "من الويب" : "From web"}
        </Button>
      </div>
    </div>
  );
}

function VideoEmbedInspector({
  el, onUpdateEl, disabled, isAr,
}: {
  el: SlideElement;
  onUpdateEl: (patch: Partial<SlideElement>) => void;
  disabled: boolean;
  isAr: boolean;
}) {
  const vEl = el as typeof el & { url?: string; videoKind?: string; videoId?: string; title?: string };
  const url = vEl.url ?? "";
  const videoKind = vEl.videoKind ?? "";
  const videoId = vEl.videoId ?? "";
  const parsed = parseVideoUrl(url);
  const thumbUrl = videoKind === "youtube" && videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  return (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: BRAND_GREEN }}>
        {videoKind === "youtube" ? "YouTube" : (isAr ? "فيديو تفاعلي حصاد" : "Hasad interactive video")}
      </div>

      <Field label={isAr ? "رابط الفيديو" : "Video URL"}>
        <input
          dir="ltr"
          value={url}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            const p = parseVideoUrl(next);
            onUpdateEl({
              url: next,
              videoKind: p?.kind ?? videoKind,
              videoId: p?.videoId ?? videoId,
            } as Partial<SlideElement>);
          }}
          className="w-full px-3 py-1.5 text-xs font-mono border border-border rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-400/30"
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </Field>

      {videoKind === "hasad-video" && (
        <Field label={isAr ? "عنوان الدرس (اختياري)" : "Lesson title (optional)"}>
          <input
            value={vEl.title ?? ""}
            disabled={disabled}
            onChange={(e) => onUpdateEl({ title: e.target.value } as Partial<SlideElement>)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-400/30"
            placeholder={isAr ? "مقدمة الكيمياء…" : "Lesson intro…"}
          />
        </Field>
      )}

      {thumbUrl && (
        <div className="rounded-xl overflow-hidden border border-border shadow-sm">
          <img src={thumbUrl} alt="YouTube thumbnail" className="w-full aspect-video object-cover" />
        </div>
      )}

      {!parsed && url && (
        <p className="text-xs text-red-500 px-1">
          {isAr ? "رابط غير معروف" : "Unrecognized URL"}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {isAr
          ? "في وضع العرض الحي يُشغَّل الفيديو مباشرةً داخل الشريحة."
          : "In present mode the video plays live inside the slide."}
      </p>
    </>
  );
}

/* Renders a single question using a per-game-kind visual style that
   mirrors the live game look (Kahoot tiles, Millionaire lifelines,
   Hack terminal, etc.). Falls back to a generic A/B/C/D layout for
   unknown kinds or when the question has no options. The component
   is purely presentational — no audio, no timers, no network. */
function GameStyledQuestion({
  gameKind, prompt, options, correctIndex, revealed, isAr,
}: {
  gameKind: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  revealed: boolean;
  isAr: boolean;
}) {
  const hasOptions = Array.isArray(options) && options.length > 0;
  const noOptionsMsg = (
    <div className="text-xs text-foreground/60 italic">
      {isAr ? "لا توجد خيارات لهذا السؤال." : "No options for this question."}
    </div>
  );
  const promptText = prompt || (isAr ? "(بدون نص)" : "(no prompt)");

  if (gameKind === "kahoot" && hasOptions) {
    const tiles: { bg: string; Icon: typeof Triangle }[] = [
      { bg: "#f59e0b", Icon: Triangle },
      { bg: "#ea580c", Icon: Diamond },
      { bg: "#b91c1c", Icon: CircleIcon },
      { bg: "#d97706", Icon: Square },
    ];
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-900 text-white px-4 py-3 text-base sm:text-lg font-bold text-center break-words">
          {promptText}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt, i) => {
            const tile = tiles[i % tiles.length];
            const isCorrect = i === correctIndex;
            const dim = revealed && !isCorrect;
            const Icon = tile.Icon;
            return (
              <div
                key={i}
                className={`rounded-md px-3 py-3 text-white font-bold text-sm flex items-center gap-2 min-h-[58px] transition-opacity ${dim ? "opacity-40" : ""} ${revealed && isCorrect ? "ring-4 ring-emerald-300" : ""}`}
                style={{ background: tile.bg }}
              >
                <Icon className="w-4 h-4 shrink-0 fill-white" />
                <span className="flex-1 break-words">{opt || (isAr ? "(فارغ)" : "(empty)")}</span>
                {revealed && isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (gameKind === "millionaire" && hasOptions) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 text-amber-300">
          <span className="px-2 py-1 rounded bg-slate-900/80 border border-amber-400/50 text-xs font-bold flex items-center gap-1"><Zap className="w-3 h-3" />50:50</span>
          <span className="px-2 py-1 rounded bg-slate-900/80 border border-amber-400/50 text-xs font-bold flex items-center gap-1"><Phone className="w-3 h-3" />{isAr ? "اتصال" : "Phone"}</span>
          <span className="px-2 py-1 rounded bg-slate-900/80 border border-amber-400/50 text-xs font-bold flex items-center gap-1"><Users className="w-3 h-3" />{isAr ? "جمهور" : "Audience"}</span>
        </div>
        <div className="rounded-xl bg-gradient-to-b from-slate-900 to-blue-950 border-2 border-amber-400/70 px-4 py-4 text-center">
          <Crown className="w-5 h-5 text-amber-300 mx-auto mb-2" />
          <div className="text-white text-base sm:text-lg font-bold break-words">{promptText}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((opt, i) => {
            const isCorrect = i === correctIndex;
            const highlight = revealed && isCorrect;
            return (
              <div
                key={i}
                className={`relative rounded-full px-4 py-2.5 text-sm font-bold flex items-center gap-2 border-2 ${highlight ? "bg-emerald-500 border-emerald-200 text-white" : "bg-slate-900 border-amber-400/70 text-white"}`}
              >
                <span className="text-amber-300 shrink-0">{String.fromCharCode(65 + i)}:</span>
                <span className="flex-1 break-words">{opt || (isAr ? "(فارغ)" : "(empty)")}</span>
                {highlight && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (gameKind === "hack" && hasOptions) {
    return (
      <div className="rounded-md bg-black border border-emerald-500/40 px-4 py-3 font-mono text-emerald-300 text-sm space-y-2">
        <div className="text-emerald-500/70 text-xs">{isAr ? "$ تحدي_الاختراق --سؤال" : "$ hack_challenge --question"}</div>
        <div className="text-emerald-200 text-base font-bold break-words">&gt; {promptText}</div>
        <div className="space-y-1 pt-1">
          {options.map((opt, i) => {
            const isCorrect = i === correctIndex;
            const highlight = revealed && isCorrect;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 break-words ${highlight ? "text-emerald-100 bg-emerald-500/15 px-1 rounded" : ""}`}
              >
                <span className="shrink-0">[{String.fromCharCode(65 + i)}]</span>
                <span className="flex-1">{opt || (isAr ? "(فارغ)" : "(empty)")}</span>
                {highlight && <span className="shrink-0 text-emerald-200">// {isAr ? "صحيح" : "ok"}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (gameKind === "wheel") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center">
          <div className="relative w-28 h-28 rounded-full border-4 border-amber-400 shadow-inner overflow-hidden flex items-center justify-center"
               style={{ background: "conic-gradient(#e21b3c 0 25%, #1368ce 25% 50%, #d89e00 50% 75%, #26890c 75% 100%)" }}>
            <div className="absolute inset-3 rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-slate-700">
              {isAr ? "أدر العجلة" : "Spin"}
            </div>
          </div>
        </div>
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-center text-base sm:text-lg font-bold text-slate-900 break-words">
          {promptText}
        </div>
        {hasOptions ? (
          <div className="grid grid-cols-2 gap-1.5">
            {options.map((opt, i) => {
              const colors = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#7c3aed", "#0891b2", "#ea580c", "#be185d"];
              const isCorrect = i === correctIndex;
              const highlight = revealed && isCorrect;
              return (
                <div
                  key={i}
                  className={`rounded px-2.5 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 ${highlight ? "ring-2 ring-emerald-400" : ""}`}
                  style={{ background: colors[i % colors.length] }}
                >
                  <span className="flex-1 break-words">{opt || (isAr ? "(فارغ)" : "(empty)")}</span>
                  {highlight && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (gameKind === "flag-quiz" || gameKind === "capitals") {
    const Icon = gameKind === "flag-quiz" ? Flag : MapPin;
    const headerLabel = gameKind === "flag-quiz"
      ? (isAr ? "ما هذا العلم؟" : "Which flag is this?")
      : (isAr ? "ما عاصمة هذه الدولة؟" : "What is the capital?");
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-gradient-to-br from-sky-100 to-indigo-100 border border-sky-200 p-4 text-center">
          <div className="text-xs font-bold text-sky-700 uppercase tracking-wide mb-2">{headerLabel}</div>
          <div className="mx-auto w-24 h-16 rounded bg-white border-2 border-dashed border-sky-300 flex items-center justify-center mb-2">
            <Icon className="w-8 h-8 text-sky-500" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 break-words">{promptText}</div>
        </div>
        {hasOptions ? (
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt, i) => {
              const isCorrect = i === correctIndex;
              const highlight = revealed && isCorrect;
              return (
                <div
                  key={i}
                  className={`rounded-lg border-2 px-3 py-2.5 text-sm font-bold flex items-center gap-2 ${highlight ? "bg-emerald-50 border-emerald-500 text-emerald-900" : "bg-white border-sky-200 text-slate-800"}`}
                >
                  <span className="flex-1 break-words">{opt || (isAr ? "(فارغ)" : "(empty)")}</span>
                  {highlight && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                </div>
              );
            })}
          </div>
        ) : noOptionsMsg}
      </div>
    );
  }

  if (gameKind === "letrly") {
    const answer = hasOptions && correctIndex >= 0 && correctIndex < options.length
      ? (options[correctIndex] ?? "")
      : "";
    const reveal = revealed && answer;
    const cells = Array.from({ length: Math.max(5, answer.length || 5) });
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-100 border border-slate-300 px-4 py-3 text-center text-base sm:text-lg font-bold text-slate-900 break-words">
          {promptText}
        </div>
        <div className="flex items-center justify-center gap-1.5 flex-wrap" dir="ltr">
          {cells.map((_, i) => {
            const ch = reveal ? (answer[i] ?? "") : "";
            return (
              <div
                key={i}
                className={`w-9 h-9 sm:w-10 sm:h-10 border-2 rounded flex items-center justify-center text-base font-bold uppercase ${reveal ? "bg-emerald-500 border-emerald-600 text-white" : "bg-white border-slate-300 text-slate-700"}`}
              >
                {ch}
              </div>
            );
          })}
        </div>
        {!reveal && (
          <div className="text-[11px] text-center text-foreground/60">
            {isAr ? "اكشف الإجابة لرؤية الحروف" : "Reveal to see the letters"}
          </div>
        )}
      </div>
    );
  }

  if (gameKind === "rocket" && hasOptions) {
    const colors = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-gradient-to-b from-indigo-950 to-slate-900 text-white px-4 py-3 text-base sm:text-lg font-bold text-center break-words">
          {promptText}
        </div>
        <div className="space-y-1.5">
          {options.map((opt, i) => {
            const isCorrect = i === correctIndex;
            const highlight = revealed && isCorrect;
            const color = colors[i % colors.length];
            return (
              <div
                key={i}
                className={`relative rounded-full bg-slate-100 border border-slate-300 h-9 flex items-center px-2 gap-2 overflow-hidden ${highlight ? "ring-2 ring-emerald-400" : ""}`}
              >
                <Rocket className="w-4 h-4 shrink-0" style={{ color }} />
                <span className="text-xs font-bold flex-1 break-words text-slate-800">{opt || (isAr ? "(فارغ)" : "(empty)")}</span>
                <span className="text-[10px] text-slate-500 shrink-0">{isAr ? "🏁" : "🏁"}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (gameKind === "tug" && hasOptions) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-center text-base sm:text-lg font-bold text-slate-900 break-words">
          {promptText}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1.5">
            {options.filter((_, i) => i % 2 === 0).map((opt, k) => {
              const i = k * 2;
              const isCorrect = i === correctIndex;
              const highlight = revealed && isCorrect;
              return (
                <div key={i} className={`rounded-lg px-3 py-2 text-sm font-bold text-white text-end ${highlight ? "bg-emerald-600 ring-2 ring-emerald-300" : "bg-rose-600"}`}>
                  {opt || (isAr ? "(فارغ)" : "(empty)")}
                </div>
              );
            })}
          </div>
          <Swords className="w-6 h-6 text-amber-700 shrink-0" />
          <div className="flex-1 space-y-1.5">
            {options.filter((_, i) => i % 2 === 1).map((opt, k) => {
              const i = k * 2 + 1;
              const isCorrect = i === correctIndex;
              const highlight = revealed && isCorrect;
              return (
                <div key={i} className={`rounded-lg px-3 py-2 text-sm font-bold text-white text-start ${highlight ? "bg-emerald-600 ring-2 ring-emerald-300" : "bg-blue-600"}`}>
                  {opt || (isAr ? "(فارغ)" : "(empty)")}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (gameKind === "maraqui") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Dice5 className="w-6 h-6 text-amber-600" />
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
            {isAr ? "السلّم والثعبان" : "Snakes & ladders"}
          </div>
        </div>
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-center text-base sm:text-lg font-bold text-slate-900 break-words">
          {promptText}
        </div>
        {hasOptions ? (
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt, i) => {
              const isCorrect = i === correctIndex;
              const highlight = revealed && isCorrect;
              return (
                <div
                  key={i}
                  className={`rounded-lg border-2 px-3 py-2.5 text-sm font-bold flex items-center gap-2 ${highlight ? "bg-emerald-50 border-emerald-500 text-emerald-900" : "bg-white border-amber-300 text-slate-800"}`}
                >
                  <span className="inline-block w-6 h-6 rounded text-center leading-6 text-xs bg-amber-500 text-white shrink-0">{i + 1}</span>
                  <span className="flex-1 break-words">{opt || (isAr ? "(فارغ)" : "(empty)")}</span>
                  {highlight && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                </div>
              );
            })}
          </div>
        ) : noOptionsMsg}
      </div>
    );
  }

  /* Fallback: generic A/B/C/D layout (also used when there are no
     options or for kinds without a dedicated visual variant). */
  return (
    <>
      <div className="text-base sm:text-lg font-bold text-foreground break-words">
        {promptText}
      </div>
      {hasOptions ? (
        <div className="grid grid-cols-1 gap-2">
          {options.map((opt, i) => {
            const isCorrect = i === correctIndex;
            const highlight = revealed && isCorrect;
            return (
              <div
                key={i}
                className={`rounded-lg px-3 py-2.5 text-sm flex items-center gap-2.5 border transition-colors ${
                  highlight
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900"
                    : "bg-white border-border text-foreground/85"
                }`}
              >
                <span
                  className="inline-block w-7 h-7 rounded-full text-center leading-7 text-xs font-bold shrink-0"
                  style={{
                    background: highlight ? BRAND_GREEN : `${BRAND_GOLD}30`,
                    color: highlight ? "white" : "#1f2937",
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 break-words">{opt}</span>
                {revealed && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              </div>
            );
          })}
        </div>
      ) : noOptionsMsg}
    </>
  );
}

/* Solo rehearsal preview for hasad-game elements. Steps the teacher
   through the attached questions, lets them reveal the correct answer,
   and never touches localStorage or opens a new tab — purely in-memory
   ephemeral state. Works for any game kind that uses the shared
   { prompt, options, correctIndex } question shape. */
/* A single option row inside the preview's edit mode, made
   draggable via dnd-kit's useSortable. The drag handle is a small
   GripVertical button on the leading edge. The chevron up/down
   buttons remain in place as a fallback for users who prefer
   tap/keyboard reordering. */
function SortableOptionRow({
  i, opt, draftLength, isCorrect, isAr,
  onSetOption, onSetCorrect, onRemove, onMoveUp, onMoveDown,
}: {
  i: number;
  opt: string;
  draftLength: number;
  isCorrect: boolean;
  isAr: boolean;
  onSetOption: (v: string) => void;
  onSetCorrect: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(i) });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-foreground/50 hover:text-foreground hover:bg-muted rounded w-5 h-7 inline-flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing touch-none"
        title={isAr ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
        aria-label={isAr ? "اسحب لإعادة ترتيب الخيار" : "Drag to reorder option"}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <input
        type="radio"
        checked={isCorrect}
        onChange={onSetCorrect}
        className="w-4 h-4 accent-emerald-700 shrink-0"
        title={isAr ? "الإجابة الصحيحة" : "Correct"}
      />
      <span
        className="inline-block w-6 h-6 rounded-full text-center leading-6 text-[11px] font-bold shrink-0"
        style={{ background: `${BRAND_GOLD}30`, color: "#1f2937" }}
      >
        {String.fromCharCode(65 + i)}
      </span>
      <Input
        value={opt}
        onChange={(e) => onSetOption(e.target.value)}
        placeholder={`${isAr ? "خيار" : "Option"} ${String.fromCharCode(65 + i)}`}
        className="h-8 text-sm flex-1"
      />
      <div className="inline-flex flex-col shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={i === 0}
          className="text-foreground/60 hover:text-foreground hover:bg-muted rounded w-6 h-4 inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title={isAr ? "نقل لأعلى" : "Move up"}
          aria-label={isAr ? "نقل الخيار لأعلى" : "Move option up"}
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={i === draftLength - 1}
          className="text-foreground/60 hover:text-foreground hover:bg-muted rounded w-6 h-4 inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title={isAr ? "نقل لأسفل" : "Move down"}
          aria-label={isAr ? "نقل الخيار لأسفل" : "Move option down"}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded w-7 h-7 inline-flex items-center justify-center shrink-0"
        title={isAr ? "حذف الخيار" : "Remove option"}
        aria-label={isAr ? "حذف الخيار" : "Remove option"}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function HasadGamePreviewModal({
  questions, gameKind, gameLabel, isAr, canEdit, onUpdateQuestion, onClose,
}: {
  questions: { prompt: string; options: string[]; correctIndex: number }[];
  gameKind: string;
  gameLabel: string;
  isAr: boolean;
  canEdit: boolean;
  onUpdateQuestion: (qIdx: number, next: { prompt: string; options: string[]; correctIndex: number }) => void;
  onClose: () => void;
}) {
  const total = questions.length;
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  /* Local draft while editing — committed to the underlying element on
     Save, discarded on Cancel. Reset whenever we enter edit mode or
     navigate to a different question. */
  const [draft, setDraft] = useState<{ prompt: string; options: string[]; correctIndex: number } | null>(null);
  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
    setRevealed(false);
    setEditing(false);
    setDraft(null);
  }, []);
  const goNext = useCallback(() => {
    setIdx((i) => Math.min(total - 1, i + 1));
    setRevealed(false);
    setEditing(false);
    setDraft(null);
  }, [total]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      /* Don't hijack Space/Enter (or arrows) when an interactive
         control inside the modal has focus — let the browser activate
         the focused button/input as normal. */
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isInteractive = tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      if (isInteractive) return;
      if (editing) return;
      if (e.key === "ArrowRight") { e.preventDefault(); (isAr ? goPrev : goNext)(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); (isAr ? goNext : goPrev)(); }
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); setRevealed((r) => !r); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAr, goNext, goPrev, onClose, editing]);
  const q = questions[Math.min(idx, total - 1)];
  if (!q) return null;
  const isLast = idx >= total - 1;
  const startEdit = () => {
    setDraft({ prompt: q.prompt, options: [...(q.options ?? [])], correctIndex: q.correctIndex });
    setEditing(true);
    setRevealed(false);
  };
  const cancelEdit = () => {
    setDraft(null);
    setEditing(false);
  };
  const saveEdit = () => {
    if (!draft) return;
    const cleaned = {
      prompt: draft.prompt.slice(0, 2000),
      options: draft.options.map((o) => o.slice(0, 500)),
      correctIndex: draft.correctIndex,
    };
    onUpdateQuestion(Math.min(idx, total - 1), cleaned);
    setDraft(null);
    setEditing(false);
  };
  const setDraftPrompt = (v: string) => setDraft((d) => (d ? { ...d, prompt: v } : d));
  const setDraftOption = (i: number, v: string) =>
    setDraft((d) => (d ? { ...d, options: d.options.map((o, j) => (j === i ? v : o)) } : d));
  const setDraftCorrect = (i: number) => setDraft((d) => (d ? { ...d, correctIndex: i } : d));
  const MAX_OPTIONS = 8;
  const addDraftOption = () =>
    setDraft((d) => {
      if (!d) return d;
      if (d.options.length >= MAX_OPTIONS) return d;
      return { ...d, options: [...d.options, ""] };
    });
  const removeDraftOption = (i: number) =>
    setDraft((d) => {
      if (!d) return d;
      const nextOptions = d.options.filter((_, j) => j !== i);
      let nextCorrect = d.correctIndex;
      if (d.correctIndex === i) nextCorrect = -1;
      else if (d.correctIndex > i) nextCorrect = d.correctIndex - 1;
      return { ...d, options: nextOptions, correctIndex: nextCorrect };
    });
  /* Swap option at index i with index i+delta. correctIndex follows
     whichever option was previously marked correct so the right
     answer doesn't drift when reordering. */
  const moveDraftOption = (i: number, delta: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const j = i + delta;
      if (j < 0 || j >= d.options.length) return d;
      const nextOptions = d.options.slice();
      [nextOptions[i], nextOptions[j]] = [nextOptions[j], nextOptions[i]];
      let nextCorrect = d.correctIndex;
      if (d.correctIndex === i) nextCorrect = j;
      else if (d.correctIndex === j) nextCorrect = i;
      return { ...d, options: nextOptions, correctIndex: nextCorrect };
    });
  /* Drag-and-drop reorder from index `from` to index `to`. Uses
     dnd-kit's arrayMove and translates correctIndex so the same
     option stays marked as the right answer. */
  const reorderDraftOption = (from: number, to: number) =>
    setDraft((d) => {
      if (!d) return d;
      if (from === to || from < 0 || to < 0) return d;
      if (from >= d.options.length || to >= d.options.length) return d;
      const nextOptions = arrayMove(d.options, from, to);
      let nextCorrect = d.correctIndex;
      if (d.correctIndex === from) nextCorrect = to;
      else if (from < d.correctIndex && to >= d.correctIndex) nextCorrect = d.correctIndex - 1;
      else if (from > d.correctIndex && to <= d.correctIndex) nextCorrect = d.correctIndex + 1;
      return { ...d, options: nextOptions, correctIndex: nextCorrect };
    });
  const optionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onOptionDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    if (Number.isNaN(from) || Number.isNaN(to)) return;
    reorderDraftOption(from, to);
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: BRAND_GREEN, color: "white" }}>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Eye className="w-4 h-4" />
            {isAr ? `معاينة · ${gameLabel}` : `Preview · ${gameLabel}`}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums opacity-90">
              {isAr ? `سؤال ${idx + 1} / ${total}` : `Q ${idx + 1} / ${total}`}
            </span>
            {canEdit && !editing && (
              <button
                onClick={startEdit}
                className="rounded-md hover:bg-white/15 px-2 py-1 text-[11px] font-bold inline-flex items-center gap-1"
                title={isAr ? "تعديل هذا السؤال" : "Edit this question"}
              >
                <Pencil className="w-3.5 h-3.5" />
                {isAr ? "تعديل" : "Edit"}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full hover:bg-white/15 p-1"
              title={isAr ? "إغلاق (Esc)" : "Close (Esc)"}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {editing && draft ? (
            <>
              <Field label={isAr ? "نص السؤال" : "Prompt"}>
                <textarea
                  value={draft.prompt}
                  onChange={(e) => setDraftPrompt(e.target.value.slice(0, 2000))}
                  rows={3}
                  className="w-full p-2 text-sm border border-border rounded-lg bg-white resize-y outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder={isAr ? "اكتب السؤال…" : "Question text…"}
                  autoFocus
                />
              </Field>
              <Field label={isAr ? "الخيارات (اختر الإجابة الصحيحة)" : "Options (pick the correct one)"}>
                <div className="space-y-1.5">
                  <DndContext
                    sensors={optionSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onOptionDragEnd}
                  >
                    <SortableContext
                      items={draft.options.map((_, i) => String(i))}
                      strategy={verticalListSortingStrategy}
                    >
                      {draft.options.map((opt, i) => (
                        <SortableOptionRow
                          key={i}
                          i={i}
                          opt={opt}
                          draftLength={draft.options.length}
                          isCorrect={draft.correctIndex === i}
                          isAr={isAr}
                          onSetOption={(v) => setDraftOption(i, v)}
                          onSetCorrect={() => setDraftCorrect(i)}
                          onRemove={() => removeDraftOption(i)}
                          onMoveUp={() => moveDraftOption(i, -1)}
                          onMoveDown={() => moveDraftOption(i, 1)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  {draft.options.length === 0 && (
                    <div className="text-xs text-foreground/60 italic">
                      {isAr ? "لا توجد خيارات بعد." : "No options yet."}
                    </div>
                  )}
                  {draft.options.length < MAX_OPTIONS && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addDraftOption}
                      className="h-8 text-xs mt-1"
                    >
                      <Plus className="w-3.5 h-3.5 me-1.5" />
                      {isAr ? "إضافة خيار" : "Add option"}
                    </Button>
                  )}
                </div>
              </Field>
            </>
          ) : (
            <>
              <GameStyledQuestion
                gameKind={gameKind}
                prompt={q.prompt}
                options={q.options}
                correctIndex={q.correctIndex}
                revealed={revealed}
                isAr={isAr}
              />
              {revealed && q.options && q.options.length > 0 && (q.correctIndex < 0 || q.correctIndex >= q.options.length) && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                  {isAr ? "لم يتم تحديد إجابة صحيحة." : "No correct answer set."}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t bg-muted/30">
          {editing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEdit}
                className="h-8 text-xs"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <div className="text-[11px] text-foreground/60 flex-1 text-center px-2">
                {draft && draft.options.length > 0 && (draft.correctIndex < 0 || draft.correctIndex >= draft.options.length)
                  ? (isAr ? "اختر إجابة صحيحة قبل الحفظ." : "Pick a correct answer before saving.")
                  : (isAr ? "سيتم حفظ التعديل في هذا النشاط." : "Changes save to this activity.")}
              </div>
              <Button
                size="sm"
                onClick={saveEdit}
                disabled={!!draft && draft.options.length > 0 && (draft.correctIndex < 0 || draft.correctIndex >= draft.options.length)}
                className="h-8 text-xs"
                style={{ background: BRAND_GREEN, color: "white" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 me-1.5" />
                {isAr ? "حفظ" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={goPrev}
                disabled={idx === 0}
                className="h-8 text-xs"
              >
                {isAr ? <ChevronUp className="w-4 h-4 -rotate-90" /> : <ChevronDown className="w-4 h-4 -rotate-90" />}
                <span className="ms-1">{isAr ? "السابق" : "Prev"}</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setRevealed((r) => !r)}
                className="h-8 text-xs flex-1 max-w-[200px]"
                style={{ background: BRAND_GREEN, color: "white" }}
              >
                <Eye className="w-3.5 h-3.5 me-1.5" />
                {revealed
                  ? (isAr ? "إخفاء الإجابة" : "Hide answer")
                  : (isAr ? "كشف الإجابة" : "Reveal answer")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={goNext}
                disabled={isLast}
                className="h-8 text-xs"
              >
                <span className="me-1">{isAr ? "التالي" : "Next"}</span>
                {isAr ? <ChevronUp className="w-4 h-4 -rotate-90" /> : <ChevronDown className="w-4 h-4 -rotate-90" />}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Inspector panel for an "activity" element. Lets the teacher edit
   the prompt + options + correct answer + accent color in place. The
   activity kind itself is set at insertion time and not re-toggled
   here (changing kind would silently invalidate the options shape). */
function ActivityInspector({
  el, onUpdateEl, disabled, isAr,
}: {
  el: SlideElement;
  onUpdateEl: (patch: Partial<SlideElement>) => void;
  disabled: boolean;
  isAr: boolean;
}) {
  const kind = (el.activityKind ?? "open") as "mcq" | "true_false" | "open" | "poll";
  const opts = (el.options as string[] | undefined) ?? [];
  const correctIndex = (el.correctIndex as number | undefined) ?? -1;
  const labelMap: Record<string, string> = {
    mcq: isAr ? "اختيار من متعدد" : "Multiple choice",
    true_false: isAr ? "صح / خطأ" : "True / False",
    open: isAr ? "إجابة مفتوحة" : "Open answer",
    poll: isAr ? "تصويت" : "Poll",
  };

  const setOpt = (i: number, v: string) => {
    const next = opts.slice();
    next[i] = v.slice(0, 500);
    onUpdateEl({ options: next });
  };
  const removeOpt = (i: number) => {
    const next = opts.filter((_, j) => j !== i);
    let nextCorrect: number | undefined = correctIndex;
    if (correctIndex === i) nextCorrect = undefined;
    else if (correctIndex > i) nextCorrect = correctIndex - 1;
    onUpdateEl({ options: next, correctIndex: nextCorrect });
  };
  const addOpt = () => onUpdateEl({ options: [...opts, ""] });

  return (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: BRAND_GREEN }}>
        {labelMap[kind]}
        {typeof el.questionId === "number" && (
          <span className="ms-2 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `${BRAND_GOLD}25`, color: "#1f2937" }}>
            #{el.questionId}
          </span>
        )}
      </div>

      <Field label={isAr ? "نص السؤال" : "Prompt"}>
        <textarea
          value={(el.prompt as string | undefined) ?? ""}
          onChange={(e) => onUpdateEl({ prompt: e.target.value.slice(0, 2000) })}
          disabled={disabled}
          rows={3}
          className="w-full p-2 text-sm border border-border rounded-lg bg-white resize-y outline-none focus:ring-2 focus:ring-emerald-500/20"
          placeholder={isAr ? "اكتب السؤال…" : "Question text…"}
        />
      </Field>

      {(kind === "mcq" || kind === "poll") && (
        <Field label={isAr ? "الخيارات" : "Options"}>
          <div className="space-y-1.5">
            {opts.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {kind === "mcq" && (
                  <input
                    type="radio"
                    checked={correctIndex === i}
                    onChange={() => onUpdateEl({ correctIndex: i })}
                    disabled={disabled}
                    className="w-4 h-4 accent-emerald-700 shrink-0"
                    title={isAr ? "الإجابة الصحيحة" : "Correct"}
                  />
                )}
                <Input
                  value={opt}
                  onChange={(e) => setOpt(i, e.target.value)}
                  disabled={disabled}
                  placeholder={`${isAr ? "خيار" : "Option"} ${String.fromCharCode(65 + i)}`}
                  className="h-8 text-xs"
                />
                {opts.length > 2 && (
                  <button
                    onClick={() => removeOpt(i)}
                    disabled={disabled}
                    className="text-red-500 hover:text-red-700 text-sm font-bold w-6 h-6 rounded hover:bg-red-50 shrink-0"
                  >×</button>
                )}
              </div>
            ))}
            {opts.length < 8 && (
              <Button size="sm" variant="outline" onClick={addOpt} disabled={disabled} className="h-7 text-xs">
                + {isAr ? "خيار" : "Add"}
              </Button>
            )}
          </div>
        </Field>
      )}

      {kind === "true_false" && (
        <Field label={isAr ? "الإجابة الصحيحة" : "Correct answer"}>
          <div className="grid grid-cols-2 gap-1">
            {[0, 1].map((i) => (
              <button
                key={i}
                onClick={() => onUpdateEl({ correctIndex: i })}
                disabled={disabled}
                className="px-3 py-1.5 text-xs font-bold rounded border transition-colors"
                style={{
                  background: correctIndex === i ? BRAND_GREEN : "white",
                  color: correctIndex === i ? "white" : "inherit",
                  borderColor: correctIndex === i ? BRAND_GREEN : "var(--border)",
                }}
              >
                {i === 0 ? (isAr ? "صح" : "True") : (isAr ? "خطأ" : "False")}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label={isAr ? "اللون المميز" : "Accent color"}>
        <ColorInput
          value={(el.accentColor as string | undefined) ?? BRAND_GREEN}
          onChange={(v) => onUpdateEl({ accentColor: v })}
          disabled={disabled}
        />
      </Field>
    </>
  );
}

/* Collapsible inspector section. Hoisted out of Inspector so its
   useState identity stays stable across parent re-renders — otherwise
   open/closed state would reset on every keystroke or selection. */
function Section({
  title, icon, defaultOpen = false, children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-5 text-start hover:bg-muted/20 transition-colors px-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <div className="flex items-center gap-2.5 font-extrabold text-[13px] tracking-wide" style={{ color: BRAND_GREEN }}>
          {icon}
          {title}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 text-muted-foreground ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="pb-5 px-1 space-y-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* Constrained, non-fullscreen preview. Shares the read-only renderer
   with present mode so what teachers see here matches what students
   will see. Esc / backdrop click closes; arrows navigate. */
function PreviewModal({
  slides, startIdx, theme, pattern, isAr, onClose,
}: {
  slides: Slide[];
  startIdx: number;
  theme: string;
  pattern: string;
  isAr: boolean;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const total = slides.length;
  const goPrev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIdx((i) => Math.min(total - 1, i + 1)), [total]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); (isAr ? goPrev : goNext)(); }
      else if (e.key === "ArrowLeft")  { e.preventDefault(); (isAr ? goNext : goPrev)(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAr, goNext, goPrev, onClose]);
  const current = slides[Math.min(idx, total - 1)];
  if (!current) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div
        className="relative w-full max-w-5xl bg-black rounded-lg shadow-2xl overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
        onClick={(e) => e.stopPropagation()}
      >
        <SlideStage slide={current} theme={theme} pattern={pattern} lang={isAr ? "ar" : "en"} />
        <button
          onClick={onClose}
          className="absolute top-2 end-2 rounded-full bg-white/10 hover:bg-white/20 text-white p-1.5"
          title={isAr ? "إغلاق (Esc)" : "Close (Esc)"}
        >
          <XIcon className="w-4 h-4" />
        </button>
        <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-2">
          <button
            onClick={goPrev}
            disabled={idx === 0}
            className="rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white p-1.5"
          >
            {isAr ? <ChevronUp className="w-4 h-4 rotate-90" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
          </button>
          <div className="text-white text-xs font-mono px-2 py-1 rounded bg-white/10 min-w-[5ch] text-center">
            {idx + 1} / {total}
          </div>
          <button
            onClick={goNext}
            disabled={idx >= total - 1}
            className="rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white p-1.5"
          >
            {isAr ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronUp className="w-4 h-4 rotate-90" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorInput({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-border shadow-sm shrink-0">
        <input
          type="color"
          value={value.startsWith("#") ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="absolute -inset-2 w-16 h-16 cursor-pointer"
        />
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 40))}
        disabled={disabled}
        className="flex-1 font-mono text-xs rounded-lg shadow-sm focus-visible:ring-emerald-500/20"
      />
    </div>
  );
}

/* Theme swatch grid — picks deck-wide background gradient. Pro-tier
   themes are still selectable (gating happens server-side in T413);
   here we just badge them. */
function ThemePanel({
  value, onChange, disabled, isAr,
}: { value: string; onChange: (k: string) => void; disabled?: boolean; isAr: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const primaryKeys = ["mist", "sage", "pine", "obsidian", "ocean"];
  const primaryThemes = SLIDE_THEMES.filter((t) => primaryKeys.includes(t.key));
  const otherThemes = SLIDE_THEMES.filter((t) => !primaryKeys.includes(t.key));

  const renderCard = (t: typeof SLIDE_THEMES[0]) => {
    const selected = value === t.key;
    const txtColor = t.textOnLight ? "#1f2937" : "#ffffff";
    const bg = t.cssGrad ?? "#ddd";
    
    return (
      <button
        key={t.key}
        disabled={disabled}
        onClick={() => onChange(t.key)}
        className={`relative text-start rounded-xl border-2 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-md ${selected ? 'shadow-md' : 'shadow-sm'}`}
        style={{
          borderColor: selected ? BRAND_GOLD : "transparent",
        }}
        title={isAr ? t.labelAr : t.labelEn}
      >
        <div className="relative w-full overflow-hidden rounded-t-lg" style={{ aspectRatio: "16/9", background: bg }}>
          {/* Mock slide layout */}
          <div className="absolute inset-0 p-2 sm:p-3 flex flex-col justify-center">
            <div className="w-8 h-1 rounded-full mb-2" style={{ background: t.accentHex ?? "#fff", opacity: 0.8 }} />
            <div className="text-[10px] sm:text-xs font-bold mb-1 leading-tight" style={{ color: txtColor }}>
              {isAr ? "عنوان الشريحة" : "Slide Title"}
            </div>
            <div className="text-[7px] sm:text-[8px] opacity-80" style={{ color: txtColor }}>
              {isAr ? "نص تجريبي للمحتوى..." : "Sample content text..."}
            </div>
          </div>
          {t.tier === "pro" && (
            <span className="absolute top-2 end-2 text-[8px] font-bold rounded-md px-1.5 py-0.5 shadow-sm"
              style={{ background: BRAND_GOLD, color: BRAND_GREEN }}>
              PRO
            </span>
          )}
          {selected && (
            <div className="absolute top-2 start-2 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3" style={{ color: BRAND_GOLD }} />
            </div>
          )}
        </div>
        <div className="p-2 sm:p-3 bg-card border-t border-border rounded-b-xl flex flex-col gap-1.5">
          <div className="text-xs font-extrabold text-foreground truncate">
            {isAr ? t.labelAr : t.labelEn}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full border border-black/10" style={{ background: t.accentHex ?? "#fff" }} />
              <div className="w-3 h-3 rounded-full border border-black/10" style={{ background: t.textOnLight ? "#e5e7eb" : "#374151" }} />
              <div className="w-3 h-3 rounded-full border border-black/10" style={{ background: t.textOnLight ? "#f9fafb" : "#111827" }} />
            </div>
            <div className="text-[10px] font-medium text-muted-foreground">
              {isAr ? "نص — Aa" : "Aa — Text"}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {primaryThemes.map(renderCard)}
      </div>
      
      <div className={`grid grid-cols-2 gap-3 overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 row-span-2 col-span-2 grid grid-cols-2 gap-3">
          {otherThemes.map(renderCard)}
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className="w-full text-xs text-muted-foreground hover:text-foreground mt-2 border border-dashed border-border"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (isAr ? "عرض أقل" : "Show less") : (isAr ? "استعراض المزيد" : "Show more")}
        {expanded ? <ChevronUp className="w-3 h-3 ms-1" /> : <ChevronDown className="w-3 h-3 ms-1" />}
      </Button>
    </div>
  );
}

function PatternPanel({
  value, onChange, disabled, isAr,
}: { value: string; onChange: (k: string) => void; disabled?: boolean; isAr: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {SLIDE_PATTERNS.map((p) => {
        const selected = value === p.key;
        return (
          <button
            key={p.key}
            disabled={disabled}
            onClick={() => onChange(p.key)}
            className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 hover:-translate-y-0.5 ${selected ? 'shadow-md' : 'shadow-sm'}`}
            style={{
              borderColor: selected ? BRAND_GOLD : "transparent",
              aspectRatio: "16/9",
              background: "#1f5a3e",
              ...p.style,
            }}
            title={isAr ? p.labelAr : p.labelEn}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-1.5 inset-x-0 text-[10px] font-bold text-white text-center truncate px-1">
              {isAr ? p.labelAr : p.labelEn}
            </span>
            {p.tier === "pro" && (
              <span className="absolute top-1 end-1 text-[8px] font-bold rounded-md px-1 py-0.5 shadow-sm"
                style={{ background: BRAND_GOLD, color: BRAND_GREEN }}>
                PRO
              </span>
            )}
            {selected && (
              <div className="absolute top-1 start-1 w-3 h-3 rounded-full bg-white shadow flex items-center justify-center">
                <CheckCircle2 className="w-2.5 h-2.5" style={{ color: BRAND_GOLD }} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* Lucide icon picker — renders the whitelist as a searchable grid.
   In `insertMode` clicking creates a new icon element (used by the
   slide-level Insert panel); otherwise it just changes the current
   element's iconName. */
function IconPicker({
  value, onChange, disabled, insertMode,
}: { value: string; onChange: (name: string) => void; disabled?: boolean; insertMode?: boolean }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return LUCIDE_NAMES;
    return LUCIDE_NAMES.filter((n) => n.toLowerCase().includes(s));
  }, [q]);
  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder="Search icons..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        className="h-8 text-xs"
      />
      <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1 rounded border border-border bg-muted/20">
        {filtered.slice(0, 200).map((name) => {
          const Icon = getLucideIcon(name);
          const selected = !insertMode && value === name;
          return (
            <button
              key={name}
              disabled={disabled}
              onClick={() => onChange(name)}
              className="aspect-square rounded flex items-center justify-center hover:bg-emerald-500/10 transition-colors"
              style={{
                background: selected ? BRAND_GREEN : "transparent",
                color: selected ? "white" : "inherit",
              }}
              title={name}
            >
              <Icon size={16} />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-6 text-center text-xs text-muted-foreground py-3">
            no matches
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Canva-style mobile / tablet shell. Renders a 52px top bar, a
   large centered slide canvas, a horizontal slide strip, a floating
   "+" FAB, and contextual bottom sheets for adding/inspecting
   elements, theme, pattern, slide actions, and the "more" menu. */
function MobileShell({
  isAr, dir, readOnly, title, tier, saving, dirty, savedAt,
  slides, activeIdx, activeSlide, selectedElId, selectedEl,
  theme, pattern, uploading, sheet, setSheet,
  onSelectSlide, onSelectEl, onUpdateEl, onUpdateActiveSlide,
  onRemoveEl, onDuplicateEl, onMoveZ,
  onAddSlide, onDuplicateSlide, onDeleteSlide, onMoveSlide,
  onChangeTheme, onChangePattern,
  onPickImage, onInsertElement, onOpenActivityPicker, onOpenVideoEmbedDialog,
  onOpenImageSearch, onOpenPreview, onPresent, onSaveNow, onOpenAiBuilder,
  onOpenSessions, onGoLive, onExport, onBack, onUpgrade,
}: {
  isAr: boolean;
  dir: "rtl" | "ltr";
  readOnly: boolean;
  title: string;
  tier: PresentationTierWithUsage | undefined;
  saving: boolean;
  dirty: boolean;
  savedAt: Date | null;
  slides: Slide[];
  activeIdx: number;
  activeSlide: Slide | undefined;
  selectedElId: string | null;
  selectedEl: SlideElement | null;
  theme: string;
  pattern: string;
  uploading: boolean;
  sheet: "none" | "add" | "inspect" | "theme" | "pattern" | "shapes" | "icons" | "notes" | "menu";
  setSheet: (s: "none" | "add" | "inspect" | "theme" | "pattern" | "shapes" | "icons" | "notes" | "menu") => void;
  onSelectSlide: (i: number) => void;
  onSelectEl: (id: string | null) => void;
  onUpdateEl: (id: string, patch: Partial<SlideElement>) => void;
  onUpdateActiveSlide: (patch: Partial<Slide>) => void;
  onRemoveEl: (id: string) => void;
  onDuplicateEl: (id: string) => void;
  onMoveZ: (id: string, dir: "up" | "down" | "top" | "bottom") => void;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onMoveSlide: (delta: -1 | 1) => void;
  onChangeTheme: (key: string) => void;
  onChangePattern: (key: string) => void;
  onPickImage: () => void;
  onInsertElement: (el: SlideElement) => void;
  onOpenActivityPicker: () => void;
  onOpenVideoEmbedDialog: () => void;
  onOpenImageSearch: () => void;
  onOpenPreview: () => void;
  onPresent: (fromCurrent: boolean) => void;
  onSaveNow: () => void;
  onOpenAiBuilder: () => void;
  onOpenSessions: () => void;
  onGoLive: () => void;
  onExport: (kind: "pdf" | "pptx") => void;
  onBack: () => void;
  onUpgrade: () => void;
}) {
  const BG = "#F6F4EE";
  const BRAND_SOFT = "#EAF2EC";
  const BORDER = "#E7E2D6";
  const Back = isAr ? ArrowRight : ArrowLeft;
  const sheetTitle =
    sheet === "add" ? (isAr ? "إضافة عنصر" : "Add element")
    : sheet === "inspect" ? (
        selectedEl?.kind === "text" ? (isAr ? "تنسيق النص" : "Text")
        : selectedEl?.kind === "image" ? (isAr ? "أدوات الصورة" : "Image")
        : selectedEl?.kind === "icon" ? (isAr ? "الأيقونة" : "Icon")
        : selectedEl?.kind === "shape" ? (isAr ? "الشكل" : "Shape")
        : selectedEl?.kind === "activity" ? (isAr ? "النشاط" : "Activity")
        : selectedEl?.kind === "video-embed" ? (isAr ? "الفيديو" : "Video")
        : (isAr ? "العنصر" : "Element")
      )
    : sheet === "theme" ? (isAr ? "السمات" : "Themes")
    : sheet === "pattern" ? (isAr ? "النقش" : "Patterns")
    : sheet === "shapes" ? (isAr ? "الأشكال" : "Shapes")
    : sheet === "icons" ? (isAr ? "الأيقونات" : "Icons")
    : sheet === "notes" ? (isAr ? "ملاحظات الشريحة" : "Slide notes")
    : sheet === "menu" ? (isAr ? "خيارات" : "Options")
    : "";

  const closeSheet = () => {
    if (sheet === "inspect") onSelectEl(null);
    else setSheet("none");
  };

  return (
    <div
      className="absolute inset-0 flex flex-col font-['Tajawal']"
      style={{ background: BG }}
      dir={dir}
    >
      {/* ── Top bar (48px). Calmer & content-first: back, quiet title,
          icon-only Present, and a single More entry that hosts the
          save status, preview, and every secondary action. */}
      <header
        className="flex shrink-0 items-center gap-1.5 border-b bg-white px-2"
        style={{ height: 48, borderColor: BORDER }}
      >
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
          aria-label={isAr ? "رجوع" : "Back"}
        >
          <Back className="h-[18px] w-[18px]" />
        </button>

        <div className="flex min-w-0 flex-1 items-center">
          <span
            className="w-full truncate text-[13.5px] font-medium tracking-tight text-slate-800"
            style={{ textAlign: isAr ? "right" : "left" }}
          >
            {title || (isAr ? "عرض جديد" : "Untitled deck")}
          </span>
        </div>

        <button
          onClick={() => onPresent(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full active:scale-95"
          style={{ background: BRAND_GREEN, color: "white" }}
          aria-label={isAr ? "تقديم" : "Present"}
        >
          <Play className="h-4 w-4 fill-white" />
        </button>

        <button
          onClick={() => setSheet("menu")}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
          aria-label={isAr ? "المزيد" : "More"}
        >
          <MoreVertical className="h-[18px] w-[18px]" />
          {/* Tiny status dot — replaces the noisy save-status text in
              the top bar. Visible only while there are unsaved
              changes or a save is in flight. */}
          {(dirty || saving) && (
            <span
              className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
              style={{ background: BRAND_GOLD }}
              aria-hidden
            />
          )}
        </button>
      </header>

      {/* ── Canvas area. Calmer dot pattern (lighter color, smaller
          dot, larger tile) so the slide is the visual focus, not the
          background. */}
      <main
        className="relative flex-1 min-h-0 overflow-hidden p-3 flex items-center justify-center"
        style={{
          backgroundColor: '#f1f3f6',
          backgroundImage: 'radial-gradient(circle at center, #dde2ea 0.8px, transparent 0.8px)',
          backgroundSize: '28px 28px',
        }}
      >
        {activeSlide ? (
          <div className="w-full max-w-full flex items-center justify-center">
            <SlideCanvas
              slide={activeSlide}
              isAr={isAr}
              readOnly={readOnly}
              selectedElId={selectedElId}
              multiSelectIds={[]}
              onSelectEl={onSelectEl}
              onToggleMultiSelect={() => { /* mobile: single-select only */ }}
              onUpdateEl={onUpdateEl}
              onRemoveEl={onRemoveEl}
              onRemoveMany={(ids) => ids.forEach((id) => onRemoveEl(id))}
              theme={theme}
              pattern={pattern}
            />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            {isAr ? "لا توجد شريحة" : "No slide"}
          </div>
        )}

        {/* FAB — Add element */}
        {!readOnly && (
          <button
            onClick={() => { onSelectEl(null); setSheet("add"); }}
            className="absolute bottom-4 flex h-14 w-14 items-center justify-center rounded-full shadow-lg active:scale-95 z-10"
            style={{ background: BRAND_GREEN, color: "white", insetInlineEnd: 16 }}
            aria-label={isAr ? "إضافة عنصر" : "Add element"}
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>
        )}

        {/* Slide counter pill */}
        <div className="absolute top-2 inset-x-0 flex justify-center pointer-events-none">
          <span className="text-[10px] font-medium text-slate-600 bg-white/85 px-2.5 py-0.5 rounded-full ring-1 ring-slate-200/70 backdrop-blur-sm">
            {isAr ? `${activeIdx + 1} / ${slides.length}` : `${activeIdx + 1} / ${slides.length}`}
          </span>
        </div>
      </main>

      {/* ── Slide strip — smooth scroll with snap, soft active ring,
          and the active thumbnail auto-scrolled into view. */}
      <SlideStrip
        slides={slides}
        activeIdx={activeIdx}
        theme={theme}
        pattern={pattern}
        readOnly={readOnly}
        isAr={isAr}
        border={BORDER}
        onSelectSlide={onSelectSlide}
        onAddSlide={onAddSlide}
      />

      {/* ── Bottom sheet — lighter overlay, softer surface (ring
          instead of heavy shadow), smaller "Done" pill, smoother
          spring-like ease. */}
      {sheet !== "none" && (
        <>
          <div
            className="absolute inset-0 z-30"
            style={{ background: "rgba(15, 23, 42, 0.28)", animation: "hasadSheetFade 220ms ease-out" }}
            onClick={closeSheet}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-40 rounded-t-[22px] bg-white max-h-[78vh] flex flex-col"
            style={{
              animation: "hasadSheetUp 280ms cubic-bezier(0.22, 1, 0.36, 1)",
              boxShadow: "0 -1px 0 rgba(15,23,42,0.06), 0 -8px 24px -12px rgba(15,23,42,0.18)",
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-[3px] w-9 rounded-full bg-slate-300/80" />
            </div>
            <div className="flex items-center justify-between px-5 py-2 shrink-0">
              <h3 className="text-[13px] font-semibold tracking-tight text-slate-700">{sheetTitle}</h3>
              <button
                onClick={closeSheet}
                className="text-[11px] font-semibold px-2.5 h-7 rounded-full active:scale-95 transition-transform"
                style={{ color: BRAND_GREEN, background: BRAND_SOFT }}
              >
                {isAr ? "تم" : "Done"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {sheet === "add" && (
                <MobileAddGrid
                  isAr={isAr}
                  uploading={uploading}
                  readOnly={readOnly}
                  onAddText={(big) => {
                    onInsertElement({
                      id: genId("t"), kind: "text",
                      x: 100, y: big ? 100 : 240, w: 1080, h: big ? 120 : 80,
                      text: big ? (isAr ? "عنوان جديد" : "New heading") : (isAr ? "نص فرعي" : "Subtext"),
                      fontSize: big ? 44 : 22,
                      fontWeight: big ? "700" : "400",
                      align: "start",
                    } as SlideElement);
                    setSheet("none");
                  }}
                  onAddImage={() => { onPickImage(); setSheet("none"); }}
                  onAddImageSearch={() => { onOpenImageSearch(); setSheet("none"); }}
                  onAddShape={() => setSheet("shapes")}
                  onAddIcon={() => setSheet("icons")}
                  onAddActivity={() => { onOpenActivityPicker(); setSheet("none"); }}
                  onOpenTheme={() => setSheet("theme")}
                  onOpenPattern={() => setSheet("pattern")}
                  onOpenNotes={() => setSheet("notes")}
                />
              )}

              {sheet === "shapes" && (
                <div className="grid grid-cols-5 gap-2">
                  {(["rect", "circle", "line", "arrow", "divider"] as const).map((sh) => (
                    <button
                      key={sh}
                      disabled={readOnly}
                      onClick={() => {
                        onInsertElement({
                          id: genId("sh"), kind: "shape", shape: sh as never,
                          x: 200, y: 220, w: 320, h: sh === "line" || sh === "divider" ? 6 : sh === "arrow" ? 60 : 200,
                          bgColor: sh === "rect" || sh === "circle" ? "#ffffff" : "transparent",
                          borderColor: BRAND_GREEN, borderWidth: 4,
                        } as SlideElement);
                        setSheet("none");
                      }}
                      className="aspect-square rounded-xl border bg-white flex items-center justify-center active:scale-95"
                      style={{ borderColor: BORDER }}
                    >
                      {sh === "rect" ? <Square className="w-6 h-6" style={{ color: BRAND_GREEN }} />
                        : sh === "circle" ? <CircleIcon className="w-6 h-6" style={{ color: BRAND_GREEN }} />
                        : sh === "arrow" ? <MoveUpRight className="w-6 h-6" style={{ color: BRAND_GREEN }} />
                        : <Minus className="w-6 h-6" style={{ color: BRAND_GREEN }} />}
                    </button>
                  ))}
                </div>
              )}

              {sheet === "icons" && (
                <IconPicker
                  value=""
                  onChange={(name) => {
                    onInsertElement({
                      id: genId("ic"), kind: "icon", iconName: name,
                      x: 540, y: 280, w: 200, h: 200,
                      color: BRAND_GREEN,
                    } as SlideElement);
                    setSheet("none");
                  }}
                  disabled={readOnly}
                  insertMode
                />
              )}

              {sheet === "theme" && (
                <ThemePanel value={theme} onChange={(k) => { onChangeTheme(k); }} disabled={readOnly} isAr={isAr} />
              )}

              {sheet === "pattern" && (
                <PatternPanel value={pattern} onChange={(k) => { onChangePattern(k); }} disabled={readOnly} isAr={isAr} />
              )}

              {sheet === "notes" && activeSlide && (
                <textarea
                  value={activeSlide.notes ?? ""}
                  onChange={(e) => onUpdateActiveSlide({ notes: e.target.value.slice(0, 4000) })}
                  disabled={readOnly}
                  rows={8}
                  className="w-full p-3 text-sm border border-border rounded-xl bg-white resize-y shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  placeholder={isAr ? "اكتب ملاحظات لا تظهر للطلاب..." : "Notes hidden from students..."}
                />
              )}

              {sheet === "menu" && (
                <MobileMoreMenu
                  isAr={isAr}
                  readOnly={readOnly}
                  dirty={dirty}
                  saving={saving}
                  savedAt={savedAt}
                  tier={tier}
                  hasActiveSlide={!!activeSlide}
                  multipleSlides={slides.length > 1}
                  canMoveBack={activeIdx > 0}
                  canMoveForward={activeIdx < slides.length - 1}
                  onSave={() => { onSaveNow(); setSheet("none"); }}
                  onAi={() => { onOpenAiBuilder(); setSheet("none"); }}
                  onExportPdf={() => { onExport("pdf"); setSheet("none"); }}
                  onExportPptx={() => { onExport("pptx"); setSheet("none"); }}
                  onSessions={() => { onOpenSessions(); setSheet("none"); }}
                  onGoLive={() => { onGoLive(); setSheet("none"); }}
                  onPresentFromHere={() => { onPresent(true); setSheet("none"); }}
                  onDuplicateSlide={() => { onDuplicateSlide(); setSheet("none"); }}
                  onDeleteSlide={() => { onDeleteSlide(); setSheet("none"); }}
                  onMoveSlideBack={() => { onMoveSlide(-1); }}
                  onMoveSlideForward={() => { onMoveSlide(1); }}
                  onUpgrade={() => { onUpgrade(); setSheet("none"); }}
                />
              )}

              {sheet === "inspect" && activeSlide && (
                <Inspector
                  isAr={isAr}
                  readOnly={readOnly}
                  slide={activeSlide}
                  selectedEl={selectedEl}
                  theme={theme}
                  pattern={pattern}
                  onChangeTheme={onChangeTheme}
                  onChangePattern={onChangePattern}
                  onUpdateSlide={onUpdateActiveSlide}
                  onUpdateEl={(patch) => selectedEl && onUpdateEl(selectedEl.id, patch)}
                  onRemoveEl={() => { if (selectedEl) { onRemoveEl(selectedEl.id); } }}
                  onDuplicateEl={() => { if (selectedEl) onDuplicateEl(selectedEl.id); }}
                  onMoveZ={(d) => { if (selectedEl) onMoveZ(selectedEl.id, d); }}
                  onPickImage={onPickImage}
                  onInsertElement={onInsertElement}
                  onOpenActivityPicker={onOpenActivityPicker}
                  onOpenVideoEmbedDialog={onOpenVideoEmbedDialog}
                  onOpenImageSearch={onOpenImageSearch}
                  uploading={uploading}
                  onDeselect={() => { onSelectEl(null); }}
                />
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes hasadSheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes hasadSheetFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .hasad-strip {
          scroll-behavior: smooth;
          scroll-snap-type: x mandatory;
          scroll-padding-inline: 12px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .hasad-strip::-webkit-scrollbar { display: none; }
        .hasad-strip > * { scroll-snap-align: center; }
      `}</style>
    </div>
  );
}

/* Mobile slide strip — horizontal, snap-scroll, auto-scrolls the
   active thumbnail into view, soft active ring (no jarring 2px
   gold border jump). */
function SlideStrip({
  slides, activeIdx, theme, pattern, readOnly, isAr, border,
  onSelectSlide, onAddSlide,
}: {
  slides: Slide[];
  activeIdx: number;
  theme: string;
  pattern: string;
  readOnly: boolean;
  isAr: boolean;
  border: string;
  onSelectSlide: (i: number) => void;
  onAddSlide: () => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* Smoothly center the active slide whenever it changes. */
  useEffect(() => {
    const el = itemRefs.current[activeIdx];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeIdx]);

  return (
    <div
      className="shrink-0 border-t bg-white px-3 py-2"
      style={{ borderColor: border }}
    >
      <div ref={stripRef} className="hasad-strip flex items-center gap-2 overflow-x-auto pb-1">
        {slides.map((s, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={s.id}
              ref={(node) => { itemRefs.current[i] = node; }}
              onClick={() => onSelectSlide(i)}
              className="relative shrink-0 overflow-hidden rounded-lg transition-[transform,box-shadow] duration-200"
              style={{
                width: 96,
                aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
                background: "#fff",
                border: `1px solid ${border}`,
                boxShadow: active
                  ? `0 0 0 2px ${BRAND_GREEN}, 0 6px 14px -8px rgba(34, 87, 57, 0.45)`
                  : "0 1px 2px rgba(15,23,42,0.04)",
                transform: active ? "translateY(-1px)" : "none",
              }}
              aria-label={isAr ? `الشريحة ${i + 1}` : `Slide ${i + 1}`}
              aria-current={active ? "true" : undefined}
            >
              <SlideThumbnail slide={s} theme={theme} pattern={pattern} />
              <span
                className="absolute top-0.5 start-0.5 px-1 rounded text-[8px] font-bold leading-none transition-colors"
                style={{
                  background: active ? BRAND_GREEN : "rgba(255,255,255,0.85)",
                  color: active ? "white" : "#475569",
                }}
              >
                {i + 1}
              </span>
              {(s.elements ?? []).some((el) => el.kind === "activity") && (
                <span
                  className="absolute top-0.5 end-0.5 w-2 h-2 rounded-full"
                  style={{ background: BRAND_GOLD }}
                  title={isAr ? "نشاط" : "Activity"}
                />
              )}
            </button>
          );
        })}
        <button
          onClick={onAddSlide}
          disabled={readOnly}
          className="flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed disabled:opacity-40 active:scale-95 transition-transform"
          style={{ width: 56, aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, borderColor: `${BRAND_GREEN}66`, color: BRAND_GREEN }}
          aria-label={isAr ? "شريحة جديدة" : "New slide"}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/* Add-element grid for the mobile bottom sheet. Mirrors the desktop
   "Elements" / "Text" / "Media" sections but as a single tappable
   grid sized for thumbs. */
function MobileAddGrid({
  isAr, uploading, readOnly,
  onAddText, onAddImage, onAddImageSearch, onAddShape, onAddIcon, onAddActivity,
  onOpenTheme, onOpenPattern, onOpenNotes,
}: {
  isAr: boolean;
  uploading: boolean;
  readOnly: boolean;
  onAddText: (big: boolean) => void;
  onAddImage: () => void;
  onAddImageSearch: () => void;
  onAddShape: () => void;
  onAddIcon: () => void;
  onAddActivity: () => void;
  onOpenTheme: () => void;
  onOpenPattern: () => void;
  onOpenNotes: () => void;
}) {
  const items: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    onClick: () => void;
    disabled?: boolean;
  }> = [
    { icon: TypeIcon, label: isAr ? "عنوان" : "Heading", color: BRAND_GREEN, onClick: () => onAddText(true) },
    { icon: TypeIcon, label: isAr ? "نص" : "Text", color: "#0EA5E9", onClick: () => onAddText(false) },
    { icon: ImageIcon, label: isAr ? "صورة" : "Image", color: "#A855F7", onClick: onAddImage, disabled: uploading },
    { icon: Search, label: isAr ? "بحث صورة" : "Web Image", color: "#8B5CF6", onClick: onAddImageSearch },
    { icon: Shapes, label: isAr ? "شكل" : "Shape", color: "#F59E0B", onClick: onAddShape },
    { icon: Smile, label: isAr ? "أيقونة" : "Icon", color: "#EC4899", onClick: onAddIcon },
    { icon: Sparkles, label: isAr ? "نشاط" : "Activity", color: BRAND_GREEN, onClick: onAddActivity },
    { icon: Palette, label: isAr ? "ثيم" : "Theme", color: "#475569", onClick: onOpenTheme },
    { icon: Layers, label: isAr ? "نقش" : "Pattern", color: "#0891B2", onClick: onOpenPattern },
    { icon: FileText, label: isAr ? "ملاحظات" : "Notes", color: "#94A3B8", onClick: onOpenNotes },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          disabled={readOnly || item.disabled}
          className="flex flex-col items-center gap-1.5 rounded-xl py-3 active:bg-slate-50 disabled:opacity-40"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: `${item.color}1A`, color: item.color }}
          >
            <item.icon className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium text-slate-700">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Keyboard Shortcuts Panel ─────────────────────────────────────── */
function KeyboardShortcutsPanel({ isAr, onClose }: { isAr: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sections: Array<{
    titleAr: string;
    titleEn: string;
    shortcuts: Array<{ keys: string[]; labelAr: string; labelEn: string }>;
  }> = [
    {
      titleAr: "عام",
      titleEn: "General",
      shortcuts: [
        { keys: ["Ctrl", "Z"],           labelAr: "تراجع",                   labelEn: "Undo" },
        { keys: ["Ctrl", "Y"],           labelAr: "إعادة",                   labelEn: "Redo" },
        { keys: ["Ctrl", "⇧", "Z"],     labelAr: "إعادة (بديل)",            labelEn: "Redo (alt)" },
        { keys: ["Ctrl", "S"],           labelAr: "حفظ الآن",                labelEn: "Save now" },
        { keys: ["Ctrl", "/"],           labelAr: "إظهار/إخفاء الاختصارات", labelEn: "Toggle shortcuts panel" },
      ],
    },
    {
      titleAr: "الشرائح",
      titleEn: "Slides",
      shortcuts: [
        { keys: ["Ctrl", "D"],           labelAr: "تكرار الشريحة الحالية",  labelEn: "Duplicate current slide" },
      ],
    },
    {
      titleAr: "العناصر",
      titleEn: "Elements",
      shortcuts: [
        { keys: ["Ctrl", "A"],           labelAr: "تحديد جميع العناصر",     labelEn: "Select all elements" },
        { keys: ["Del"],                 labelAr: "حذف العنصر المحدد",       labelEn: "Delete selected element" },
        { keys: ["Backspace"],           labelAr: "حذف العنصر المحدد",       labelEn: "Delete selected element" },
        { keys: ["Esc"],                 labelAr: "إلغاء التحديد",           labelEn: "Deselect / cancel edit" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        dir={isAr ? "rtl" : "ltr"}
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-slate-100"
          style={{ background: `#22573910` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight" style={{ color: "#225739" }}>
              {isAr ? "⌨️ اختصارات لوحة المفاتيح" : "⌨️ Keyboard Shortcuts"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5" style={{ maxHeight: "calc(90vh - 68px)" }}>
          {sections.map((section) => (
            <div key={section.titleEn}>
              <div
                className="text-[11px] font-extrabold uppercase tracking-wider mb-2.5"
                style={{ color: "#225739" }}
              >
                {isAr ? section.titleAr : section.titleEn}
              </div>
              <div className="space-y-1.5">
                {section.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-1">
                    <span className="text-sm text-slate-700 font-medium">
                      {isAr ? s.labelAr : s.labelEn}
                    </span>
                    {!isAr && (
                      <span className="text-xs text-slate-500 font-medium ms-1">
                        {s.labelAr}
                      </span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          <kbd
                            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[11px] font-black text-slate-600 border border-slate-300 shadow-[0_1px_0_rgba(0,0,0,0.15)]"
                            style={{ background: "#f6f8fa", minWidth: "1.6rem" }}
                          >
                            {k}
                          </kbd>
                          {ki < s.keys.length - 1 && (
                            <span className="text-[10px] text-slate-400 font-bold">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer hint */}
          <p className="text-[11px] text-slate-400 text-center pt-1 border-t border-slate-100">
            {isAr
              ? "اضغط Esc أو انقر خارج اللوحة للإغلاق"
              : "Press Esc or click outside to close"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* Bottom-sheet "more" menu — compact button list of every secondary
   toolbar action that doesn't fit in the 52px top bar. */
function MobileMoreMenu({
  isAr, readOnly, dirty, saving, savedAt, tier, hasActiveSlide, multipleSlides,
  canMoveBack, canMoveForward,
  onSave, onAi, onExportPdf, onExportPptx, onSessions, onGoLive,
  onPresentFromHere, onDuplicateSlide, onDeleteSlide,
  onMoveSlideBack, onMoveSlideForward, onUpgrade,
}: {
  isAr: boolean;
  readOnly: boolean;
  dirty: boolean;
  saving: boolean;
  savedAt: Date | null;
  tier: PresentationTierWithUsage | undefined;
  hasActiveSlide: boolean;
  multipleSlides: boolean;
  canMoveBack: boolean;
  canMoveForward: boolean;
  onSave: () => void;
  onAi: () => void;
  onExportPdf: () => void;
  onExportPptx: () => void;
  onSessions: () => void;
  onGoLive: () => void;
  onPresentFromHere: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onMoveSlideBack: () => void;
  onMoveSlideForward: () => void;
  onUpgrade: () => void;
}) {
  const Item = ({
    icon: Icon, label, onClick, disabled, danger, accent,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    accent?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold active:bg-slate-100 disabled:opacity-40"
      style={{
        color: danger ? "#dc2626" : accent ? BRAND_GREEN : "#1f2937",
        background: accent ? `${BRAND_GREEN}10` : undefined,
      }}
    >
      <Icon className="h-5 w-5" />
      <span className="flex-1 text-start">{label}</span>
    </button>
  );
  return (
    <div className="space-y-1">
      {/* Quiet save-status row — moved out of the top bar so the
          header can stay clean and content-first. */}
      <div className="px-3 pt-1 pb-2 text-[11px]">
        <SaveStatus dirty={dirty} savedAt={savedAt} saving={saving} isAr={isAr} />
      </div>
      <Item
        icon={Save}
        label={saving ? (isAr ? "جارٍ الحفظ…" : "Saving…") : (isAr ? "حفظ الآن" : "Save now")}
        onClick={onSave}
        disabled={!dirty || readOnly || saving}
      />
      <Item
        icon={Play}
        label={isAr ? "ابدأ من هذه الشريحة" : "Present from here"}
        onClick={onPresentFromHere}
        disabled={!hasActiveSlide}
        accent
      />
      <Item
        icon={Radio}
        label={isAr ? "بدء جلسة مباشرة" : "Go live"}
        onClick={onGoLive}
        disabled={readOnly}
      />
      <Item
        icon={Sparkles}
        label={isAr ? "اقترح خطة بالذكاء" : "AI outline"}
        onClick={onAi}
        disabled={readOnly}
      />
      <div className="my-2 h-px bg-slate-200" />
      <Item
        icon={isAr ? ArrowRight : ArrowLeft}
        label={isAr ? "نقل الشريحة للخلف" : "Move slide back"}
        onClick={onMoveSlideBack}
        disabled={readOnly || !canMoveBack}
      />
      <Item
        icon={isAr ? ArrowLeft : ArrowRight}
        label={isAr ? "نقل الشريحة للأمام" : "Move slide forward"}
        onClick={onMoveSlideForward}
        disabled={readOnly || !canMoveForward}
      />
      <Item
        icon={Copy}
        label={isAr ? "تكرار الشريحة" : "Duplicate slide"}
        onClick={onDuplicateSlide}
        disabled={readOnly || !hasActiveSlide}
      />
      <Item
        icon={Trash2}
        label={isAr ? "حذف الشريحة" : "Delete slide"}
        onClick={onDeleteSlide}
        disabled={readOnly || !multipleSlides}
        danger
      />
      <div className="my-2 h-px bg-slate-200" />
      <Item icon={FileText} label={isAr ? "تصدير PDF" : "Export PDF"} onClick={onExportPdf} />
      <Item icon={PresentationIcon} label={isAr ? "تصدير PPTX" : "Export PPTX"} onClick={onExportPptx} />
      <Item icon={History} label={isAr ? "الجلسات والنتائج" : "Sessions & results"} onClick={onSessions} />
      {tier && !tier.isPro && (
        <>
          <div className="my-2 h-px bg-slate-200" />
          <Item icon={Lock} label={isAr ? "ترقية إلى Pro" : "Upgrade to Pro"} onClick={onUpgrade} accent />
        </>
      )}
    </div>
  );
}
