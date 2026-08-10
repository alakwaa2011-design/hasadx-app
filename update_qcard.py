import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# I will replace `<Card className={\`p-4 ${lang === "ar" ? "border-l-4 border-l-secondary" : "border-r-4 border-r-secondary"} relative group ${isDragging ? "ring-2 ring-primary/40 shadow-xl" : ""}\`}>`
# with `<div className={\`bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 relative group ${isDragging ? "ring-4 ring-emerald-400/20 shadow-xl" : "hover:border-emerald-100 dark:hover:border-emerald-800/50 transition-colors"}\`}>`

pattern = r'<Card className=\{\`p-4 \$\{lang === "ar" \? "border-l-4 border-l-secondary" : "border-r-4 border-r-secondary"\} relative group \$\{isDragging \? "ring-2 ring-primary/40 shadow-xl" : ""\}\`\}>'
new = '<div className={`bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 relative group transition-all ${isDragging ? "ring-4 ring-emerald-400/20 shadow-xl scale-[1.02]" : "hover:border-emerald-200 dark:hover:border-emerald-800/50"}`}>'
content = re.sub(pattern, new, content)

# I also need to close the `</div>` instead of `</Card>` for the questions.
# But there might be other cards. Let me just replace the specific </Card> for questions.
# It is followed by `</motion.div>\n                          )}`

close_pattern = r'</Card>\n                          </motion\.div>\n                            \)\}'
close_new = r'</div>\n                          </motion.div>\n                            )}'
content = re.sub(close_pattern, close_new, content)

# Also let's style the AI Generate and Image Extract panels
pattern_ai = r'<Card className="p-4 border-2 border-primary/20 bg-primary/5">'
new_ai = '<div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-100 dark:border-emerald-800/50">'
content = content.replace(pattern_ai, new_ai)

pattern_ai_admin = r'<Card className=\{\`p-4 border-2 border-primary/20 bg-primary/5 \$\{!isAdmin \? "opacity-50" : ""\}\`\}>'
new_ai_admin = '<div className={`bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-100 dark:border-emerald-800/50 ${!isAdmin ? "opacity-50" : ""}`}>'
content = content.replace(pattern_ai_admin, new_ai_admin)

# Paper card 
pattern_paper = r'<Card className="p-5 space-y-4">'
new_paper = '<div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 space-y-5">'
content = content.replace(pattern_paper, new_paper)

# Replace all </Card>
# Wait, I shouldn't blindly replace all </Card> if there are others. I'll replace the AI and Image ones specifically.
# The AI Generate panel ends with `</motion.div>\n                      )}` ? No, `</Card>` is on its own line.
# I'll just change all `<Card` to `<div` and `</Card>` to `</div>` in the entire file since I have replaced all other uses! Wait, `Card` is imported from ui-elements.
content = content.replace('</Card>', '</div>')
# Also remove `Card` from imports
content = content.replace('import { Card, Input, Button, Label } from "@/components/ui-elements";', 'import { Input, Button, Label } from "@/components/ui-elements";')

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
