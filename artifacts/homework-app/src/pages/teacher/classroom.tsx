import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import {
  GraduationCap, Link2, Link2Off, Users, BookOpen,
  RefreshCw, CheckCircle2, AlertCircle, ExternalLink,
  ChevronDown, Loader2, Upload, ArrowLeft, Plus,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

const API = import.meta.env.VITE_API_URL || "";

interface Course {
  id: string;
  name: string;
  section?: string;
  room?: string;
  enrollmentCode?: string;
}

interface GClassroomStudent {
  googleId?: string;
  name: string;
  email?: string;
}

export default function ClassroomPage() {
  const [, setLocation] = useLocation();
  const { data: teacher } = useGetCurrentTeacher();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<GClassroomStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [importing, setImporting] = useState(false);
  const [targetClass, setTargetClass] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  // Check URL params for connection result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      toast.success("تم ربط Google Classroom بنجاح!");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error")) {
      const err = params.get("error");
      const msgs: Record<string, string> = {
        denied: "تم رفض الإذن من Google",
        invalid_state: "خطأ في الاتصال، حاول مرة أخرى",
        callback_failed: "فشل الاتصال بـ Google، حاول مرة أخرى",
      };
      toast.error(msgs[err!] || "حدث خطأ أثناء الاتصال");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch connection status
  useEffect(() => {
    fetch(`${API}/api/classroom/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, []);

  // Fetch courses when connected
  useEffect(() => {
    if (!connected) { setCourses([]); return; }
    setLoadingCourses(true);
    fetch(`${API}/api/classroom/courses`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setCourses(d.courses || []))
      .catch(() => toast.error("تعذّر جلب المقررات"))
      .finally(() => setLoadingCourses(false));
  }, [connected]);

  async function handleConnect() {
    window.location.href = `${API}/api/classroom/connect`;
  }

  async function handleDisconnect() {
    if (!confirm("هل تريد قطع الاتصال بـ Google Classroom؟")) return;
    setDisconnecting(true);
    try {
      const r = await fetch(`${API}/api/classroom/disconnect`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.ok) {
        setConnected(false);
        setSelectedCourse(null);
        setStudents([]);
        toast.success("تم قطع الاتصال");
      }
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSelectCourse(course: Course) {
    setSelectedCourse(course);
    setStudents([]);
    setLoadingStudents(true);
    try {
      const r = await fetch(`${API}/api/classroom/courses/${course.id}/students`, { credentials: "include" });
      const d = await r.json();
      setStudents(d.students || []);
    } catch {
      toast.error("تعذّر جلب الطلاب");
    } finally {
      setLoadingStudents(false);
    }
  }

  async function handleImport() {
    if (!selectedCourse) return;
    setImporting(true);
    try {
      const r = await fetch(`${API}/api/classroom/courses/${selectedCourse.id}/students/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetClass: targetClass.trim() || null }),
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
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <GraduationCap className="text-blue-600 dark:text-blue-400" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Google Classroom</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">ربط منصتك بـ Google Classroom</p>
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
                    ? "متصل بـ Google Classroom"
                    : "غير متصل"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {connected
                    ? "يمكنك استيراد الطلاب ونشر الواجبات"
                    : "اضغط لربط حسابك بـ Google Classroom"}
                </p>
              </div>
            </div>
            {connected === false && (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
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
                { icon: Users, title: "استيراد الطلاب", desc: "اجلب قائمة طلابك مباشرة من مقرراتك" },
                { icon: BookOpen, title: "نشر الواجبات", desc: "أرسل الواجبات إلى طلابك في Classroom" },
                { icon: RefreshCw, title: "مزامنة الدرجات", desc: "اطّلع على درجات التسليمات" },
              ].map((f) => (
                <div key={f.title} className="flex flex-col gap-1.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <f.icon size={18} className="text-blue-500" />
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Courses List (when connected) */}
        {connected && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="font-semibold text-gray-800 dark:text-white text-sm">مقرراتك في Google Classroom</p>
              <button
                onClick={() => {
                  setLoadingCourses(true);
                  fetch(`${API}/api/classroom/courses`, { credentials: "include" })
                    .then((r) => r.json())
                    .then((d) => setCourses(d.courses || []))
                    .catch(() => toast.error("تعذّر تحديث المقررات"))
                    .finally(() => setLoadingCourses(false));
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
              >
                <RefreshCw size={15} className={loadingCourses ? "animate-spin" : ""} />
              </button>
            </div>

            {loadingCourses ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-blue-500" size={24} />
              </div>
            ) : courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                <GraduationCap size={32} className="opacity-40" />
                <p className="text-sm">لا توجد مقررات نشطة</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => handleSelectCourse(course)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-right ${selectedCourse?.id === course.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={15} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{course.name}</p>
                        {course.section && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{course.section}</p>
                        )}
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${selectedCourse?.id === course.id ? "rotate-180" : ""}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Students Panel */}
        {selectedCourse && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="font-semibold text-gray-800 dark:text-white text-sm">
                طلاب: {selectedCourse.name}
              </p>
            </div>

            {loadingStudents ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-blue-500" size={24} />
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                <Users size={32} className="opacity-40" />
                <p className="text-sm">لا يوجد طلاب في هذا المقرر</p>
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {students.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-600 dark:text-blue-400">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">{s.name}</p>
                        {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Import Controls */}
                <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {students.length} طالب — سيُضافون إلى قائمة طلابك في حصاد
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      placeholder="الصف / الفصل (اختياري)"
                      className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                    >
                      {importing ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Upload size={16} />
                      )}
                      استيراد الطلاب
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Publish Assignment Card */}
        {connected && (
          <PublishAssignmentCard courses={courses} />
        )}
      </div>
    </Layout>
  );
}

// ── Publish Assignment Sub-component ──────────────────────────────────────
function PublishAssignmentCard({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [dueDate, setDueDate] = useState("");
  const [publishing, setPublishing] = useState(false);

  const API = import.meta.env.VITE_API_URL || "";

  async function handlePublish() {
    if (!courseId || !title.trim()) {
      toast.error("اختر مقررًا وأدخل عنوان الواجب");
      return;
    }
    setPublishing(true);
    try {
      const body: any = { title, description, maxPoints: Number(maxPoints) || undefined };
      if (dueDate) body.dueDate = dueDate;

      const r = await fetch(`${API}/api/classroom/courses/${courseId}/coursework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message || "تم نشر الواجب بنجاح");
        setTitle("");
        setDescription("");
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
          <Plus size={16} className="text-blue-500" />
          نشر واجب في Google Classroom
        </p>
      </div>
      <div className="p-5 space-y-3">
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">اختر المقرر</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` — ${c.section}` : ""}</option>
          ))}
        </select>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان الواجب *"
          className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="وصف الواجب (اختياري)"
          rows={2}
          className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />

        <div className="flex gap-2">
          <input
            type="number"
            value={maxPoints}
            onChange={(e) => setMaxPoints(e.target.value)}
            placeholder="الدرجة الكاملة"
            className="w-32 text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handlePublish}
          disabled={publishing}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {publishing ? <Loader2 className="animate-spin" size={16} /> : <ExternalLink size={16} />}
          نشر في Google Classroom
        </button>
      </div>
    </div>
  );
}
