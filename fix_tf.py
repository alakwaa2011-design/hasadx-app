import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# Fix True/False buttons
old_tf = '''                                    <button key={val} type="button" onClick={() => handleQuestionChange(qIndex, 'correctAnswer', val)}
                                      className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${q.correctAnswer === val ? "border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "border-border bg-muted/30 text-muted-foreground hover:border-green-400"}`}>
                                      {label}
                                    </button>'''
new_tf = '''                                    <button key={val} type="button" onClick={() => handleQuestionChange(qIndex, 'correctAnswer', val)}
                                      className={`flex-1 py-4 rounded-2xl text-base font-black border-2 transition-all active:scale-[0.98] ${q.correctAnswer === val ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 shadow-sm" : "border-slate-200 dark:border-slate-800 bg-[#f4f7f5] dark:bg-[#0B100E] text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10"}`}>
                                      {label}
                                    </button>'''
content = content.replace(old_tf, new_tf)

# Fix Fill in the blank box
old_fill_box = '''<div className="bg-muted/30 p-3 rounded-lg space-y-2">'''
new_fill_box = '''<div className="bg-[#f4f7f5] dark:bg-[#0B100E] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">'''
content = content.replace(old_fill_box, new_fill_box)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
