import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { ArrowRight, ArrowLeft, EyeOff, Eye, Loader2, FileText, BookText, Video } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

type HiddenType = "assignment" | "question-bank" | "video-lesson";

interface HiddenItem {
  type: HiddenType;
  id: number;
  title: string;
  subject: string | null;
  teacherName: string | null;
  hiddenAt: string | null;
  hideReason: string | null;
  hiddenById: number | null;
  hiddenByName: string | null;
}

const TYPE_TO_PATH: Record<HiddenType, string> = {
  assignment: "assignments",
  "question-bank": "question-bank",
  "video-lesson": "video-lessons",
};

export default function HiddenByAdminPage() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [items, setItems] = useState<HiddenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | HiddenType>("all");
  const [unhiding, setUnhiding] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/hidden`, { credentials: "include" });
      if (!r.ok) {
        if (r.status === 403 || r.status === 401) {
          toast.error(lang === "ar" ? "غير مصرح" : "Unauthorized");
        } else {
          toast.error(lang === "ar" ? "تعذّر تحميل القائمة" : "Failed to load list");
        }
        setItems([]);
        return;
      }
      const data = await r.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUnhide = async (item: HiddenItem) => {
    const key = `${item.type}-${item.id}`;
    setUnhiding(key);
    try {
      const r = await fetch(
        `${API_BASE}/api/admin/${TYPE_TO_PATH[item.type]}/${item.id}/unhide`,
        { method: "PATCH", credentials: "include" },
      );
      if (!r.ok) {
        toast.error(lang === "ar" ? "تعذّر إلغاء الإخفاء" : "Failed to unhide");
        return;
      }
      setItems((prev) => prev.filter((x) => !(x.type === item.type && x.id === item.id)));
      toast.success(lang === "ar" ? "تم إظهار العنصر" : "Item restored");
    } finally {
      setUnhiding(null);
    }
  };

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const c = { all: items.length, assignment: 0, "question-bank": 0, "video-lesson": 0 } as Record<string, number>;
    for (const it of items) c[it.type]++;
    return c;
  }, [items]);

  const labelFor = (type: HiddenType) =>
    type === "assignment"
      ? (lang === "ar" ? "نشاط" : "Assignment")
      : type === "question-bank"
        ? (lang === "ar" ? "سؤال" : "Question")
        : (lang === "ar" ? "درس فيديو" : "Video lesson");

  const iconFor = (type: HiddenType) => {
    if (type === "assignment") return <FileText className="w-4 h-4" />;
    if (type === "question-bank") return <BookText className="w-4 h-4" />;
    return <Video className="w-4 h-4" />;
  };

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleString(lang === "ar" ? "ar-KW" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <Layout>
      <div dir={dir} className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/teacher/admin" className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
              {dir === "rtl" ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <EyeOff className="w-5 h-5 text-amber-600" />
                {lang === "ar" ? "العناصر المخفية بواسطة المسؤول" : "Hidden by admin"}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {lang === "ar"
                  ? "مراجعة العناصر التي تم إخفاؤها من المكتبات العامة وإمكانية إعادتها."
                  : "Review items hidden from public libraries and restore them."}
              </p>
            </div>
          </div>
          <Button onClick={load} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? "تحديث" : "Refresh")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "assignment", "question-bank", "video-lesson"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                filter === key
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-400"
              }`}
            >
              {key === "all"
                ? (lang === "ar" ? "الكل" : "All")
                : labelFor(key as HiddenType)}{" "}
              <span className="opacity-70">({counts[key] ?? 0})</span>
            </button>
          ))}
        </div>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin inline-block" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              {lang === "ar" ? "لا توجد عناصر مخفية." : "No hidden items."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="text-start px-3 py-2 font-medium">{lang === "ar" ? "النوع" : "Type"}</th>
                    <th className="text-start px-3 py-2 font-medium">{lang === "ar" ? "العنوان" : "Title"}</th>
                    <th className="text-start px-3 py-2 font-medium">{lang === "ar" ? "صاحب المحتوى" : "Owner"}</th>
                    <th className="text-start px-3 py-2 font-medium">{lang === "ar" ? "السبب" : "Reason"}</th>
                    <th className="text-start px-3 py-2 font-medium">{lang === "ar" ? "أخفاه" : "Hidden by"}</th>
                    <th className="text-start px-3 py-2 font-medium">{lang === "ar" ? "تاريخ الإخفاء" : "Hidden at"}</th>
                    <th className="text-end px-3 py-2 font-medium">{lang === "ar" ? "إجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((item) => {
                    const key = `${item.type}-${item.id}`;
                    return (
                      <tr key={key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                            {iconFor(item.type)}
                            {labelFor(item.type)}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-xs">
                          <div className="font-medium truncate" title={item.title}>{item.title}</div>
                          {item.subject ? (
                            <div className="text-xs text-slate-500 truncate">{item.subject}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {item.teacherName ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs">
                          <div className="truncate" title={item.hideReason ?? ""}>
                            {item.hideReason ?? "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {item.hiddenByName ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmt(item.hiddenAt)}</td>
                        <td className="px-3 py-2 text-end whitespace-nowrap">
                          <Button
                            onClick={() => handleUnhide(item)}
                            disabled={unhiding === key}
                          >
                            {unhiding === key ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {lang === "ar" ? "إظهار" : "Unhide"}
                              </span>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
