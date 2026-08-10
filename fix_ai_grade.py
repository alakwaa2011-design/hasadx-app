import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

old = '''<div className="p-4 border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">'''
new = '''<div className="rounded-3xl p-5 sm:p-6 shadow-sm border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">'''
content = content.replace(old, new)

old_text_area = '''<textarea value={aiGradingInstructions} onChange={e => setAiGradingInstructions(e.target.value)} placeholder={t.createAssignment.aiGradingInstructionsPlaceholder}
                        className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 dark:border-amber-700 bg-background text-sm resize-none focus:outline-none focus:border-amber-400 transition-colors" rows={2} />'''
new_text_area = '''<textarea value={aiGradingInstructions} onChange={e => setAiGradingInstructions(e.target.value)} placeholder={t.createAssignment.aiGradingInstructionsPlaceholder}
                        className="w-full px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-white/50 dark:bg-black/20 text-sm font-bold resize-none focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-colors placeholder:text-amber-700/40 dark:placeholder:text-amber-300/40" rows={2} />'''
content = content.replace(old_text_area, new_text_area)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
