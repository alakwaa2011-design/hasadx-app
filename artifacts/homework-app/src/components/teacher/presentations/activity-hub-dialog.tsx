/**
 * ActivityHubDialog — unified entry-point for adding activities to a slide.
 *
 * Two cards:
 *  1) "نشاط من حصاد"  — browse teacher's assignments → inserts a
 *     `hasad-activity` slide element (launched in live mode later).
 *  2) "أنشطة العرض"   — delegate to the existing ActivityPickerDialog
 *     (word cloud, MCQ, response wall, etc.)
 *
 * Props:
 *  - open            — visibility gate
 *  - onClose         — close without action
 *  - initialTab      — which tab to open on ("hasad" | "presentation")
 *  - onPickHasad     — called with the new hasad-activity SlideElement
 *  - onPickPresentation — called when the user chooses "أنشطة العرض";
 *                        parent should then open ActivityPickerDialog
 *  - isAr            — language / direction flag
 */
import { useEffect, useMemo, useState } from "react";
import type { SlideElement } from "@workspace/api-client-react";
import {
  useListAssignments,
  getListAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { Loader2, Search, Plus, ExternalLink, Gamepad2, Sparkles, ArrowRight, Check } from "lucide-react";

const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

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

  /* Reset state when the dialog opens or when its initialTab changes */
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setSearch("");
    }
  }, [open, initialTab]);

  if (!open) return null;

  const pickHasadAssignment = (a: { id: number; title?: string | null }) => {
    const el: SlideElement = {
      id: genId("ha"),
      kind: "hasad-activity",
      assignmentId: a.id,
      assignmentTitle: a.title ?? undefined,
      x: 100,
      y: 100,
      w: 1000,
      h: 480,
    } as unknown as SlideElement;
    onPickHasad(el);
    onClose();
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
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-border flex items-center justify-between"
          style={{ background: `${BRAND_GREEN}08` }}
        >
          <div className="flex items-center gap-3">
            {tab !== "home" && (
              <button
                onClick={() => setTab("home")}
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
              <Sparkles className="w-4.5 h-4.5" />
              {tab === "home"
                ? isAr ? "إضافة نشاط" : "Add Activity"
                : tab === "hasad"
                  ? isAr ? "نشاط من حصاد" : "Hasad Activity"
                  : isAr ? "أنشطة العرض" : "Presentation Activities"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── HOME: two big option cards ── */}
          {tab === "home" && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Hasad Activity */}
              <button
                onClick={() => setTab("hasad")}
                className="group flex flex-col items-start gap-3 p-5 rounded-2xl border-2 border-transparent text-start transition-all hover:shadow-lg active:scale-[0.98]"
                style={{
                  background: `${BRAND_GREEN}08`,
                  borderColor: `${BRAND_GREEN}20`,
                }}
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
                      ? "اختر واجباً من منصة حصاد ليُشغَّل مباشرةً أثناء عرضك"
                      : "Pick a Hasad assignment to launch live during your presentation"}
                  </div>
                </div>
                <div
                  className="mt-auto text-xs font-bold flex items-center gap-1"
                  style={{ color: BRAND_GREEN }}
                >
                  {isAr ? "اختر نشاطاً" : "Pick an activity"}
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Card 2: Presentation Activities */}
              <button
                onClick={() => {
                  onClose();
                  onPickPresentation();
                }}
                className="group flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-start transition-all hover:shadow-lg active:scale-[0.98]"
                style={{
                  background: `${BRAND_GOLD}0a`,
                  borderColor: `${BRAND_GOLD}30`,
                }}
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
                <div
                  className="mt-auto text-xs font-bold flex items-center gap-1"
                  style={{ color: "#92710a" }}
                >
                  {isAr ? "أنشئ نشاطاً" : "Create activity"}
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
                </div>
              </button>
            </div>
          )}

          {/* ── HASAD: assignment browser ── */}
          {tab === "hasad" && (
            <div className="flex flex-col h-full">
              {/* Search bar */}
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

              {/* List */}
              <div className="flex-1 overflow-y-auto max-h-[50vh]">
                {assignmentsQ.isLoading && (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
                {!assignmentsQ.isLoading && filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Gamepad2 className="w-8 h-8 opacity-30" />
                    <p className="text-sm">
                      {isAr ? "لا توجد نشاطات." : "No activities found."}
                    </p>
                  </div>
                )}
                {!assignmentsQ.isLoading && filtered.length > 0 && (
                  <ul className="divide-y divide-border">
                    {filtered.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => pickHasadAssignment(a)}
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
                          <Check
                            className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: BRAND_GREEN }}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer: create new */}
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
        </div>
      </div>
    </div>
  );
}
