import { useI18n } from "@/lib/i18n";
import { usePublicStats } from "@/lib/landing-api";

export function HowItWorksSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const stats = usePublicStats();

  const flowSteps = [
    {
      title: isAr ? "١. أنشئ" : "1. Create",
      desc: isAr
        ? "حوّل فكرة الدرس إلى نشاط أو واجب أو عرض جاهز للتخصيص."
        : "Turn a lesson idea into an activity, assignment, or deck you can customize.",
    },
    {
      title: isAr ? "٢. اعرض" : "2. Present",
      desc: isAr
        ? "اعرض المحتوى بطريقة تفاعلية، ثم شاركه برابط واحد."
        : "Present the content interactively, then share it with one link.",
    },
    {
      title: isAr ? "٣. تفاعل" : "3. Engage",
      desc: isAr
        ? "تابع المشاركة والنتائج والتسليمات من لوحة واضحة."
        : "Follow participation, results, and submissions from one clear dashboard.",
    },
  ];

  return (
    <section id="how-it-works" className="border-t border-border bg-[#fbfcf8] dark:bg-background py-16 sm:py-24" dir={dir}>
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="bg-card border border-border shadow-sm rounded-3xl p-8 sm:p-10">
            <p className="text-sm font-black text-primary">
              {isAr ? "مسار حصاد" : "The Hasad path"}
            </p>
            <h3 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">
              {isAr ? "أنشئ ← اعرض ← تفاعل" : "Create ← Present ← Engage"}
            </h3>
            <div className="mt-8 space-y-4">
              {flowSteps.map((step, i) => (
                <div
                  key={step.title}
                  className="flex gap-5 rounded-2xl border border-border bg-background p-5 transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-black text-primary">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-foreground">
                      {step.title}
                    </h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground font-medium">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!stats?.hidden && stats && (
            <div className="bg-card border border-border shadow-sm rounded-3xl p-8 sm:p-10 flex flex-col justify-center">
              <p className="text-sm font-black text-primary">
                {isAr ? "إحصائيات نشطة" : "Active Stats"}
              </p>
              <h3 className="mt-2 text-3xl font-black text-foreground sm:text-4xl mb-8">
                {isAr ? "حصاد ينمو مع كل صفّ جديد" : "Hasaad grows with every new class"}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-6 text-center border border-emerald-100 dark:border-emerald-900">
                  <div className="text-4xl font-black text-primary mb-2">
                    {stats.teacherCount.toLocaleString(isAr ? "ar-EG" : "en-US")}
                  </div>
                  <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    {isAr ? "معلم ومعلمة" : "Teachers"}
                  </div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-6 text-center border border-amber-100 dark:border-amber-900">
                  <div className="text-4xl font-black text-secondary mb-2">
                    {stats.studentCount.toLocaleString(isAr ? "ar-EG" : "en-US")}
                  </div>
                  <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
                    {isAr ? "طالب مشارك" : "Students"}
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-6 text-center border border-blue-100 dark:border-blue-900">
                  <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mb-2">
                    {stats.assignmentCount.toLocaleString(isAr ? "ar-EG" : "en-US")}
                  </div>
                  <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
                    {isAr ? "نشاط ودرس" : "Activities"}
                  </div>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-2xl p-6 text-center border border-purple-100 dark:border-purple-900">
                  <div className="text-4xl font-black text-purple-600 dark:text-purple-400 mb-2">
                    {stats.submissionCount.toLocaleString(isAr ? "ar-EG" : "en-US")}
                  </div>
                  <div className="text-sm font-bold text-purple-800 dark:text-purple-300">
                    {isAr ? "إجابة مسجلة" : "Submissions"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}