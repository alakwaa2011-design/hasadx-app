import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import {
  Link2, Link2Off, Users, BookOpen,
  RefreshCw, CheckCircle2, AlertCircle, ExternalLink,
  ChevronDown, Loader2, Upload, ArrowLeft, Plus,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

const API = import.meta.env.VITE_API_URL || "";

// Microsoft Teams logo SVG icon
function TeamsIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="#5059C9" />
      <path d="M14.5 8.5C14.5 9.88 13.38 11 12 11C10.62 11 9.5 9.88 9.5 8.5C9.5 7.12 10.62 6 12 6C13.38 6 14.5 7.12 14.5 8.5Z" fill="white" />
      <path d="M16 11H8C7.45 11 7 11.45 7 12V16.5C7 17.05 7.45 17.5 8 17.5H16C16.55 17.5 17 17.05 17 16.5V12C17 11.45 16.55 11 16 11Z" fill="white" />
      <circle cx="17.5" cy="8" r="2.5" fill="#7B83EB" />
      <path d="M19.5 10.5H15.5V14C15.5 14.83 16.17 15.5 17 15.5H18C19.1 15.5 20 14.6 20 13.5V11C20 10.72 19.78 10.5 19.5 10.5Z" fill="#7B83EB" />
    </svg>
  );
}

interface TeamsClass {
  id: string;
  name: string;
  externalId?: string | null;
  mailNickname?: string | null;
  source: "education" | "teams";
}

interface TeamsMember {
  microsoftId?: string;
  name: string;
  email: string | null;
}

export default function TeamsPage() {
  const [, setLocation] = useLocation();
  const { data: teacher } = useGetCurrentTeacher();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [classes, setClasses] = useState<TeamsClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClass, setSelectedClass] = useState<TeamsClass | null>(null);
  const [members, setMembers] = useState<TeamsMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [importing, setImporting] = useState(false);
  const [targetClass, setTargetClass] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      toast.success("تم ربط Microsoft Teams بنجاح!");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error")) {
      const err = params.get("error");
      const msgs: Record<string, string> = {
        denied: "تم رفض الإذن من Microsoft",
        invalid_state: "خطأ في الاتصال، حاول مرة أخرى",
        callback_failed: "فشل الاتصال بـ Microsoft، حاول مرة أخرى",
      };
      toast.error(msgs[err!] || "حدث خطأ أثناء الاتصال");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetch(`${API}/api/teams/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!connected) { setClasses([]); return; }
    setLoadingClasses(true);
    fetch(`${API}/api/teams/classes`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setClasses(d.classes || []))
      .catch(() => toast.error("تعذّر جلب الفصول"))
      .finally(() => setLoadingClasses(false));
  }, [connected]);

  function handleConnect() {
    window.location.href = `${API}/api/teams/connect`;
  }

  async function handleDisconnect() {
    if (!confirm("هل تريد قطع الاتصال بـ Microsoft Teams؟")) return;
    setDisconnecting(true);
    try {
      const r = await fetch(`${API}/api/teams/disconnect`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.ok) {
        setConnected(false);
        setSelectedClass(null);
        setMembers([]);
        toast.success("تم قطع الاتصال");
      }
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSelectClass(cls: TeamsClass) {
    setSelectedClass(cls);
    setMembers([]);
    setLoadingMembers(true);
    try {
      const r = await fetch(
        `${API}/api/teams/classes/${cls.id}/members?source=${cls.source}`,
        { credentials: "include" },
      );
      const d = await r.json();
      setMembers(d.members || []);
    } catch {
      toast.error("تعذّر جلب الأعضاء");
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleImport() {
    if (!selectedClass) return;
    setImporting(true);
    try {
      const r = await fetch(`${API}/api/teams/classes/${selectedClass.id}/members/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetClass: targetClass.trim() || null,
          source: selectedClass.source,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message || `تم استيراد ${d.imported} طالب`);
      } else {
        toast.error(d.message || "فشل الاستيراد");
      }
    } catch {
      toast.error("حدث خطأ أثناء الاستيراد");
    } finally {
      setImporting(false);
    }
  }

  function refreshClasses() {
    setLoadingClasses(true);
    fetch(`${API}/api/teams/classes`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setClasses(d.classes || []))
      .catch(() => toast.error("تعذّر تحديث الفصول"))
      .finally(() => setLoadingClasses(false));
  }

  if (!teacher) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/teacher")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <TeamsIcon size={26} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Microsoft Teams</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">ربط منصتك بـ Microsoft Teams</p>
            </div>
          </div>
        </div>

        {/* Connection Status Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connected === null ? (
                <Loader2 className="animate-spin text-gray-400" size={20} />
              ) : connected ? (
                <CheckCircle2 className="text-emerald-500" size={22} />
              ) : (
                <AlertCircle className="text-gray-400" size={22} />
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  {connected === null
                    ? "جارٍ التحقق..."
                    : connected
                    ? "متصل بـ Microsoft Teams"
                    : "غير متصل"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {connected
                    ? "يمكنك استيراد الطلاب ونشر الواجبات"
                    : "اضغط لربط حسابك بـ Microsoft Teams"}
                </p>
              </div>
            </div>
            {connected === false && (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-4 py-2 bg-[#5059C9] hover:bg-[#3b47b8] text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Link2 size={16} />
                ربط الحساب
              </button>
            )}
            {connected === true && (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {disconnecting ? <Loader2 className="animate-spin" size={16} /> : <Link2Off size={16} />}
                قطع الاتصال
              </button>
            )}
          </div>
        </div>

        {/* Features Overview (when not connected) */}
        {connected === false && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">ما يمكنك فعله بعد الربط</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Users, title: "استيراد الطلاب", desc: "اجلب قائمة طلابك من فصولك في Teams" },
                { icon: BookOpen, title: "نشر الواجبات", desc: "أرسل الواجبات مباشرة إلى فصولك" },
                { icon: RefreshCw, title: "تتبع التسليمات", desc: "اطّلع على حالة تسليمات الطلاب" },
              ].map((f) => (
                <div key={f.title} className="flex flex-col gap-1.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <f.icon size={18} className="text-[#5059C9]" />
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Setup notice */}
            <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                <strong>ملاحظة للمسؤول:</strong> يتطلب هذا الربط تسجيل تطبيق في Azure AD وضبط متغيري البيئة
                {" "}<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">MICROSOFT_CLIENT_ID</code> و
                {" "}<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">MICROSOFT_CLIENT_SECRET</code>.
              </p>
            </div>
          </div>
        )}

        {/* Classes List */}
        {connected && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="font-semibold text-gray-800 dark:text-white text-sm">فصولك في Microsoft Teams</p>
              <button
                onClick={refreshClasses}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
              >
                <RefreshCw size={15} className={loadingClasses ? "animate-spin" : ""} />
              </button>
            </div>

            {loadingClasses ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-[#5059C9]" size={24} />
              </div>
            ) : classes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                <TeamsIcon size={32} />
                <p className="text-sm">لا توجد فصول نشطة</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => handleSelectClass(cls)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-right ${selectedClass?.id === cls.id ? "bg-indigo-50 dark:bg-indigo-900/20" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={15} className="text-[#5059C9]" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{cls.name}</p>
                        {cls.mailNickname && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{cls.mailNickname}</p>
                        )}
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${selectedClass?.id === cls.id ? "rotate-180" : ""}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members Panel */}
        {selectedClass && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="font-semibold text-gray-800 dark:text-white text-sm">
                أعضاء: {selectedClass.name}
              </p>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-[#5059C9]" size={24} />
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                <Users size={32} className="opacity-40" />
                <p className="text-sm">لا يوجد أعضاء في هذا الفصل</p>
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {members.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#5059C9]">
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">{m.name}</p>
                        {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {members.length} عضو — سيُضافون إلى قائمة طلابك في حصاد
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      placeholder="الصف / الفصل (اختياري)"
                      className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5059C9]"
                    />
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                    >
                      {importing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                      استيراد الطلاب
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Publish Assignment */}
        {connected && (
          <PublishAssignmentCard classes={classes} />
        )}
      </div>
    </Layout>
  );
}

function PublishAssignmentCard({ classes }: { classes: TeamsClass[] }) {
  const [classId, setClassId] = useState("");
  const [classSource, setClassSource] = useState<"education" | "teams">("education");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [dueDate, setDueDate] = useState("");
  const [publishing, setPublishing] = useState(false);

  const eduClasses = classes.filter((c) => c.source === "education");

  async function handlePublish() {
    if (!classId || !title.trim()) {
      toast.error("اختر فصلاً وأدخل عنوان الواجب");
      return;
    }
    if (classSource !== "education") {
      toast.error("نشر الواجبات متاح فقط لفصول Education في Microsoft Teams");
      return;
    }
    setPublishing(true);
    try {
      const body: any = { title, instructions, maxPoints: Number(maxPoints) || undefined };
      if (dueDate) body.dueDate = dueDate;

      const r = await fetch(`${API}/api/teams/classes/${classId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message || "تم نشر الواجب بنجاح");
        setTitle("");
        setInstructions("");
        setDueDate("");
      } else {
        toast.error(d.message || "فشل النشر");
      }
    } catch {
      toast.error("حدث خطأ أثناء النشر");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <p className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
          <Plus size={16} className="text-[#5059C9]" />
          نشر واجب في Microsoft Teams
        </p>
      </div>
      <div className="p-5 space-y-3">
        {eduClasses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            نشر الواجبات يتطلب فصولاً من نوع Education — لم يتم العثور على فصول Education في حسابك.
          </p>
        ) : (
          <>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                const cls = classes.find((c) => c.id === e.target.value);
                setClassSource(cls?.source ?? "education");
              }}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5059C9]"
            >
              <option value="">اختر الفصل</option>
              {eduClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الواجب *"
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5059C9]"
            />

            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="تعليمات الواجب (اختياري)"
              rows={2}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5059C9] resize-none"
            />

            <div className="flex gap-2">
              <input
                type="number"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                placeholder="الدرجة الكاملة"
                className="w-32 text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5059C9]"
              />
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5059C9]"
              />
            </div>

            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#5059C9] hover:bg-[#3b47b8] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {publishing ? <Loader2 className="animate-spin" size={16} /> : <ExternalLink size={16} />}
              نشر في Microsoft Teams
            </button>
          </>
        )}
      </div>
    </div>
  );
}
