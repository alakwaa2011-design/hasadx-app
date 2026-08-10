import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# Question text
old_q_text = '''                                {/* Question text */}
                                <Input required value={q.text} onChange={e => handleQuestionChange(qIndex, 'text', e.target.value)} placeholder={t.createAssignment.questionPlaceholder} className="text-sm" />'''
new_q_text = '''                                {/* Question text */}
                                <input required value={q.text} onChange={e => handleQuestionChange(qIndex, 'text', e.target.value)} placeholder={t.createAssignment.questionPlaceholder} 
                                  className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all mb-2" />'''
content = content.replace(old_q_text, new_q_text)

# Select question type and points
old_q_type = '''                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className="text-xs font-bold text-muted-foreground">{t.createAssignment.questionLabel} {qIndex + 1}</span>
                                  <select value={q.questionType === "whiteboard" ? (q.optionA === "lined" ? "whiteboard" : "whiteboard_blank") : (q.questionType || "mcq")}
                                    onChange={e => {
                                    const v = e.target.value;
                                    if (v === "mcq" || v === "true_false" || v === "fill_blank" || v === "whiteboard" || v === "whiteboard_blank" || v === "dictation") handleQuestionTypeChange(qIndex, v);
                                  }}
                                    className="px-2 py-1 rounded-md bg-muted/50 border border-border text-[11px] font-bold focus:outline-none focus:border-primary transition-all">
                                    <option value="mcq">{t.createAssignment.questionTypeMcq}</option>
                                    <option value="true_false">{t.createAssignment.questionTypeTrueFalse}</option>
                                    <option value="fill_blank">{t.createAssignment.questionTypeFillBlank}</option>
                                    <option value="dictation">🎙 {lang === "ar" ? "إملاء صوتي" : "Dictation"}</option>
                                    <option value="whiteboard_blank">{t.createAssignment.questionTypeWhiteboardBlank}</option>
                                    <option value="whiteboard">{t.createAssignment.questionTypeWhiteboard}</option>
                                  </select>
                                  <div className="flex items-center gap-1">
                                    <input type="number" min="0.5" step="0.5" value={q.points || 1} onChange={e => handleQuestionChange(qIndex, 'points', parseFloat(e.target.value) || 1)}
                                      className="w-14 px-2 py-1 rounded-md bg-secondary/10 border border-secondary/30 text-center text-xs font-bold text-secondary focus:outline-none focus:border-secondary transition-all" />
                                    <span className="text-[11px] text-muted-foreground">{t.createAssignment.gradeLabel}</span>
                                  </div>
                                </div>'''

new_q_type = '''                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  <span className="text-[11px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">{t.createAssignment.questionLabel} {qIndex + 1}</span>
                                  <select value={q.questionType === "whiteboard" ? (q.optionA === "lined" ? "whiteboard" : "whiteboard_blank") : (q.questionType || "mcq")}
                                    onChange={e => {
                                    const v = e.target.value;
                                    if (v === "mcq" || v === "true_false" || v === "fill_blank" || v === "whiteboard" || v === "whiteboard_blank" || v === "dictation") handleQuestionTypeChange(qIndex, v);
                                  }}
                                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 text-[11px] font-bold focus:outline-none focus:border-emerald-400 transition-all text-slate-700 dark:text-slate-300 cursor-pointer shadow-sm">
                                    <option value="mcq">{t.createAssignment.questionTypeMcq}</option>
                                    <option value="true_false">{t.createAssignment.questionTypeTrueFalse}</option>
                                    <option value="fill_blank">{t.createAssignment.questionTypeFillBlank}</option>
                                    <option value="dictation">🎙 {lang === "ar" ? "إملاء صوتي" : "Dictation"}</option>
                                    <option value="whiteboard_blank">{t.createAssignment.questionTypeWhiteboardBlank}</option>
                                    <option value="whiteboard">{t.createAssignment.questionTypeWhiteboard}</option>
                                  </select>
                                  <div className="flex items-center gap-1.5 ml-auto rtl:mr-auto rtl:ml-0">
                                    <span className="text-[11px] font-bold text-slate-500">{t.createAssignment.gradeLabel}</span>
                                    <input type="number" min="0.5" step="0.5" value={q.points || 1} onChange={e => handleQuestionChange(qIndex, 'points', parseFloat(e.target.value) || 1)}
                                      className="w-16 px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-center text-[11px] font-black text-amber-700 dark:text-amber-400 focus:outline-none focus:border-amber-400 transition-all shadow-sm" />
                                  </div>
                                </div>'''
content = content.replace(old_q_type, new_q_type)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
