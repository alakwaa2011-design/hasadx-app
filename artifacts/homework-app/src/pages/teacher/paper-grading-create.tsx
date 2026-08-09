/**
 * Standalone "تصحيح ورقي ذكي" creation page.
 * A simplified, focused form for creating a paper-based assignment
 * that students photograph and submit for AI grading.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateAssignment } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { Input, Button, Label } from "@/components/ui-elements";
import { fileToBase64 } from "@/lib/utils";
import {
  ArrowRight, ArrowLeft, Brain, Star, Calendar,
  BookOpen, Users, Loader2, CheckCircle2, ChevronDown,
  Image, Upload, X, Camera, FileText,
} from "lucide-react";
import { motion } from "framer-motion";

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
  // so teachers can jump straight to camera grading from this tool.
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
        toast.success(isAr ? "تم إنشاء الاختبار الورقي بنجاح 🎉" : "Paper exam created successfully 🎉");
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
      toast.error(isAr ? "يجب إدخال عنوان الاختبار" : "Please enter an exam title");
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

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLocation("/teacher/new")}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card hover:bg-muted transition-colors shrink-0"
          aria-label={isAr ? "رجوع" : "Back"}
        >
          {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <span className="text-lg leading-none">📄</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-black text-foreground leading-tight truncate">
              {isAr ? "تصحيح ورقي بالذكاء الاصطناعي" : "AI Paper Grading"}
            </h1>
            <p className="text-[11px] text-muted-foreground leading-none hidden sm:block">
              {isAr
                ? "ارفع صور أوراق الطلاب، والذكاء الاصطناعي يصحّح"
                : "Upload student paper photos — AI grades them automatically"}
            </p>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="bg-gradient-to-l from-amber-500/10 via-orange-500/8 to-transparent border-b border-amber-200/50 dark:border-amber-800/30 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <Brain className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200 leading-snug">
              {isAr
                ? "كيف تعمل؟"
                : "How it works"}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-0.5 leading-relaxed">
              {isAr
                ? "أنشئ الاختبار هنا، ثم ارفع صور أوراق الطلاب، ويصحّح الذكاء الاصطناعي فوراً حسب تعليماتك."
                : "Create the exam here, then upload photos of the students' papers — AI grades them instantly per your instructions."}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Fast path: camera-grade an existing smart-grading worksheet */}
        {gradableWorksheets.length > 0 && (
          <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                  {isAr ? "تصحيح سريع لورقة عمل جاهزة" : "Quick-grade an existing worksheet"}
                </h2>
                <p className="text-[11px] text-emerald-700/70 dark:text-emerald-300/70 mt-0.5">
                  {isAr
                    ? "هذه أوراق العمل المفعّل فيها التصحيح الذكي — اختر ورقة وابدأ التصوير مباشرة دون إنشاء اختبار جديد."
                    : "These worksheets already have smart grading enabled — pick one and start photographing right away."}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {gradableWorksheets.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setLocation(`/teacher/worksheets/${w.id}/grade`)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-background border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-colors text-start"
                  data-testid={`btn-quickgrade-worksheet-${w.id}`}
                >
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold truncate">{w.title || (isAr ? "(بدون عنوان)" : "(untitled)")}</span>
                    {w.subject && <span className="block text-[11px] text-muted-foreground truncate">{w.subject}</span>}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg px-3 py-1.5 shrink-0">
                    <Camera className="w-3.5 h-3.5" />
                    {isAr ? "تصحيح" : "Grade"}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-emerald-700/60 dark:text-emerald-300/50">
              {isAr
                ? "أو أنشئ اختباراً ورقياً جديداً بالنموذج أدناه إذا لم تكن لديك ورقة عمل جاهزة."
                : "Or create a new paper exam with the form below."}
            </p>
          </div>
        )}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* Title */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <Label htmlFor="pg-title" className="mb-2 block text-sm font-bold">
                {isAr ? "عنوان الاختبار" : "Exam Title"}
                <span className="text-destructive ms-1">*</span>
              </Label>
              <Input
                id="pg-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={isAr ? "مثال: اختبار الفصل الأول — الفيزياء" : "e.g. Unit 1 Exam — Physics"}
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="pg-subject" className="mb-2 block text-sm font-bold">
                <BookOpen className="w-3.5 h-3.5 inline-block me-1.5 text-muted-foreground" />
                {isAr ? "المادة" : "Subject"}
                <span className="text-muted-foreground text-xs font-normal ms-1">({isAr ? "اختياري" : "optional"})</span>
              </Label>
              <Input
                id="pg-subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={isAr ? "رياضيات، علوم، لغة عربية..." : "Math, Science, Arabic..."}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* AI Grading Instructions — prominent & upfront */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-2 border-amber-200 dark:border-amber-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h2 className="text-sm font-black text-amber-800 dark:text-amber-200">
                  {isAr ? "تعليمات التصحيح للذكاء الاصطناعي" : "AI Grading Instructions"}
                </h2>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-300/70 mt-0.5">
                  {isAr
                    ? "حدّد كيف تريد من الذكاء الاصطناعي أن يصحّح — درجة المرونة، قبول العامية، أهمية الخطوات..."
                    : "Tell the AI how to grade — flexibility, dialect acceptance, step-by-step importance..."}
                </p>
              </div>
            </div>
            <textarea
              value={aiInstructions}
              onChange={e => setAiInstructions(e.target.value)}
              placeholder={
                isAr
                  ? "مثال: اقبل الإجابات بالعامية والفصحى، لا تخصم درجات على الأخطاء الإملائية البسيطة، اعطِ نصف الدرجة إذا كانت الفكرة صحيحة..."
                  : "e.g. Accept colloquial and formal Arabic, don't deduct for minor spelling errors, give half marks if the idea is correct..."
              }
              rows={4}
              disabled={isLoading}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-white dark:bg-background text-sm resize-none focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 transition-colors placeholder:text-amber-600/40 dark:placeholder:text-amber-400/30"
            />
            <p className="text-[11px] text-amber-600/70 dark:text-amber-400/50 leading-relaxed">
              {isAr
                ? "💡 كلما كانت التعليمات أوضح، كان التصحيح أدق. يمكنك تركها فارغة للتصحيح التلقائي العام."
                : "💡 The clearer the instructions, the more accurate the grading. Leave blank for general auto-grading."}
            </p>
          </div>

          {/* Model answer — standalone card, visually distinct */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border-2 border-indigo-200 dark:border-indigo-700 rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-indigo-600 dark:bg-indigo-700">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Image className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-white leading-tight">
                  {isAr ? "نموذج إجابتك أنت — للمعلم فقط" : "Your Model Answer — Teacher Only"}
                </h2>
                <p className="text-[11px] text-indigo-200 mt-0.5 leading-snug">
                  {isAr
                    ? "الذكاء الاصطناعي يقارن إجابات الطلاب بنموذجك ويصحّح بدقة أعلى"
                    : "AI compares student answers against your key for more accurate grading"}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/30">
                {isAr ? "اختياري" : "optional"}
              </span>
            </div>

            {/* Upload area */}
            <div className="p-4">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={modelImageRef}
                onChange={handleModelImageUpload}
              />
              {modelImage ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-indigo-300 dark:border-indigo-600 bg-black/5">
                  <img src={modelImage} alt="" className="w-full max-h-56 object-contain" />
                  <div className="absolute top-2 end-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => modelImageRef.current?.click()}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm"
                    >
                      {isAr ? "تغيير الصورة" : "Change"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelImage(null)}
                      className="p-1.5 bg-white dark:bg-black/60 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-700 shadow-sm"
                      aria-label={isAr ? "حذف الصورة" : "Remove"}
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
                  className="w-full py-8 sm:py-10 border-2 border-dashed border-indigo-300 dark:border-indigo-600 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex flex-col items-center gap-2.5 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-800/50 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-700/50 flex items-center justify-center transition-colors">
                    <Upload className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 group-hover:text-indigo-800 dark:group-hover:text-indigo-200 transition-colors">
                      {isAr ? "اضغط لرفع صورة نموذج الإجابة" : "Tap to upload your answer key"}
                    </p>
                    <p className="text-[11px] text-indigo-400 dark:text-indigo-500 mt-0.5">
                      {isAr ? "PNG، JPG — الحجم الأقصى 10 ميجا" : "PNG, JPG — max 10 MB"}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Points & Deadline */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <Label className="mb-2 block text-sm font-bold">
                <Star className="w-3.5 h-3.5 inline-block me-1.5 text-amber-500" />
                {isAr ? "الدرجة الكلية" : "Total Points"}
                <span className="text-destructive ms-1">*</span>
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={totalPoints}
                  onChange={e => setTotalPoints(parseFloat(e.target.value) || 1)}
                  disabled={isLoading}
                  className="w-28 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 text-center font-black text-xl text-amber-700 dark:text-amber-300 focus:outline-none focus:border-amber-400 transition-all"
                />
                <span className="text-sm font-bold text-muted-foreground">
                  {isAr ? "درجة" : "pts"}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="pg-deadline" className="mb-2 block text-sm font-bold">
                <Calendar className="w-3.5 h-3.5 inline-block me-1.5 text-muted-foreground" />
                {isAr ? "موعد التسليم" : "Deadline"}
                <span className="text-muted-foreground text-xs font-normal ms-1">({isAr ? "اختياري" : "optional"})</span>
              </Label>
              <Input
                id="pg-deadline"
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                disabled={isLoading}
                className="text-left"
                dir="ltr"
              />
            </div>
          </div>

          {/* Class assignment */}
          {classes.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <Label className="block text-sm font-bold">
                <Users className="w-3.5 h-3.5 inline-block me-1.5 text-muted-foreground" />
                {isAr ? "الصفوف المستهدفة" : "Target Classes"}
                <span className="text-muted-foreground text-xs font-normal ms-1">({isAr ? "اختياري" : "optional"})</span>
              </Label>

              <div ref={classPickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setClassPickerOpen(!classPickerOpen)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between px-4 py-2.5 border-2 border-input rounded-xl bg-background text-sm hover:border-primary/40 transition-colors focus:outline-none"
                >
                  <span className={targetClasses.length === 0 ? "text-muted-foreground" : "font-medium"}>
                    {targetClasses.length === 0
                      ? (isAr ? "اختر صفاً أو أكثر..." : "Select one or more classes...")
                      : targetClasses.join("، ")}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${classPickerOpen ? "rotate-180" : ""}`} />
                </button>

                {classPickerOpen && (
                  <div className="absolute top-full mt-1 start-0 end-0 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                      {classes.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleClass(c.name)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-start transition-colors ${
                            targetClasses.includes(c.name)
                              ? "bg-primary/10 text-primary font-bold"
                              : "hover:bg-muted"
                          }`}
                        >
                          {targetClasses.includes(c.name) && (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          )}
                          <span className="flex-1">{c.name}</span>
                          {c.grade && (
                            <span className="text-xs text-muted-foreground">{c.grade}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 pb-8">
            <Button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="w-full py-4 text-base font-black rounded-2xl"
              style={{ background: "linear-gradient(135deg,#d97706 0%,#ea580c 100%)", color: "#fff" }}
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin me-2" />{isAr ? "جاري الإنشاء..." : "Creating..."}</>
              ) : (
                <><Brain className="w-5 h-5 me-2" />{isAr ? "إنشاء الاختبار الورقي" : "Create Paper Exam"}</>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3 leading-relaxed">
              {isAr
                ? "بعد الإنشاء ستجد الاختبار في لوحة الواجبات — ارفع صور أوراق الطلاب من هناك للتصحيح"
                : "After creation, find the exam in your assignments — upload student paper photos from there to grade"}
            </p>
          </div>
        </motion.form>
      </main>
    </div>
  );
}
