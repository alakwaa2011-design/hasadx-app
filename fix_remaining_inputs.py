import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# Replace <Input with <input
content = content.replace('<Input ', '<input ')

# Also let's style the MCQ options correctly.
old_mcq = '''                                          <input value={q[MCQ_OPT[opt]] || ""} onChange={e => handleQuestionChange(qIndex, MCQ_OPT[opt], e.target.value)}
                                            placeholder={`${t.createAssignment.option} ${opt}`}
                                            className={`text-sm ${isActive ? "border-primary bg-primary/5 font-bold" : ""}`}
                                          />'''
new_mcq = '''                                          <input value={q[MCQ_OPT[opt]] || ""} onChange={e => handleQuestionChange(qIndex, MCQ_OPT[opt], e.target.value)}
                                            placeholder={`${t.createAssignment.option} ${opt}`}
                                            className={`w-full bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl px-3 py-2 text-sm outline-none focus:ring-4 transition-all ${isActive ? "border-2 border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10 font-black text-emerald-900 dark:text-emerald-100 focus:ring-emerald-500/20 shadow-sm" : "border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold focus:border-emerald-400 focus:ring-emerald-400/10"}`}
                                          />'''
content = content.replace(old_mcq, new_mcq)

# And fill-in-the-blanks input
old_fill = '''                                    <input required value={q.correctAnswer?.split("|")[0] || ""}
                                      onChange={e => handleQuestionChange(qIndex, 'correctAnswer', e.target.value + (q.correctAnswer?.includes("|") ? ("|" + q.correctAnswer.split("|").slice(1).join("|")) : ""))}
                                      placeholder={lang === "ar" ? "الإجابة الصحيحة الأساسية" : "Primary correct answer"}
                                      className="text-sm border-primary/50 focus-visible:border-primary" />'''
new_fill = '''                                    <input required value={q.correctAnswer?.split("|")[0] || ""}
                                      onChange={e => handleQuestionChange(qIndex, 'correctAnswer', e.target.value + (q.correctAnswer?.includes("|") ? ("|" + q.correctAnswer.split("|").slice(1).join("|")) : ""))}
                                      placeholder={lang === "ar" ? "الإجابة الصحيحة الأساسية" : "Primary correct answer"}
                                      className="w-full bg-emerald-50/50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700/50 rounded-xl px-3 py-2 text-sm font-black text-emerald-900 dark:text-emerald-100 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all shadow-sm" />'''
content = content.replace(old_fill, new_fill)

old_alt = '''                                      <input value={alt}
                                        onChange={e => {
                                          const current = q.correctAnswer?.split("|") || [];
                                          current[i + 1] = e.target.value;
                                          handleQuestionChange(qIndex, 'correctAnswer', current.join("|"));
                                        }}
                                        placeholder={lang === "ar" ? `إجابة بديلة ${i + 1}` : `Alternative ${i + 1}`}
                                        className="text-sm bg-muted/30" />'''
new_alt = '''                                      <input value={alt}
                                        onChange={e => {
                                          const current = q.correctAnswer?.split("|") || [];
                                          current[i + 1] = e.target.value;
                                          handleQuestionChange(qIndex, 'correctAnswer', current.join("|"));
                                        }}
                                        placeholder={lang === "ar" ? `إجابة بديلة ${i + 1}` : `Alternative ${i + 1}`}
                                        className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-400/10 transition-all" />'''
content = content.replace(old_alt, new_alt)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
