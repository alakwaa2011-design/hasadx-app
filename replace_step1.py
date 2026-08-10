import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# Replace Step 1
pattern = r'        \{\/\* ══════════════════════════════════ STEP 1 — الأساسيات ══════════════════════════════════ \*\/\}.*?              \{\/\* ══════════════════════════════════ STEP 2 — الأسئلة ══════════════════════════════════ \*\/\}'

new_text = '''        {/* ══════════════════════════════════ STEP 1 — الأساسيات ══════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {wizardStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
              
              {/* Type Selection */}
              <div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "نوع المحتوى" : "Content type"}</h3>
                    <p className="text-[11px] font-bold text-slate-500">{lang === "ar" ? "حدد أين سيظهر هذا المحتوى في المكتبة العامة" : "Choose where this content appears in the public library"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsContestMode(false)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-start transition-all ${!isContestMode ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-sm shadow-emerald-500/10" : "border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800/50"}`}
                  >
                    <FileText className={`w-6 h-6 ${!isContestMode ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <div className={`text-sm font-black leading-tight ${!isContestMode ? "text-emerald-800 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}`}>{lang === "ar" ? "واجب أو اختبار" : "Homework"}</div>
                      <div className="text-[11px] font-bold mt-0.5 text-slate-500 truncate">{lang === "ar" ? "يظهر في مكتبة الأنشطة" : "Lands in Activities Library"}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsContestMode(true)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-start transition-all ${isContestMode ? "border-amber-500 bg-amber-50/50 dark:bg-amber-900/20 shadow-sm shadow-amber-500/10" : "border-slate-100 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-800/50"}`}
                  >
                    <Star className={`w-6 h-6 ${isContestMode ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <div className={`text-sm font-black leading-tight ${isContestMode ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>{lang === "ar" ? "أسئلة مسابقة" : "Competition question"}</div>
                      <div className="text-[11px] font-bold mt-0.5 text-slate-500 truncate">{lang === "ar" ? "يظهر في مكتبة المسابقات" : "Lands in Competitions Library"}</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Basic Info Form */}
              <div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 space-y-5">
                <div>
                  <Label className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    {t.createAssignment.assignmentTitle} <span className="text-red-500">*</span>
                  </Label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={t.createAssignment.titlePlaceholder}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-emerald-500" />
                      {t.createAssignment.subjectLabel}
                    </Label>
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder={t.createAssignment.subjectPlaceholder}
                      list="subject-suggestions"
                      className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all"
                    />
                    <datalist id="subject-suggestions">{getSuggestions("subjects").map((s, i) => <option key={i} value={s} />)}</datalist>
                    {isMathSubject && <p className="text-[10px] text-amber-600 mt-1.5 font-bold flex items-center gap-1"><Sparkles className="w-3 h-3"/> {lang === "ar" ? "سيتم تفعيل شريط الرياضيات تلقائياً" : "Math toolbar will activate automatically"}</p>}
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                      {t.createAssignment.targetClass}
                    </Label>
                    <div className="bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl p-1.5 min-h-[50px] focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all flex flex-wrap items-center gap-1.5">
                      {targetClasses.map(c => (
                        <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-black border border-emerald-200/50 dark:border-emerald-800/50">
                          {c}
                          <button type="button" onClick={() => setTargetClasses(prev => prev.filter(x => x !== c))} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                      {gradeLevels.length > 0 ? (
                        <select onChange={e => { if (e.target.value && !targetClasses.includes(e.target.value)) setTargetClasses([...targetClasses, e.target.value]); e.target.value = ""; }} className="flex-1 min-w-[120px] bg-transparent text-sm font-bold text-slate-700 dark:text-slate-300 outline-none px-2 py-1.5 cursor-pointer">
                          <option value="">{lang === "ar" ? "اختر من صفوفك..." : "Select class..."}</option>
                          {gradeLevels.map(g => <option key={g.gradeLevel} value={g.gradeLevel}>{g.gradeLevel}</option>)}
                        </select>
                      ) : (
                        <input value={classInput} onChange={e => setClassInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && classInput.trim()) { e.preventDefault(); if (!targetClasses.includes(classInput.trim())) setTargetClasses([...targetClasses, classInput.trim()]); setClassInput(""); } }} placeholder={lang === "ar" ? "اضغط Enter للإضافة" : "Press Enter to add"} className="flex-1 min-w-[120px] bg-transparent text-sm font-bold text-slate-700 dark:text-slate-300 outline-none px-2 py-1.5" />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {t.createAssignment.descLabel}
                  </Label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t.createAssignment.descPlaceholder}
                    rows={2}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Templates Section */}
              <div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "قوالب جاهزة" : "Ready Templates"}</h3>
                    <p className="text-[11px] font-bold text-slate-500">{lang === "ar" ? "ابدأ بسرعة أو أنشئ من الصفر" : "Start quickly or build from scratch"}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const scratch = TEMPLATES.find(t => t.id === "scratch")!;
                    return (
                      <button type="button" onClick={() => applyTemplate(scratch)}
                        className={`w-full relative text-start p-5 rounded-2xl border-2 transition-all hover:shadow-md active:scale-[0.99] overflow-hidden bg-gradient-to-r from-emerald-500 to-emerald-600 border-transparent shadow-emerald-500/20 shadow-lg ${selectedTemplateId === "scratch" ? "ring-4 ring-emerald-500/30 ring-offset-2 dark:ring-offset-[#15201B]" : ""}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shrink-0 backdrop-blur-sm">
                            {scratch.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg font-black text-white leading-tight">{lang === "ar" ? scratch.title : scratch.titleEn}</p>
                            <p className="text-xs font-bold mt-1 text-emerald-100 truncate">{lang === "ar" ? scratch.desc : scratch.descEn}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-emerald-200 shrink-0 rtl:rotate-180" />
                        </div>
                      </button>
                    );
                  })()}

                  <div>
                    <button type="button" onClick={() => setShowTemplates(v => !v)}
                      className="flex items-center justify-between w-full p-4 rounded-2xl bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors group">
                      <span className="text-sm font-black text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {lang === "ar" ? "تصفح القوالب الجاهزة المتبقية" : "Browse other ready-made templates"}
                      </span>
                      <div className="flex items-center gap-2">
                        {!showTemplates && <span className="text-[11px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-1 rounded-full">{TEMPLATES.length - 1}</span>}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showTemplates ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {showTemplates && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                            {TEMPLATES.filter(tmpl => tmpl.id !== "scratch").map((tmpl) => (
                              <button key={tmpl.id} type="button" onClick={() => applyTemplate(tmpl)}
                                className={`group flex flex-col text-start p-4 rounded-2xl bg-[#f4f7f5] dark:bg-[#0B100E] border-2 transition-all hover:shadow-md active:scale-[0.98] ${selectedTemplateId === tmpl.id ? "border-emerald-500 shadow-sm" : "border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"}`}>
                                <div className="flex items-start justify-between gap-2 mb-2 w-full">
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-110" style={{ backgroundColor: tmpl.bgColor }}>
                                    {tmpl.emoji}
                                  </div>
                                  <div className="flex flex-wrap gap-1 justify-end">
                                    {(lang === "ar" ? tmpl.tags : tmpl.tagsEn).map(tag => (
                                      <span key={tag} className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-500 shadow-sm border border-slate-100 dark:border-slate-700">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? tmpl.title : tmpl.titleEn}</p>
                                <p className="text-[11px] font-bold text-slate-500 mt-1 line-clamp-2">{lang === "ar" ? tmpl.desc : tmpl.descEn}</p>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
              {/* ══════════════════════════════════ STEP 2 — الأسئلة ══════════════════════════════════ */}'''

content = re.sub(pattern, new_text, content, flags=re.DOTALL)
with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)

print("Replacement complete")
