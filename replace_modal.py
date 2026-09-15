import re

with open('artifacts/homework-app/src/pages/teacher/quran-center/quran-circles.tsx', 'r') as f:
    content = f.read()

new_code = """type RangeState = {
  id: string;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  isFullSurah: boolean;
};

function AssignCircleTaskModal({ circle, surahs, onClose }: { circle: QuranCircle, surahs: QuranSurah[], onClose: () => void }) {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const queryClient = useQueryClient();
  const assignTask = useAssignQuranCircleTask();

  const [requestId] = useState(() => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));

  const now = new Date();
  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

  const [dueDate, setDueDate] = useState<string>(todayStr);

  const [memorizationRanges, setMemorizationRanges] = useState<RangeState[]>([
    { id: 'm1', surahNumber: 1, startAyah: 1, endAyah: 7, isFullSurah: true }
  ]);
  const [reviewRanges, setReviewRanges] = useState<RangeState[]>([
    { id: 'r1', surahNumber: 1, startAyah: 1, endAyah: 7, isFullSurah: true }
  ]);

  const handleAssign = () => {
    if (!dueDate) {
      toast.error(isArabic ? "يرجى تحديد تاريخ الاستحقاق" : "Due date is required");
      return;
    }

    const mapRange = (r: RangeState) => {
      const s = surahs.find(x => x.number === r.surahNumber);
      return {
        surahNumber: r.surahNumber,
        surahName: s?.arabicName || "",
        startAyah: r.startAyah,
        endAyah: r.endAyah,
      };
    };

    assignTask.mutate({
      id: circle.id,
      data: {
        requestId,
        assignedDate: todayStr,
        dueDate,
        memorization: memorizationRanges.map(mapRange),
        review: reviewRanges.map(mapRange),
        notes: null
      }
    }, {
      onSuccess: () => {
        toast.success(isArabic ? "تم تعيين المهمة لجميع طلاب الحلقة" : "Task assigned to all students");
        queryClient.invalidateQueries();
        onClose();
      },
      onError: () => {
        toast.error(isArabic ? "فشل تعيين المهمة" : "Failed to assign task");
      }
    });
  };

  const totalSegments = memorizationRanges.length + reviewRanges.length;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-3xl border-border flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 border-b border-border/60 bg-muted/20 shrink-0">
          <DialogTitle className="font-black text-xl text-foreground">
            {isArabic ? "مهمة حلقة: " : "Circle Task: "} {circle.name}
          </DialogTitle>
          <p className="mt-1 text-xs font-bold text-muted-foreground">
            {isArabic ? "سيتم تعيين هذه المهمة لجميع طلاب الحلقة" : "Will be assigned to all circle students"}
          </p>
        </DialogHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <CircleWardRangesEditor
            title={isArabic ? "مقاطع الحفظ" : "Memorization Segments"}
            surahs={surahs}
            ranges={memorizationRanges}
            setRanges={setMemorizationRanges}
            isArabic={isArabic}
          />
          <CircleWardRangesEditor
            title={isArabic ? "مقاطع المراجعة" : "Review Segments"}
            surahs={surahs}
            ranges={reviewRanges}
            setRanges={setReviewRanges}
            isArabic={isArabic}
          />
          
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <h3 className="mb-2 font-black text-foreground">{isArabic ? "تاريخ الاستحقاق" : "Due Date"}</h3>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex-row items-center justify-between shrink-0">
          <div className="text-xs font-bold text-muted-foreground flex items-center gap-4 px-2">
            <span>{isArabic ? "الطلاب" : "Students"}: <span className="text-foreground">{circle.members.length}</span></span>
            <span>{isArabic ? "المقاطع" : "Segments"}: <span className="text-foreground">{totalSegments}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              {isArabic ? "إلغاء" : "Cancel"}
            </button>
            <button
              onClick={handleAssign}
              disabled={assignTask.isPending || !dueDate}
              className="px-5 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {assignTask.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isArabic ? "اعتماد المهمة" : "Confirm Task"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CircleWardRangesEditor({
  title, surahs, ranges, setRanges, isArabic
}: {
  title: string;
  surahs: QuranSurah[];
  ranges: RangeState[];
  setRanges: React.Dispatch<React.SetStateAction<RangeState[]>>;
  isArabic: boolean;
}) {
  const addRange = () => {
    setRanges([...ranges, {
      id: Math.random().toString(36).slice(2),
      surahNumber: 1,
      startAyah: 1,
      endAyah: 7,
      isFullSurah: true
    }]);
  };

  const updateRange = (index: number, updates: Partial<RangeState>) => {
    const newRanges = [...ranges];
    newRanges[index] = { ...newRanges[index], ...updates };
    
    if (updates.surahNumber !== undefined) {
      const selectedSurah = surahs.find(s => s.number === newRanges[index].surahNumber);
      const maxAyah = selectedSurah?.ayahCount ?? 1;
      if (newRanges[index].isFullSurah) {
        newRanges[index].startAyah = 1;
        newRanges[index].endAyah = maxAyah;
      } else {
        newRanges[index].startAyah = Math.min(newRanges[index].startAyah, maxAyah);
        newRanges[index].endAyah = Math.min(newRanges[index].endAyah, maxAyah);
      }
    } else if (updates.isFullSurah !== undefined) {
      if (updates.isFullSurah) {
        const selectedSurah = surahs.find(s => s.number === newRanges[index].surahNumber);
        const maxAyah = selectedSurah?.ayahCount ?? 1;
        newRanges[index].startAyah = 1;
        newRanges[index].endAyah = maxAyah;
      }
    }

    setRanges(newRanges);
  };

  const removeRange = (index: number) => {
    if (ranges.length > 1) {
      setRanges(ranges.filter((_, i) => i !== index));
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-muted/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-foreground">{title}</h3>
        <button
          onClick={addRange}
          className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors dark:bg-emerald-900/50 dark:text-emerald-400"
        >
          <Plus className="w-3.5 h-3.5" />
          {isArabic ? "مقطع إضافي" : "Add Segment"}
        </button>
      </div>

      <div className="space-y-3">
        {ranges.map((range, index) => {
          const selectedSurah = surahs.find(s => s.number === range.surahNumber);
          const maxAyah = selectedSurah?.ayahCount ?? 1;

          return (
            <div key={range.id} className="p-3.5 bg-background border border-border rounded-xl relative group shadow-sm flex flex-col gap-3">
              {ranges.length > 1 && (
                <button
                  onClick={() => removeRange(index)}
                  className="absolute top-3.5 rtl:left-3.5 ltr:right-3.5 p-1 text-muted-foreground hover:text-destructive transition-colors bg-background"
                  title={isArabic ? "حذف المقطع" : "Delete Segment"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              
              <div className={ranges.length > 1 ? "rtl:pl-8 ltr:pr-8" : ""}>
                <select
                  value={range.surahNumber}
                  onChange={(e) => updateRange(index, { surahNumber: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                >
                  {surahs.map((surah: any) => (
                    <option key={surah.number} value={surah.number}>
                      {surah.number}. {surah.arabicName} ({surah.ayahCount} {isArabic ? "آية" : "ayahs"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={range.isFullSurah}
                    onChange={(e) => updateRange(index, { isFullSurah: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{isArabic ? "السورة كاملة" : "Full Surah"}</span>
                </label>
              </div>

              {!range.isFullSurah && (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
                  <label className="text-xs font-bold text-muted-foreground">
                    {isArabic ? "من آية" : "From Ayah"}
                    <input
                      type="number" min={1} max={maxAyah} value={range.startAyah}
                      onChange={(e) => {
                        const val = Math.min(maxAyah, Math.max(1, Number(e.target.value)));
                        updateRange(index, { startAyah: val, endAyah: Math.max(range.endAyah, val) });
                      }}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="text-xs font-bold text-muted-foreground">
                    {isArabic ? "إلى آية" : "To Ayah"}
                    <input
                      type="number" min={range.startAyah} max={maxAyah} value={range.endAyah}
                      onChange={(e) => {
                        const val = Math.min(maxAyah, Math.max(range.startAyah, Number(e.target.value)));
                        updateRange(index, { endAyah: val });
                      }}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-emerald-500"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
"""

start_idx = content.find('function AssignCircleTaskModal')
if start_idx != -1:
    content = content[:start_idx] + new_code
    with open('artifacts/homework-app/src/pages/teacher/quran-center/quran-circles.tsx', 'w') as f:
        f.write(content)
    print("Successfully replaced.")
else:
    print("Could not find function AssignCircleTaskModal")
