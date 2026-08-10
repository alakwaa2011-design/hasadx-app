import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

pattern_bottom = r'            \{\/\* ══ Sticky Navigation ══ \*\/\}.*?      </div>\n\n      \{\/\* ══ Draft Prompt Modal ══ \*/\}'

new_bottom = '''            {/* ══ Sticky Navigation ══ */}
            <div className="sticky bottom-4 z-20 mt-6 px-2">
              <div className="bg-white/90 dark:bg-[#15201B]/90 backdrop-blur-xl border border-emerald-100/50 dark:border-emerald-900/30 rounded-3xl shadow-lg shadow-emerald-900/5 p-3 flex items-center justify-between gap-3">
                <button type="button" onClick={goPrev} disabled={wizardStep === 1}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  <BackArrowIcon className="w-5 h-5" />
                  {lang === "ar" ? "السابق" : "Previous"}
                </button>

                <div className="hidden sm:flex items-center gap-1.5">
                  {STEPS.map(step => (
                    <div key={step.num} className={`h-1.5 rounded-full transition-all duration-300 ${wizardStep === step.num ? "w-8 bg-emerald-500" : wizardStep > step.num ? "w-4 bg-emerald-200 dark:bg-emerald-800" : "w-4 bg-slate-100 dark:bg-slate-800"}`} />
                  ))}
                </div>

                {wizardStep < 3 ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={goToPreview}
                      className="hidden sm:flex items-center gap-2 px-4 py-3 rounded-2xl text-emerald-600 dark:text-emerald-400 text-sm font-black hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                      <Eye className="w-4 h-4" />
                      {lang === "ar" ? "معاينة" : "Preview"}
                    </button>
                    <button type="button" onClick={goNext}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 active:scale-[0.97]">
                      {lang === "ar" ? "التالي" : "Next"}
                      {lang === "ar" ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={handlePublish} disabled={createMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-60 active:scale-[0.97]">
                    {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {lang === "ar" ? "نشر الواجب" : "Publish"}
                  </button>
                )}
              </div>
            </div>
      </main>

      {/* ══ Draft Prompt Modal ══ */}'''

content = re.sub(pattern_bottom, new_bottom, content, flags=re.DOTALL)
with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)

print("Replaced bottom wrapper")
