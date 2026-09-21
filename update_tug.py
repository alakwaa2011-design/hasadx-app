import sys
with open('artifacts/homework-app/src/pages/game/tug-create.tsx', 'r') as f:
  content = f.read()

start_idx = content.find('  return (\n    <Layout>')
if start_idx != -1:
  new_content = content[:start_idx] + """  return (
    <Layout>
      <div className="min-h-screen bg-[#FAF8F0]" dir={dir}>
        <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6">
          <GameFlowBackButton onBack={handleFlowBack} />
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-2 pt-5 sm:px-6">
          <div className="rounded-3xl border border-[#0B4B35]/10 bg-white px-4 py-4 shadow-sm sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B4B35] text-white">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-[#0B4B35] sm:text-xl">{ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}</h1>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{ar ? "اضبط المنافسة ثم انتقل لبدء اللعب" : "Set the match, then get ready to start"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#FAF8F0] px-3 py-2" style={{ direction: "ltr" }}>
                <span className="flex items-center gap-1.5 text-xs font-black text-red-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-red-500" />{ar ? "الأحمر" : "Red"}</span>
                <Swords className="h-4 w-4 text-slate-300" />
                <span className="flex items-center gap-1.5 text-xs font-black text-blue-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-blue-500" />{ar ? "الأزرق" : "Blue"}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mx-auto max-w-3xl px-4 py-5 pb-8 sm:px-6">
          <div className="mb-6 flex justify-center">
            <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-[#0B4B35]/10 bg-white p-1 shadow-sm">
              <span className="flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] font-bold text-[#0B4B35] sm:text-xs"><CircleCheck className="h-3.5 w-3.5" />{ar ? "الأسئلة" : "Questions"}</span>
              <span className="rounded-xl bg-[#0B4B35] px-2 py-2 text-center text-[11px] font-black text-white shadow-sm sm:text-xs">{ar ? "إعدادات اللعبة" : "Settings"}</span>
              <span className="rounded-xl px-2 py-2 text-center text-[11px] font-bold text-slate-400 sm:text-xs">{ar ? "الاستعداد والبدء" : "Ready"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 mb-5 max-w-3xl mx-auto">
            {/* Top Summary Card */}
            <div className="bg-white rounded-2xl border border-[#0B4B35]/10 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-[#0B4B35]/5 flex items-center justify-center">
                     <ListChecks className="w-5 h-5 text-[#0B4B35]" />
                   </div>
                   <div>
                     <h3 className="font-bold text-sm text-gray-800">{sourceTitle || (ar ? 'أسئلة مخصصة' : 'Custom Questions')}</h3>
                     <p className="text-xs text-gray-500 font-medium">{questionCount} {ar ? 'سؤال' : 'Questions'}</p>
                   </div>
                </div>
                <button onClick={() => setSetupStep("questions")} data-testid="button-edit-questions" className="text-xs font-bold text-[#0B4B35] hover:text-emerald-700 transition-colors bg-[#0B4B35]/5 px-3 py-1.5 rounded-lg">
                  {ar ? 'تعديل' : 'Edit'}
                </button>
              </div>
            </div>

            {/* Main Settings Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-[#0B4B35]/10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#0B4B35]/[0.02] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              
              <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-5">
                <Clock className="w-4 h-4 text-[#0B4B35]" />
                {ar ? "قواعد المنافسة" : "Match Rules"}
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  onClick={() => setEndMode("questions")}
                  className={`relative p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${endMode === "questions" ? "border-[#0B4B35] bg-[#0B4B35]/5 text-[#0B4B35]" : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"}`}
                  data-testid="button-endmode-questions"
                >
                  {endMode === "questions" && <Check className="absolute top-2 right-2 w-4 h-4 text-[#0B4B35]" />}
                  <ListChecks className="h-5 w-5" />
                  <span className="text-xs font-bold">{ar ? "حتى انتهاء الأسئلة" : "Questions Finish"}</span>
                </button>
                <button
                  onClick={() => setEndMode("time")}
                  className={`relative p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${endMode === "time" ? "border-[#0B4B35] bg-[#0B4B35]/5 text-[#0B4B35]" : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"}`}
                  data-testid="button-endmode-time"
                >
                  {endMode === "time" && <Check className="absolute top-2 right-2 w-4 h-4 text-[#0B4B35]" />}
                  <Timer className="h-5 w-5" />
                  <span className="text-xs font-bold">{ar ? "وقت محدد للمباراة" : "Time Limit"}</span>
                </button>
              </div>

              <AnimatePresence>
                {endMode === "time" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-5"
                  >
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0B4B35]/5 border border-[#0B4B35]/10">
                      <span className="text-sm font-bold text-gray-700">
                        {ar ? "مدة اللعب (دقائق):" : "Match duration (minutes):"}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={matchDurationMinutes === "" ? "" : matchDurationMinutes}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMatchDurationMinutes(v === "" ? "" : Math.max(1, Math.min(60, Number(v))));
                        }}
                        onBlur={() => {
                          if (matchDurationMinutes === "") setMatchDurationMinutes(2);
                        }}
                        data-testid="input-match-duration"
                        className="w-16 rounded-xl border-2 border-[#0B4B35]/20 bg-white px-2 py-1 text-center text-sm font-black text-[#0B4B35] outline-none transition-colors focus:border-[#0B4B35]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold text-gray-700">{ar ? "وقت السؤال الواحد" : "Time per question"}</span>
                <div className="flex gap-1 bg-gray-100/80 rounded-xl p-1">
                  {[10, 15, 20, 30].map(s => (
                    <button key={s} onClick={() => setDuration(s)}
                      data-testid={`button-duration-${s}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${duration === s ? "bg-[#0B4B35] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      {s}{ar ? "ث" : "s"}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Advanced Settings */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-3xl border border-[#0B4B35]/10 overflow-hidden shadow-sm">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)} 
                data-testid="button-toggle-advanced"
                className="w-full flex items-center justify-between p-5 sm:p-6 bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-gray-400" />
                  {ar ? "إعدادات متقدمة" : "Advanced Settings"}
                </span>
                <motion.div animate={{ rotate: showAdvanced ? (dir === 'rtl' ? 180 : -180) : 0 }} className="text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-5 sm:p-6 pt-0 flex flex-col gap-6 bg-gray-50/50">
                      
                      {gradeLevels.length > 0 && (
                        <div>
                          <span className="block text-sm font-bold text-gray-700 mb-2">{ar ? "الفصل المستهدف (اختياري)" : "Target Class (Optional)"}</span>
                          <select value={targetClass} onChange={e => setTargetClass(e.target.value)} data-testid="select-target-class" className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700 outline-none focus:border-[#0B4B35] transition-colors appearance-none">
                            <option value="">{ar ? "جميع الفصول" : "All Classes"}</option>
                            {gradeLevels.map(g => (
                              <option key={g.gradeLevel} value={g.gradeLevel}>{g.gradeLevel}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block text-sm font-bold text-gray-700">{ar ? "التقدم التلقائي" : "Auto Advance"}</span>
                          <span className="text-xs font-medium text-gray-500 mt-0.5 block">{ar ? "الانتقال للسؤال التالي بعد الإجابة مباشرة" : "Move to next question after answering"}</span>
                        </div>
                        <button onClick={() => setAutoAdvance(!autoAdvance)} data-testid="button-auto-advance" className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${autoAdvance ? "bg-[#0B4B35]" : "bg-gray-300"}`}>
                          <motion.div animate={{ x: autoAdvance ? (dir === 'rtl' ? -20 : 20) : (dir === 'rtl' ? -2 : 2) }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm" />
                        </button>
                      </div>
                      
                      <div className="border border-gray-200 rounded-2xl p-4 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-800">{ar ? "الهدايا والمفاجآت" : "Gifts & Surprises"}</span>
                          <button onClick={() => setGiftsEnabled(!giftsEnabled)} data-testid="button-gifts-enabled" className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${giftsEnabled ? "bg-amber-500" : "bg-gray-300"}`}>
                            <motion.div animate={{ x: giftsEnabled ? (dir === 'rtl' ? -20 : 20) : (dir === 'rtl' ? -2 : 2) }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">{ar ? "تظهر هدايا للفريق أثناء اللعب مثل مضاعفة النقاط أو تجميد الفريق الآخر" : "Gifts like double points or freeze effect appear during play"}</p>
                        
                        <AnimatePresence>
                          {giftsEnabled && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="pt-3 border-t border-gray-100 flex flex-col gap-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs font-bold text-gray-600">{ar ? "ظهور الهدية كل:" : "Gift appears every:"}</span>
                                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                                    {[1, 2, 3].map(n => (
                                      <button key={n} onClick={() => setGiftEveryCorrect(n as 1|2|3)} data-testid={`button-gift-freq-${n}`} className={`px-2 py-1 rounded text-[11px] sm:text-xs font-black transition-colors ${giftEveryCorrect === n ? "bg-white shadow-sm text-amber-600" : "text-gray-500 hover:text-gray-700"}`}>
                                        {n} {ar ? "أسئلة" : "questions"}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs font-bold text-gray-600">{ar ? "مدة تجميد الخصم:" : "Freeze duration:"}</span>
                                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                                    {[3, 5, 7, 10].map(s => (
                                      <button key={s} onClick={() => setFreezeDuration(s)} data-testid={`button-freeze-dur-${s}`} className={`px-2 py-1 rounded text-[11px] sm:text-xs font-black transition-colors ${freezeDuration === s ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                                        {s}{ar ? "ث" : "s"}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Actions Card: Red vs Blue Launch */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <button 
                onClick={startClassMode}
                disabled={creating}
                data-testid="button-start-class-mode"
                className="relative overflow-hidden group bg-red-500 text-white p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-sm disabled:opacity-70 h-28"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Monitor className="w-8 h-8" />
                <span className="font-black text-sm">{ar ? "عرض على السبورة" : "Board Mode"}</span>
              </button>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleCopyLink}
                  disabled={copyingLink || creating}
                  data-testid="button-copy-link"
                  className="bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200 p-4 rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-70 font-black text-sm h-12 sm:h-[3.25rem]"
                >
                  {copyingLink ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5" />}
                  {ar ? "نسخ رابط اللعبة" : "Copy Game Link"}
                </button>
                <button 
                  onClick={handleCreate}
                  disabled={creating || copyingLink}
                  data-testid="button-host-game"
                  className="bg-blue-500 text-white hover:bg-blue-600 p-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-sm disabled:opacity-70 font-black text-sm h-12 sm:h-[3.25rem] group"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-white" />}
                  {ar ? "بدء المنافسة كمعلم" : "Host Match"}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
"""
  with open('artifacts/homework-app/src/pages/game/tug-create.tsx', 'w') as f:
    f.write(new_content)
