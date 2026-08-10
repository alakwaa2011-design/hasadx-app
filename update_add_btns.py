import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

pattern = r'<Button type="button" variant="outline" onClick=\{handleAddQuestion\} className="flex-1 py-3 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary text-sm">\n                          <Plus className=\{\`w-4 h-4 \$\{lang === "ar" \? "ml-1.5" : "mr-1.5"\}\`\} />\{t.createAssignment.addQuestion\}\n                        </Button>\n                        <Button type="button" variant="outline" onClick=\{openBankModal\} className="flex-1 py-3 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary text-sm">\n                          <Database className=\{\`w-4 h-4 \$\{lang === "ar" \? "ml-1.5" : "mr-1.5"\}\`\} />\{t.questionBank.selectQuestions\}\n                        </Button>'

new = '''<button type="button" onClick={handleAddQuestion} className="flex-1 flex justify-center items-center gap-2 py-4 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 bg-[#f4f7f5] dark:bg-[#0B100E] hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black text-sm transition-all active:scale-[0.98]">
                          <Plus className="w-5 h-5" />{t.createAssignment.addQuestion}
                        </button>
                        <button type="button" onClick={openBankModal} className="flex-1 flex justify-center items-center gap-2 py-4 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800/50 bg-[#f4f7f5] dark:bg-[#0B100E] hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-black text-sm transition-all active:scale-[0.98]">
                          <Database className="w-5 h-5" />{t.questionBank.selectQuestions}
                        </button>'''

content = re.sub(pattern, new, content, flags=re.DOTALL)
with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
