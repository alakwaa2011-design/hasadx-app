import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# Replace the heading and motion div for step 2
pattern1 = r'              \{/\* ══════════════════════════════════ STEP 2 — الأسئلة ══════════════════════════════════ \*/\}\n              \{wizardStep === 2 && \(\n                <motion.div key="step2" initial=\{\{ opacity: 0, x: 20 \}\} animate=\{\{ opacity: 1, x: 0 \}\} exit=\{\{ opacity: 0, x: -20 \}\} transition=\{\{ duration: 0.2 \}\} className="space-y-4">\n                  <div className="flex items-center justify-between">\n                    <h2 className="text-xl font-black text-foreground">\{lang === "ar" \? "الأسئلة" : "Questions"\}</h2>\n                    <div className="flex items-center gap-2">\n                      <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-xs font-bold">\{totalPoints\} \{t.createAssignment.gradeUnit\}</span>\n                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">\{questions.length\} \{t.createAssignment.aiQuestions\}</span>\n                    </div>\n                  </div>'

new_1 = '''              {/* ══════════════════════════════════ STEP 2 — الأسئلة ══════════════════════════════════ */}
              {wizardStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
                  
                  <div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 shadow-sm border border-emerald-50 dark:border-emerald-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">{lang === "ar" ? "إعداد الأسئلة" : "Questions"}</h2>
                        <p className="text-[11px] font-bold text-slate-500">{lang === "ar" ? "أضف أسئلة أو استخدم الذكاء الاصطناعي" : "Add questions or generate with AI"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-3 py-1 rounded-xl text-xs font-black shadow-sm border border-amber-200/50 dark:border-amber-800/50">{totalPoints} {t.createAssignment.gradeUnit}</span>
                      <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-3 py-1 rounded-xl text-xs font-black shadow-sm border border-emerald-200/50 dark:border-emerald-800/50">{questions.length} {t.createAssignment.aiQuestions}</span>
                    </div>
                  </div>'''

content = re.sub(pattern1, new_1, content, flags=re.DOTALL)
with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)

print("Replaced wrapper step 2")
