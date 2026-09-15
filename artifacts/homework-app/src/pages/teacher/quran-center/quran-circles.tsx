import { useState } from "react";
import { 
  useListQuranCircles, 
  useListQuranStudents, 
  useCreateQuranCircle,
  useUpdateQuranCircle,
  QuranCircle,
  QuranSurah
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { 
  Loader2, Plus, Users, ChevronRight, ChevronLeft, 
  User, ArrowRight, ArrowLeft, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { QuranStudentProfileView } from "./quran-student-profile";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

export function QuranCircles({ surahs }: { surahs: QuranSurah[] }) {
  const { lang, dir } = useI18n();
  const ChevronIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const { data: circles, isLoading: loadingCircles, refetch: refetchCircles } = useListQuranCircles();
  const { data: rosterStudents, isLoading: loadingRoster } = useListQuranStudents();
  
  const createCircle = useCreateQuranCircle();

  const [selectedCircle, setSelectedCircle] = useState<QuranCircle | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");
  const [isManagingMembers, setIsManagingMembers] = useState(false);

  const handleCreate = () => {
    if (!newCircleName.trim()) return;
    createCircle.mutate(
      { data: { name: newCircleName.trim(), studentIds: [] } },
      {
        onSuccess: (newCircle) => {
          toast.success(lang === "ar" ? "تم إنشاء الحلقة بنجاح" : "Circle created successfully");
          setIsCreating(false);
          setNewCircleName("");
          refetchCircles();
          setSelectedCircle(newCircle);
        },
        onError: () => {
          toast.error(lang === "ar" ? "حدث خطأ أثناء الإنشاء" : "Failed to create circle");
        }
      }
    );
  };

  if (loadingCircles || loadingRoster) {
    return (
      <div className="flex h-full items-center justify-center text-emerald-800/40">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const activeCircle = circles?.find(c => c.id === selectedCircle?.id) || selectedCircle;

  // If a student is selected, show their profile full-pane or split. Let's do full-pane for focus.
  if (selectedStudentId) {
    const studentInfo = rosterStudents?.find(s => s.id === selectedStudentId);
    return (
      <div className="p-6 max-w-5xl mx-auto h-full flex flex-col">
        <div className="mb-4">
          <button 
            onClick={() => setSelectedStudentId(null)}
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <BackIcon className="w-4 h-4" />
            {lang === "ar" ? "العودة إلى الحلقة" : "Back to Circle"}
          </button>
        </div>
        <QuranStudentProfileView 
          studentId={selectedStudentId} 
          studentName={studentInfo?.name || "Student"} 
          surahs={surahs} 
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Circles List Sidebar */}
      <div className={cn(
        "w-full md:w-80 border-e border-border/60 bg-white/50 dark:bg-card/50 flex flex-col shrink-0",
        selectedCircle ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <h2 className="font-black text-lg text-foreground">
            {lang === "ar" ? "الحلقات" : "Circles"}
          </h2>
          <button 
            onClick={() => setIsCreating(true)}
            className="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {isCreating && (
            <div className="p-3 bg-white dark:bg-card rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm mb-4">
              <input
                autoFocus
                value={newCircleName}
                onChange={e => setNewCircleName(e.target.value)}
                placeholder={lang === "ar" ? "اسم الحلقة..." : "Circle name..."}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-bold mb-3 outline-none focus:border-emerald-500"
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setIsCreating(false);
                }}
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-md"
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button 
                  onClick={handleCreate}
                  disabled={!newCircleName.trim() || createCircle.isPending}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  {createCircle.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === "ar" ? "حفظ" : "Save")}
                </button>
              </div>
            </div>
          )}

          {circles?.map(circle => (
            <button
              key={circle.id}
              onClick={() => setSelectedCircle(circle)}
              className={cn(
                "w-full text-start p-3 rounded-xl transition-all border flex items-center justify-between group",
                selectedCircle?.id === circle.id 
                  ? "bg-white dark:bg-card border-emerald-200 dark:border-emerald-800 shadow-sm"
                  : "border-transparent hover:bg-white/60 dark:hover:bg-card hover:border-border/60"
              )}
            >
              <div>
                <h3 className={cn(
                  "font-bold text-sm",
                  selectedCircle?.id === circle.id ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                )}>{circle.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {circle.members.length} {lang === "ar" ? "طلاب" : "students"}
                </p>
              </div>
              <ChevronIcon className={cn(
                "w-4 h-4 text-muted-foreground/40 transition-transform group-hover:text-muted-foreground group-hover:-translate-x-0.5",
                selectedCircle?.id === circle.id && "text-emerald-500"
              )} />
            </button>
          ))}

          {circles?.length === 0 && !isCreating && (
            <div className="text-center p-6 text-muted-foreground">
              <Users className="w-8 h-8 opacity-20 mx-auto mb-2" />
              <p className="text-xs font-bold">{lang === "ar" ? "لا توجد حلقات بعد" : "No circles yet"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Circle Details Area */}
      <div className={cn(
        "flex-1 bg-[#fcfaf8] dark:bg-background overflow-y-auto",
        !selectedCircle ? "hidden md:block" : "block"
      )}>
        {activeCircle ? (
          <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6 md:mb-8">
              <button 
                onClick={() => setSelectedCircle(null)}
                className="md:hidden p-2 bg-white dark:bg-card border border-border shadow-sm rounded-lg hover:bg-muted/50 transition-colors shrink-0"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl font-black text-foreground">{activeCircle.name}</h2>
                <p className="text-muted-foreground text-sm font-semibold mt-1">
                  {activeCircle.members.length} {lang === "ar" ? "طالب مسجل" : "registered students"}
                </p>
              </div>
              <button 
                onClick={() => setIsManagingMembers(true)}
                className="px-3 md:px-4 py-2 bg-white dark:bg-card border border-border shadow-sm rounded-lg text-xs md:text-sm font-bold hover:bg-muted/50 transition-colors shrink-0"
              >
                {lang === "ar" ? "إضافة أو إزالة طلاب" : "Manage Students"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCircle.members.map(member => (
                <button
                  key={member.id}
                  onClick={() => setSelectedStudentId(member.id)}
                  className="bg-white dark:bg-card p-4 rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all flex items-center justify-between text-start group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">{member.name}</h4>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {member.gradeLevel || (lang === "ar" ? "غير محدد" : "Unspecified")}
                      </p>
                    </div>
                  </div>
                  <ChevronIcon className="w-5 h-5 text-muted-foreground/30 group-hover:text-emerald-500 transition-colors" />
                </button>
              ))}

              {activeCircle.members.length === 0 && (
                <div className="col-span-full p-12 text-center text-muted-foreground bg-white/50 dark:bg-card/50 rounded-2xl border border-dashed border-border">
                  <Users className="w-12 h-12 opacity-20 mx-auto mb-4" />
                  <p className="font-bold text-lg">{lang === "ar" ? "لا يوجد طلاب في هذه الحلقة" : "No students in this circle"}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Users className="w-16 h-16 opacity-10 mb-4" />
            <p className="font-bold text-lg text-foreground/40">
              {lang === "ar" ? "اختر حلقة لعرض التفاصيل" : "Select a circle to view details"}
            </p>
          </div>
        )}
      </div>

      {isManagingMembers && activeCircle && (
        <AddMemberModal 
          circle={activeCircle}
          rosterStudents={rosterStudents || []}
          onClose={() => setIsManagingMembers(false)}
        />
      )}
    </div>
  );
}
function AddMemberModal({ 
  circle, 
  rosterStudents, 
  onClose 
}: { 
  circle: QuranCircle, 
  rosterStudents: any[], 
  onClose: () => void 
}) {
  const { lang } = useI18n();
  const updateCircle = useUpdateQuranCircle();
  const queryClient = useQueryClient();
  
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(
    circle.members.map(m => m.id)
  );

  const toggleStudent = (id: number) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    updateCircle.mutate({
      id: circle.id,
      data: { studentIds: selectedStudentIds }
    }, {
      onSuccess: () => {
        toast.success(lang === "ar" ? "تم تحديث الأعضاء بنجاح" : "Members updated successfully");
        queryClient.invalidateQueries();
        onClose();
      },
      onError: () => {
        toast.error(lang === "ar" ? "فشل تحديث الأعضاء" : "Failed to update members");
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-3xl border-border flex flex-col max-h-[80vh]">
        <DialogHeader className="p-6 border-b border-border/60 bg-muted/20">
          <DialogTitle className="font-black text-xl text-foreground">
            {lang === "ar" ? "إضافة أو إزالة طلاب" : "Manage Students"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {rosterStudents.map(student => {
            const isSelected = selectedStudentIds.includes(student.id);
            return (
              <button
                key={student.id}
                onClick={() => toggleStudent(student.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500",
                  isSelected 
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800" 
                    : "bg-background border-border hover:bg-muted/50"
                )}
              >
                <div className="text-start">
                  <p className="font-bold text-sm text-foreground">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.gradeLevel || (lang === "ar" ? "غير محدد" : "Unspecified")}</p>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border flex items-center justify-center",
                  isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30"
                )}>
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
              </button>
            );
          })}
        </div>
        
        <DialogFooter className="p-6 border-t border-border/60 bg-muted/20 sm:justify-end gap-3 flex-row justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
          >
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button 
            onClick={handleSave}
            disabled={updateCircle.isPending}
            className="px-5 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {updateCircle.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {lang === "ar" ? "حفظ" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
