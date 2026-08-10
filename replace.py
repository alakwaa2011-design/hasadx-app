import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# Replace the layout and header wrapper
pattern = r'  return \(\n    <Layout>\n      <div\n        className="min-h-screen.*?\n        {/\* ══════════════════════════════════ STEP 1 — الأساسيات ══════════════════════════════════ \*/}'
match = re.search(pattern, content, re.DOTALL)
if match:
    old_text = match.group(0)
    print("Found header block!")
    
    new_text = '''  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-24 font-display">
      {/* ══ Sticky Header ══ */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
        <button
          type="button"
          onClick={() => setLocation("/teacher")}
          className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
          aria-label={lang === "ar" ? "رجوع" : "Back"}
        >
          <BackArrowIcon className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
              {isContestMode
                ? (lang === "ar" ? "أنشئ أسئلة مسابقتك" : "Create your contest questions")
                : t.createAssignment.wizardHeroTitle}
            </h1>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
              {isContestMode
                ? (lang === "ar"
                    ? "اكتب أسئلتك يدويًا أو ولِّدها بالذكاء الاصطناعي، ثم استخدمها في أي لعبة."
                    : "Write questions yourself or generate them with AI, then use them in any game.")
                : t.createAssignment.wizardStepProgress
                    .replace("{current}", String(wizardStep))
                    .replace("{total}", String(STEPS.length))
                    .replace("{label}", STEPS[wizardStep - 1].label)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-8">
        {/* ══ Progress Bar ══ */}
        <div className="flex items-center px-2">
          {STEPS.map((step, idx) => (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => { if (step.num < wizardStep) setWizardStep(step.num as 1|2|3); }}
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black transition-all ${
                    wizardStep === step.num
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 scale-110"
                      : wizardStep > step.num
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 cursor-pointer hover:scale-105"
                      : "bg-[#f4f7f5] text-slate-400 border border-slate-200 dark:bg-[#0B100E] dark:border-slate-800 dark:text-slate-600 cursor-not-allowed"
                  }`}
                >
                  {wizardStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                </button>
                <span className={`text-[10px] font-bold mt-1.5 whitespace-nowrap ${wizardStep === step.num ? "text-slate-800 dark:text-slate-200" : "text-slate-400"}`}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 -mt-4 rounded-full transition-colors ${wizardStep > step.num ? "bg-emerald-200 dark:bg-emerald-800/60" : "bg-slate-100 dark:bg-slate-800"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════ STEP 1 — الأساسيات ══════════════════════════════════ */}'''
    content = content.replace(old_text, new_text)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
