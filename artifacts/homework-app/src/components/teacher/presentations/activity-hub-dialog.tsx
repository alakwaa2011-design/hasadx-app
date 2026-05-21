/**
 * ActivityHubDialog — unified entry-point for adding activities to a slide.
 *
 * Flow:
 *  home → pick "نشاط من حصاد"  → assignment list → game type picker → insert element
 *  home → pick "أنشطة العرض"   → closes & delegates to ActivityPickerDialog
 */
import { useEffect, useMemo, useState } from "react";
import type { SlideElement } from "@workspace/api-client-react";
import {
  useListAssignments,
  getListAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { Loader2, Search, Plus, ExternalLink, Gamepad2, Sparkles, ArrowRight, Check } from "lucide-react";

const BRAND_GREEN = "#225739";
const BRAND_GOLD  = "#D9A521";

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const HASAD_GAMES = [
  { id: "knowledge_race", emoji: "⚡", nameAr: "وميض", nameEn: "Wameeth", descAr: "لعبة مباشرة سريعة", descEn: "Fast live game" },
  { id: "hack", emoji: "🛡️", nameAr: "لعبة الاختراق", nameEn: "Hack Mode", descAr: "تحدي وسرقة نقاط", descEn: "Hack and steal points" },
  { id: "tug_of_war", emoji: "🪢", nameAr: "شد الحبل", nameEn: "Tug of War", descAr: "فرق تتنافس بسحب الحبل", descEn: "Team tug battle" },
  { id: "million", emoji: "💰", nameAr: "من سيحصد المليون", nameEn: "Who Gets the Million", descAr: "سلم أسئلة متدرج", descEn: "Million ladder quiz" },
  { id: "rocket_race", emoji: "🚀", nameAr: "سباق الصواريخ", nameEn: "Rocket Race", descAr: "سباق سريع بالإجابات", descEn: "Answer-powered race" },
  { id: "wheel", emoji: "🎡", nameAr: "عجلة الحظ", nameEn: "Wheel of Fortune", descAr: "اختيار عشوائي ممتع", descEn: "Spin and play" },
] as const;
type HasadGameId = (typeof HASAD_GAMES)[number]["id"];

type HubTab = "home" | "hasad" | "presentation";

export function ActivityHubDialog({
  open,
  onClose,
  initialTab = "home",
  onPickHasad,
  onPickPresentation,
  isAr,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: "home" | "hasad" | "presentation";
  onPickHasad: (el: SlideElement) => void;
  onPickPresentation: () => void;
  isAr: boolean;
}) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [search, setSearch] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<{
    id: number;
    title?: string | null;
  } | null>(null);

  const assignmentsQ = useListAssignments(undefined, {
    query: {
      enabled: open && tab === "hasad",
      queryKey: getListAssignmentsQueryKey(),
    },
  });

  const filtered = useMemo(() => {
    const rows = assignmentsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => (a.title ?? "").toLowerCase().includes(q));
  }, [assignmentsQ.data, search]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setSearch("");
      setSelectedAssignment(null);
    }
  }, [open, initialTab]);

  if (!open) return null;

  /* Insert element after both assignment and game type are chosen */
  const pickHasadWithGame = (gameId: HasadGameId) => {
    if (!selectedAssignment) return;
    const el: SlideElement = {
      id: genId("ha"),
      kind: "hasad-activity",
      assignmentId: selectedAssignment.id,
      assignmentTitle: selectedAssignment.title ?? undefined,
      gameType: gameId,
      x: 100,
      y: 100,
      w: 1000,
      h: 480,
    } as unknown as SlideElement;
    onPickHasad(el);
    onClose();
  };

  /* Header label changes based on current step */
  const headerLabel = (() => {
    if (tab === "home") return isAr ? "إضافة نشاط" : "Add Activity";
    if (tab === "hasad" && selectedAssignment !== null)
      return isAr ? "اختر نوع اللعبة" : "Choose Game Type";
    if (tab === "hasad") return isAr ? "نشاط من حصاد" : "Hasad Activity";
    return isAr ? "أنشطة العرض" : "Presentation Activities";
  })();

  const canGoBack = tab !== "home" || selectedAssignment !== null;
  const handleBack = () => {
    if (selectedAssignment !== null) {
      setSelectedAssignment(null);
    } else {
      setTab("home");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        dir={isAr ? "rtl" : "ltr"}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="px-6 py-4 border-b border-border flex items-center justify-between"
          style={{ background: `${BRAND_GREEN}08` }}
        >
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="w-7 h-7 rounded-lg hover:bg-black/5 flex items-center justify-center text-muted-foreground transition-colors"
                title={isAr ? "رجوع" : "Back"}
              >
                <ArrowRight className={`w-4 h-4 ${isAr ? "" : "rotate-180"}`} />
              </button>
            )}
            <h2
              className="text-base font-extrabold flex items-center gap-2"
              style={{ color: BRAND_GREEN }}
            >
              <Sparkles className="w-4 h-4" />
              {headerLabel}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── HOME: two big option cards ── */}
          {tab === "home" && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setTab("hasad")}
                className="group flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-start transition-all hover:shadow-lg active:scale-[0.98]"
                style={{ background: `${BRAND_GREEN}08`, borderColor: `${BRAND_GREEN}20` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = BRAND_GREEN;
                  e.currentTarget.style.background = `${BRAND_GREEN}0f`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${BRAND_GREEN}20`;
                  e.currentTarget.style.background = `${BRAND_GREEN}08`;
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: BRAND_GREEN }}
                >
                  <Gamepad2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-extrabold text-sm" style={{ color: BRAND_GREEN }}>
                    {isAr ? "نشاط من حصاد" : "Hasad Activity"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {isAr
                      ? "اختر واجباً من حصاد وألعابه التعليمية ليُشغَّل أثناء عرضك"
                      : "Pick a Hasad assignment and its educational games to launch during your presentation"}
                  </div>
                </div>
                <div className="mt-auto text-xs font-bold flex items-center gap-1" style={{ color: BRAND_GREEN }}>
                  {isAr ? "اختر نشاطاً" : "Pick an activity"}
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
                </div>
              </button>

              <button
                onClick={() => { onClose(); onPickPresentation(); }}
                className="group flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-start transition-all hover:shadow-lg active:scale-[0.98]"
                style={{ background: `${BRAND_GOLD}0a`, borderColor: `${BRAND_GOLD}30` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = BRAND_GOLD;
                  e.currentTarget.style.background = `${BRAND_GOLD}14`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${BRAND_GOLD}30`;
                  e.currentTarget.style.background = `${BRAND_GOLD}0a`;
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: BRAND_GOLD }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-extrabold text-sm" style={{ color: "#92710a" }}>
                    {isAr ? "أنشطة العرض" : "Slide Activities"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {isAr
                      ? "سحابة كلمات، اختيار من متعدد، جدار ردود، تصويت، وغيرها"
                      : "Word cloud, MCQ, response wall, poll, and more"}
                  </div>
                </div>
                <div className="mt-auto text-xs font-bold flex items-center gap-1" style={{ color: "#92710a" }}>
                  {isAr ? "أنشئ نشاطاً" : "Create activity"}
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
                </div>
              </button>
            </div>
          )}

          {/* ── HASAD: assignment browser ── */}
          {tab === "hasad" && selectedAssignment === null && (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search className="w-4 h-4 absolute top-2.5 start-3 text-muted-foreground pointer-events-none" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={isAr ? "ابحث في نشاطاتك…" : "Search your activities…"}
                    className="w-full ps-9 pe-3 py-2 text-sm border border-border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[50vh]">
                {assignmentsQ.isLoading && (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
                {!assignmentsQ.isLoading && filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Gamepad2 className="w-8 h-8 opacity-30" />
                    <p className="text-sm">{isAr ? "لا توجد نشاطات." : "No activities found."}</p>
                  </div>
                )}
                {!assignmentsQ.isLoading && filtered.length > 0 && (
                  <ul className="divide-y divide-border">
                    {filtered.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => setSelectedAssignment({ id: a.id, title: a.title })}
                          className="w-full px-4 py-3 text-start flex items-center gap-3 hover:bg-emerald-50/50 transition-colors group"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${BRAND_GREEN}12` }}
                          >
                            <Gamepad2 className="w-4 h-4" style={{ color: BRAND_GREEN }} />
                          </div>
                          <span className="flex-1 truncate text-sm font-medium text-foreground">
                            {a.title ?? (isAr ? "بلا عنوان" : "Untitled")}
                          </span>
                          <ArrowRight
                            className={`w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity ${isAr ? "rotate-180" : ""}`}
                            style={{ color: BRAND_GREEN }}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-border">
                <a
                  href="/teacher/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-3 text-start text-xs font-bold flex items-center gap-2 hover:bg-emerald-50/60 transition-colors"
                  style={{ color: BRAND_GREEN }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAr ? "إنشاء نشاط جديد" : "Create new activity"}
                  <ExternalLink className="w-3 h-3 opacity-60 ms-auto" />
                </a>
              </div>
            </div>
          )}

          {/* ── GAME PICKER: shown after assignment is selected ── */}
          {tab === "hasad" && selectedAssignment !== null && (
            <div className="p-6">
              {/* Selected assignment chip */}
              <div
                className="mb-5 p-3 rounded-xl flex items-center gap-3 border"
                style={{ background: `${BRAND_GREEN}08`, borderColor: `${BRAND_GREEN}20` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: BRAND_GREEN }}
                >
                  <Gamepad2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground mb-0.5">
                    {isAr ? "الواجب المختار" : "Selected assignment"}
                  </div>
                  <div className="font-bold text-sm truncate" style={{ color: BRAND_GREEN }}>
                    {selectedAssignment.title ?? (isAr ? "بلا عنوان" : "Untitled")}
                  </div>
                </div>
                <Check className="w-4 h-4 ms-auto shrink-0" style={{ color: BRAND_GREEN }} />
              </div>

              <p className="text-sm font-extrabold mb-4" style={{ color: BRAND_GREEN }}>
                {isAr ? "اختر نوع اللعبة التعليمية" : "Choose the educational game type"}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {HASAD_GAMES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => pickHasadWithGame(game.id)}
                    className="flex items-center gap-3 p-4 rounded-2xl border-2 transition-all hover:shadow-md active:scale-[0.98] text-start"
                    style={{ borderColor: `${BRAND_GREEN}25`, background: `${BRAND_GREEN}05` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = BRAND_GREEN;
                      e.currentTarget.style.background = `${BRAND_GREEN}0f`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${BRAND_GREEN}25`;
                      e.currentTarget.style.background = `${BRAND_GREEN}05`;
                    }}
                  >
                    <span className="text-3xl leading-none shrink-0">{game.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-snug" style={{ color: BRAND_GREEN }}>
                        {isAr ? game.nameAr : game.nameEn}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        {isAr ? game.descAr : game.descEn}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
