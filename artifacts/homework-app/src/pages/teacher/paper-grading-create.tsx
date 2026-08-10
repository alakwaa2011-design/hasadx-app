/**
 * Standalone "تصحيح ورقي ذكي" creation page.
 * A simplified, focused form for creating a paper-based activity
 * that students photograph and submit for AI grading.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateAssignment } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { fileToBase64 } from "@/lib/utils";
import {
  ArrowRight, ArrowLeft, Brain, Star, Calendar,
  BookOpen, Users, Loader2, CheckCircle2, ChevronDown,
  Image as ImageIcon, Upload, X, Camera, FileText, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface TeacherClass {
  id: number;
  name: string;
  grade?: string;
}

export default function PaperGradingCreate() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";

  // Form state
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [totalPoints, setTotalPoints] = useState<number>(10);
  const [aiInstructions, setAiInstructions] = useState("");
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const modelImageRef = useRef<HTMLInputElement>(null);

  // Worksheets already linked to smart grading — offered as a fast path
  const [gradableWorksheets, setGradableWorksheets] = useState<
    { id: number; title: string; subject?: string | null }[]
  >([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/worksheets`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : []))
      .then((rows) =>
        setGradableWorksheets(
          (Array.isArray(rows) ? rows : [])
            .filter((w: any) => w.linkedAssignmentId != null)
            .map((w: any) => ({ id: w.id, title: w.title, subject: w.subject }))
        )
      )
      .catch(() => {});
  }, []);

  // واجبات وأنشطة المعلم الحالية — يمكن تصحيح أي منها بالتصوير مباشرة
  const [gradableAssignments, setGradableAssignments] = useState<
    { id: number; title: string; subject?: string | null }[]
  >([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/assignments`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : []))
      .then((rows) =>
        setGradableAssignments(
          (Array.isArray(rows) ? rows : [])
            .filter((a: any) => a.isOwn)
            .map((a: any) => ({ id: a.id, title: a.title, subject: a.subject }))
        )
      )
      .catch(() => {});
  }, []);

  // Class list
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const classPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/classes`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setClasses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!classPickerOpen) return;
    const fn = (e: MouseEvent) => {
      if (classPickerRef.current && !classPickerRef.current.contains(e.target as Node)) {
        setClassPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [classPickerOpen]);

  const toggleClass = (name: string) =>
    setTargetClasses(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );

  const handleModelImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setModelImage(base64);
    }
    e.target.value = "";
  };

  const createMutation = useCreateAssignment({
    mutation: {
      onSuccess: () => {
        toast.success(isAr ? "تم إنشاء النشاط الورقي بنجاح 🎉" : "Paper activity created successfully 🎉");
        setLocation("/teacher");
      },
      onError: (err: any) => {
        toast.error(err.message || (isAr ? "حدث خطأ أثناء الإنشاء" : "Error creating assignment"));
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(isAr ? "يجب إدخال عنوان النشاط الورقي" : "Please enter a paper activity title");
      return;
    }
    if (!totalPoints || totalPoints < 1) {
      toast.error(isAr ? "يجب تحديد الدرجة الكلية" : "Please enter total points");
      return;
    }
    createMutation.mutate({
      data: {
        title: title.trim(),
        subject: subject.trim() || undefined,
        submissionMode: "paper",
        questions: [{ text: isAr ? "إجابة الورقة" : "Paper Answer", points: totalPoints }],
        aiGradingInstructions: aiInstructions.trim() || undefined,
        modelImageBase64: modelImage || undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        targetClasses: targetClasses.length > 0 ? targetClasses : undefined,
        targetClass: targetClasses[0] || undefined,
        showResults: true,
      } as any
    });
  };

  const isLoading = createMutation.isPending;

  // أقسام التصحيح السريع تبدأ مطوية لتبقى الصفحة هادئة — قسم واحد مفتوح كحد أقصى
  const [expandedSection, setExpandedSection] = useState<"worksheets" | "assignments" | null>(null);
  const toggleSection = (s: "worksheets" | "assignments") =>
    setExpandedSection(prev => (prev === s ? null : s));

  return (
    <div dir={dir} className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-24 font-display">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
        <button
          type="button"
          onClick={() => setLocation("/teacher/new")}
          className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
          aria-label={isAr ? "رجوع" : "Back"}
        >
          {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
              {isAr ? "تصحيح ورقي بالذكاء الاصطناعي" : "AI Paper Grading"}
            </h1>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
              {isAr 
                ? "إعداد سريع لتصوير أوراق الطلاب وتصحيحها ذكياً" 
                : "Quick setup to scan and grade student papers"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-8">
        {/* Quick-grade: collapsible sections keep the page calm */}
        {(gradableWorksheets.length > 0 || gradableAssignments.length > 0) && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
            {gradableWorksheets.length > 0 && (
              <section className="rounded-3xl bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("worksheets")}
                  className="w-full flex items-center gap-3 p-4 sm:p-5 text-start hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition-colors"
                  data-testid="btn-toggle-worksheets-section"
                  aria-expanded={expandedSection === "worksheets"}
                >
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                      {isAr ? "تصحيح سريع لورقة عمل جاهزة" : "Quick-grade existing worksheet"}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate">
                      {isAr ? "أوراق عمل حصاد ذات التصحيح الإلكتروني" : "Hasaad worksheets with smart grading"}
                    </p>
                  </div>
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                    {gradableWorksheets.length}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${expandedSection === "worksheets" ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {expandedSection === "worksheets" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 pt-1 max-h-[50vh] overflow-y-auto">
                        {gradableWorksheets.map(w => (
                          <button
                            key={w.id}
                            onClick={() => setLocation(`/teacher/worksheets/${w.id}/grade`)}
                            className="group flex flex-col text-start p-4 rounded-2xl bg-[#f4f7f5] dark:bg-[#0B100E] border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-white dark:hover:bg-[#111A16] shadow-sm hover:shadow-md transition-all"
                            data-testid={`btn-quickgrade-worksheet-${w.id}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2 w-full">
                              <FileText className="w-5 h-5 text-emerald-600/70 group-hover:text-emerald-500 transition-colors shrink-0 mt-0.5" />
                              <span className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-emerald-500 group-hover:text-white dark:group-hover:bg-emerald-600 dark:group-hover:text-white transition-colors shadow-sm shrink-0">
                                <Camera className="w-3.5 h-3.5" /> {isAr ? "تصوير" : "Scan"}
                              </span>
                            </div>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200 line-clamp-1 mb-1 w-full">
                              {w.title || (isAr ? "(بدون عنوان)" : "(untitled)")}
                            </span>
                            {w.subject && (
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-500 truncate w-full">
                                {w.subject}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {gradableAssignments.length > 0 && (
              <section className="rounded-3xl bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("assignments")}
                  className="w-full flex items-center gap-3 p-4 sm:p-5 text-start hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition-colors"
                  data-testid="btn-toggle-assignments-section"
                  aria-expanded={expandedSection === "assignments"}
                >
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                      {isAr ? "تصحيح واجب أو نشاط موجود" : "Grade an existing assignment"}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate">
                      {isAr
                        ? "صوّر أوراق طلابك لأي واجب أنشأته سابقاً"
                        : "Scan student papers for any assignment you created"}
                    </p>
                  </div>
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                    {gradableAssignments.length}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${expandedSection === "assignments" ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {expandedSection === "assignments" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 pt-1 max-h-[50vh] overflow-y-auto">
                        {gradableAssignments.map(a => (
                          <button
                            key={a.id}
                            onClick={() => setLocation(`/teacher/assignments/${a.id}/grade`)}
                            className="group flex flex-col text-start p-4 rounded-2xl bg-[#f4f7f5] dark:bg-[#0B100E] border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-white dark:hover:bg-[#111A16] shadow-sm hover:shadow-md transition-all"
                            data-testid={`btn-quickgrade-assignment-${a.id}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2 w-full">
                              <FileText className="w-5 h-5 text-emerald-600/70 group-hover:text-emerald-500 transition-colors shrink-0 mt-0.5" />
                              <span className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-emerald-500 group-hover:text-white dark:group-hover:bg-emerald-600 dark:group-hover:text-white transition-colors shadow-sm shrink-0">
                                <Camera className="w-3.5 h-3.5" /> {isAr ? "تصوير" : "Scan"}
                              </span>
                            </div>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200 line-clamp-1 mb-1 w-full">
                              {a.title || (isAr ? "(بدون عنوان)" : "(untitled)")}
                            </span>
                            {a.subject && (
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-500 truncate w-full">
                                {a.subject}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}
          </div>
        )}

        <section className="relative">
          {gradableWorksheets.length > 0 && (
            <div className="flex items-center gap-4 mb-8 px-2 animate-in fade-in duration-700">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-100 dark:via-emerald-900/50 to-transparent" />
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 bg-[#f4f7f5] dark:bg-[#0B100E] px-2">
                 {isAr ? "أو إنشاء نشاط ورقي جديد" : "Or create a new paper activity"}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-100 dark:via-emerald-900/50 to-transparent" />
            </div>
          )}

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: gradableWorksheets.length > 0 ? 0.1 : 0 }}
            className="bg-white dark:bg-[#15201B] rounded-3xl shadow-sm border border-emerald-50 dark:border-emerald-900/30 overflow-hidden transition-all hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-800/50"
          >
            <div className="p-5 sm:p-8 space-y-8">
              
              {/* Document Title Editor */}
              <div className="space-y-3">
                <input 
                  id="pg-title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                   placeholder={isAr ? "عنوان النشاط الورقي..." : "Paper Activity Title..."}
                  className="w-full bg-transparent border-b-2 border-transparent hover:border-emerald-100 focus:border-emerald-400 dark:hover:border-emerald-900/50 dark:focus:border-emerald-500 outline-none text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 transition-colors pb-1.5"
                  disabled={isLoading}
                />
                <div className="flex items-center gap-2 px-1">
                  <BookOpen className="w-4 h-4 text-emerald-600/40 dark:text-emerald-400/40" />
                  <input 
                    id="pg-subject"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder={isAr ? "المادة (اختياري)..." : "Subject (optional)..."}
                    className="flex-1 bg-transparent border-b-2 border-transparent hover:border-emerald-100 focus:border-emerald-400 dark:hover:border-emerald-900/50 dark:focus:border-emerald-500 outline-none text-sm font-bold text-slate-600 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors pb-1"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {/* Total Points */}
                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-4 flex flex-col justify-center border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all group">
                  <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1.5">
                    <Star className="w-3.5 h-3.5 text-emerald-500" /> {isAr ? "الدرجة الكلية" : "Total Points"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={totalPoints}
                      onChange={e => setTotalPoints(parseFloat(e.target.value) || 1)}
                      disabled={isLoading}
                      className="w-16 bg-transparent text-lg font-black text-slate-800 dark:text-slate-100 outline-none p-0 text-center"
                    />
                    <span className="text-sm font-bold text-slate-400">{isAr ? "درجة" : "pts"}</span>
                  </div>
                </div>

                {/* Deadline */}
                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-4 flex flex-col justify-center border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all group">
                  <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" /> {isAr ? "موعد التسليم" : "Deadline"}
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    disabled={isLoading}
                    dir="ltr"
                    className="bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none w-full appearance-none"
                  />
                </div>

                {/* Target Classes */}
                {classes.length > 0 && (
                  <div className="relative bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-4 flex flex-col justify-center border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all group cursor-pointer" ref={classPickerRef} onClick={() => !isLoading && setClassPickerOpen(!classPickerOpen)}>
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-500" /> {isAr ? "الصفوف المستهدفة" : "Target Classes"}
                    </label>
                    <button
                      type="button"
                      disabled={isLoading}
                      className="flex items-center justify-between bg-transparent outline-none w-full text-start"
                    >
                      <span className={`text-sm font-bold truncate ${targetClasses.length === 0 ? "text-slate-400" : "text-slate-800 dark:text-slate-100"}`}>
                        {targetClasses.length === 0 ? (isAr ? "اختر..." : "Select...") : targetClasses.join("، ")}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${classPickerOpen ? "rotate-180" : ""}`} />
                    </button>
                    
                    {classPickerOpen && (
                      <div className="absolute top-[calc(100%+8px)] start-0 end-0 z-50 bg-white dark:bg-[#15201B] border border-emerald-100 dark:border-emerald-800 rounded-2xl shadow-xl overflow-hidden py-2 max-h-48 overflow-y-auto cursor-default" onClick={e => e.stopPropagation()}>
                         {classes.map(c => (
                           <button
                             key={c.id}
                             type="button"
                             onClick={() => toggleClass(c.name)}
                             className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-colors ${
                               targetClasses.includes(c.name)
                                 ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                 : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                             }`}
                           >
                             <span>{c.name}</span>
                             {targetClasses.includes(c.name) && <CheckCircle2 className="w-4 h-4" />}
                           </button>
                         ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Model Image */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight">
                        {isAr ? "نموذج الإجابة" : "Model Answer"}
                      </h3>
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                        {isAr ? "للمعلم فقط، لزيادة دقة التصحيح (اختياري)" : "Teacher only, for higher accuracy (Optional)"}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] border-2 border-dashed border-emerald-100 dark:border-emerald-900/50 rounded-2xl overflow-hidden relative group hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={modelImageRef}
                    onChange={handleModelImageUpload}
                  />
                  {modelImage ? (
                    <div className="relative">
                      <img src={modelImage} alt="Model Answer" className="w-full max-h-56 object-contain bg-black/5 dark:bg-white/5" />
                      <div className="absolute top-3 end-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => modelImageRef.current?.click()}
                          className="px-4 py-2 bg-white/90 dark:bg-[#15201B]/90 backdrop-blur-md text-emerald-700 dark:text-emerald-300 text-xs font-black rounded-xl shadow-sm hover:scale-105 transition-transform"
                        >
                          {isAr ? "تغيير" : "Change"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setModelImage(null)}
                          className="w-9 h-9 flex items-center justify-center bg-white/90 dark:bg-[#15201B]/90 backdrop-blur-md text-red-500 rounded-xl shadow-sm hover:scale-105 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => modelImageRef.current?.click()}
                      disabled={isLoading}
                      className="w-full py-10 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    >
                      <div className="w-14 h-14 rounded-full bg-white dark:bg-[#15201B] shadow-sm border border-emerald-50 dark:border-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div className="text-center">
                        <span className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-1">
                          {isAr ? "اضغط لرفع صورة نموذج الإجابة" : "Tap to upload model answer"}
                        </span>
                        <span className="block text-xs font-bold opacity-70">
                          {isAr ? "PNG, JPG (حد أقصى 10MB)" : "PNG, JPG (Max 10MB)"}
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* AI Instructions — after model answer so teacher fills it informed */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight">
                      {isAr ? "تعليمات التصحيح للذكاء الاصطناعي" : "AI Grading Instructions"}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                      {isAr ? "كيف تريد من الذكاء الاصطناعي أن يصحّح؟ (اختياري)" : "How should the AI grade? (Optional)"}
                    </p>
                  </div>
                </div>
                <textarea
                  value={aiInstructions}
                  onChange={e => setAiInstructions(e.target.value)}
                  placeholder={isAr ? "مثال: لا تخصم درجات على الأخطاء الإملائية، اقبل الإجابات بالعامية..." : "e.g., Don't deduct for spelling, accept colloquial answers..."}
                  disabled={isLoading}
                  rows={3}
                  className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-400/10 transition-all resize-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="p-4 sm:p-6 bg-emerald-50 dark:bg-[#0e1612] border-t border-emerald-100/50 dark:border-emerald-900/30">
              <button
                type="submit"
                disabled={isLoading || !title.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-base font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {isAr ? "جاري الإنشاء..." : "Creating..."}</>
                ) : (
                   <><Sparkles className="w-5 h-5" /> {isAr ? "إنشاء النشاط الورقي" : "Create Paper Activity"}</>
                )}
              </button>
              <p className="text-center text-xs font-bold text-slate-500 mt-4 leading-relaxed">
                {isAr
                   ? "بعد الإنشاء ستجد النشاط الورقي في لوحة الواجبات لرفع الصور وتصحيحها"
                   : "Find the paper activity in your assignments board to upload and grade photos"}
              </p>
            </div>
          </motion.form>
        </section>
      </main>
    </div>
  );
}
