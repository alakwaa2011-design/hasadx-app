import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

pattern3 = r'              \{/\* ══════════════════════════════════ STEP 3 — معاينة ونشر ══════════════════════════════════ \*/\}.*?              \{/\* ══ Bottom Actions ══ \*/\}'

new_3 = '''              {/* ══════════════════════════════════ STEP 3 — معاينة ونشر ══════════════════════════════════ */}
              {wizardStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
                  
                  {/* Summary Card */}
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-200/50 dark:border-emerald-800/40">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm shrink-0 bg-white dark:bg-[#0B100E] border border-emerald-100 dark:border-emerald-800">
                        {isContestMode ? "🏆" : "📋"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-100 truncate">{title || (lang === "ar" ? "(بدون عنوان)" : "(Untitled)")}</h2>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-black border border-emerald-300/30 dark:border-emerald-700/30">{subject || (lang === "ar" ? "عام" : "General")}</span>
                          <span className="bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-black border border-emerald-300/30 dark:border-emerald-700/30">{questions.length} {t.createAssignment.aiQuestions}</span>
                          <span className="bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-black border border-emerald-300/30 dark:border-emerald-700/30">{totalPoints} {t.createAssignment.gradeUnit}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submission & Sharing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 shadow-sm border border-emerald-50 dark:border-emerald-900/30 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Monitor className="w-4 h-4 text-emerald-500" />
                          <Label className="text-sm font-black">{t.createAssignment.submissionModeLabel}</Label>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mb-4">{lang === "ar" ? "كيف سيحل الطلاب هذا الواجب؟" : "How will students solve this?"}</p>
                      </div>
                      <div className="flex bg-[#f4f7f5] dark:bg-[#0B100E] p-1.5 rounded-2xl">
                        <button type="button" onClick={() => handleModeChange("electronic")}
                          className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${submissionMode === "electronic" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                          {t.createAssignment.submissionElectronic}
                        </button>
                        <button type="button" onClick={() => handleModeChange("both")}
                          className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${submissionMode === "both" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                          {t.createAssignment.submissionBoth}
                        </button>
                        <button type="button" onClick={() => handleModeChange("paper")}
                          className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${submissionMode === "paper" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                          {t.createAssignment.submissionPaper}
                        </button>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 shadow-sm border border-emerald-50 dark:border-emerald-900/30 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Globe className="w-4 h-4 text-emerald-500" />
                          <Label className="text-sm font-black">{lang === "ar" ? "مشاركة المحتوى" : "Sharing"}</Label>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mb-4">{lang === "ar" ? "هل تريد ظهوره في المكتبة العامة لمعلمي حصاد؟" : "Should this appear in the public library?"}</p>
                      </div>
                      <div className="flex bg-[#f4f7f5] dark:bg-[#0B100E] p-1.5 rounded-2xl">
                        <button type="button" onClick={() => setIsShared(true)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-xl transition-all ${isShared ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                          <Globe className="w-3.5 h-3.5" /> {lang === "ar" ? "مكتبة عامة" : "Public Library"}
                        </button>
                        <button type="button" onClick={() => setIsShared(false)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-xl transition-all ${!isShared ? "bg-amber-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                          <Lock className="w-3.5 h-3.5" /> {lang === "ar" ? "خاص بي" : "Private"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="bg-white dark:bg-[#15201B] rounded-3xl shadow-sm border border-emerald-50 dark:border-emerald-900/30 overflow-hidden divide-y divide-emerald-50 dark:divide-emerald-900/20">
                    
                    {/* Category */}
                    {isShared && availableCategories.length > 0 && (
                      <div className="p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <Tag className="w-5 h-5 text-emerald-500" />
                          <div>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "التصنيف (اختياري)" : "Category (Optional)"}</p>
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">{lang === "ar" ? "يساعد المعلمين الآخرين على إيجاد محتواك" : "Helps other teachers find your content"}</p>
                          </div>
                        </div>
                        <select value={categoryId || ""} onChange={e => setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-40 bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-400">
                          <option value="">{lang === "ar" ? "بدون تصنيف" : "None"}</option>
                          {availableCategories.map(c => <option key={c.id} value={c.id}>{lang === "ar" ? c.name : c.nameEn || c.name}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Deadline */}
                    <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{t.createAssignment.deadlineLabel}</p>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">{t.createAssignment.deadlineDesc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {deadline && <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg" dir="ltr">{new Date(deadline).toLocaleString(lang==="ar"?"ar-SA":"en-US", {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"})}</span>}
                        <button type="button" onClick={() => setShowDatePicker(true)}
                          className="px-4 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs font-black rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                          {deadline ? (lang === "ar" ? "تغيير" : "Change") : (lang === "ar" ? "تحديد الموعد" : "Set Deadline")}
                        </button>
                        {deadline && <button type="button" onClick={() => setDeadline("")} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>}
                      </div>
                    </div>

                    {/* Exam Mode */}
                    <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{t.createAssignment.examMode}</p>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">{t.createAssignment.examModeDesc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {examMode && (
                          <div className="flex items-center gap-2">
                            <input type="number" min="1" value={examDurationMinutes} onChange={e => setExamDurationMinutes(parseInt(e.target.value) || 30)}
                              className="w-16 bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-100 dark:border-emerald-800 text-center text-sm font-black rounded-xl py-1.5 focus:outline-none focus:border-emerald-400" />
                            <span className="text-[11px] font-bold text-slate-500">{t.createAssignment.minute}</span>
                          </div>
                        )}
                        <Toggle on={examMode} onChange={() => setExamMode(!examMode)} />
                      </div>
                    </div>

                    {/* Show Results to students */}
                    <div className="p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{t.createAssignment.showResults}</p>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">{t.createAssignment.showResultsDesc}</p>
                        </div>
                      </div>
                      <Toggle on={showResults} onChange={() => setShowResults(!showResults)} />
                    </div>

                  </div>

                  {/* Advanced Settings Button */}
                  <button type="button" onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="w-full py-4 flex items-center justify-center gap-2 text-[11px] font-black text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                    <Settings2 className="w-4 h-4" /> {lang === "ar" ? "إعدادات متقدمة" : "Advanced Settings"}
                    {showAdvancedSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <AnimatePresence initial={false}>
                    {showAdvancedSettings && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="bg-white dark:bg-[#15201B] rounded-3xl shadow-sm border border-emerald-50 dark:border-emerald-900/30 overflow-hidden divide-y divide-emerald-50 dark:divide-emerald-900/20 mb-4">
                          
                          {/* Allow Retry */}
                          <div className="p-5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800"><RotateCcw className="w-4 h-4 text-slate-600 dark:text-slate-400" /></div>
                              <div>
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "السماح بإعادة المحاولة" : "Allow Retry"}</p>
                                <p className="text-[11px] font-bold text-slate-500 mt-0.5">{lang === "ar" ? "يمكن للطالب إعادة الواجب لتحسين درجته" : "Students can retry to improve score"}</p>
                              </div>
                            </div>
                            <Toggle on={allowRetry} onChange={() => setAllowRetry(!allowRetry)} color="orange" />
                          </div>

                          {/* Adaptive Learning */}
                          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800"><Brain className="w-4 h-4 text-slate-600 dark:text-slate-400" /></div>
                              <div>
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "التعلم التكيفي الموجه" : "Adaptive Learning"}</p>
                                <p className="text-[11px] font-bold text-slate-500 mt-0.5">{lang === "ar" ? "طرح الأسئلة حسب مهارة الطالب" : "Questions adapt to student skill"}</p>
                              </div>
                            </div>
                            <Toggle on={isAdaptive} onChange={() => setIsAdaptive(!isAdaptive)} color="orange" />
                          </div>

                          {/* Adaptive Skills Details */}
                          {isAdaptive && (
                            <div className="p-5 bg-slate-50/50 dark:bg-slate-900/10">
                              <Label className="text-[11px] font-bold text-slate-500 mb-2 block">{lang === "ar" ? "المهارات المستهدفة" : "Target Skills"}</Label>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {adaptiveSkills.map(skill => (
                                  <span key={skill} className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                    {skill} <button onClick={() => setAdaptiveSkills(prev => prev.filter(s => s !== skill))}><X className="w-3 h-3 hover:text-red-500" /></button>
                                  </span>
                                ))}
                              </div>
                              <input value={adaptiveSkillInput} onChange={e => setAdaptiveSkillInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && adaptiveSkillInput.trim() && !adaptiveSkills.includes(adaptiveSkillInput.trim())) { setAdaptiveSkills([...adaptiveSkills, adaptiveSkillInput.trim()]); setAdaptiveSkillInput(""); e.preventDefault(); } }}
                                placeholder={lang === "ar" ? "اضغط Enter لإضافة مهارة (اختياري)" : "Press Enter to add skill"}
                                className="w-full bg-white dark:bg-[#15201B] border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-400" />
                              <div className="mt-4 flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-500">{lang === "ar" ? "عدد أسئلة الجلسة" : "Questions per session"}</span>
                                <input type="number" min="1" max="50" value={adaptiveQuestionsPerSession} onChange={e => setAdaptiveQuestionsPerSession(parseInt(e.target.value) || 10)}
                                  className="w-16 bg-white dark:bg-[#15201B] border border-emerald-100 dark:border-emerald-800 rounded-xl px-2 py-1 text-center text-xs font-bold focus:outline-none focus:border-emerald-400" />
                              </div>
                            </div>
                          )}

                          {/* Access Mode */}
                          {isAdmin && (
                            <div className="p-5 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800"><Lock className="w-4 h-4 text-slate-600 dark:text-slate-400" /></div>
                                <div>
                                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "الوصول" : "Access"}</p>
                                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">{lang === "ar" ? "مقيد برمز مرور أم متاح للجميع" : "Restrict by passcode or public"}</p>
                                </div>
                              </div>
                              <select value={accessMode} onChange={e => setAccessMode(e.target.value as AccessMode)}
                                className="bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-400">
                                <option value="public">{t.createAssignment.accessPublic}</option>
                                <option value="private">{t.createAssignment.accessPrivate}</option>
                              </select>
                            </div>
                          )}
                          {isAdmin && accessMode === "private" && (
                            <div className="p-5 bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-500">{t.createAssignment.accessCode}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold bg-white dark:bg-[#15201B] border border-emerald-100 dark:border-emerald-800 px-3 py-1 rounded-lg">{accessCode}</span>
                                <button type="button" onClick={() => setAccessCode(generateAccessCode())} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg transition-colors">{lang === "ar" ? "تجديد" : "Regenerate"}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              )}
              {/* ══ Bottom Actions ══ */}'''

content = re.sub(pattern3, new_3, content, flags=re.DOTALL)
with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)

print("Replaced wrapper step 3")
