import React, { useEffect, useMemo, useState } from "react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check, Loader2, Pencil, Plus, Save, Search, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import {
  type RewardGroup,
  useCreateRewardGroup,
  useDeleteRewardGroup,
  useGetRewardGroups,
  useUpdateRewardGroup,
} from "./api";

export const REWARD_GROUP_COLORS = ["#468064", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0891b2", "#f97316"];

type Student = { id: number; name: string; avatar?: string | null; points?: number };

export function RewardGroupsDialog({ open, onOpenChange, className, students }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  students: Student[];
}) {
  const { data, isLoading } = useGetRewardGroups(className);
  const groups = data?.groups ?? [];
  const createMutation = useCreateRewardGroup();
  const updateMutation = useUpdateRewardGroup();
  const deleteMutation = useDeleteRewardGroup();
  const [selectedId, setSelectedId] = useState<number | "new">("new");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(REWARD_GROUP_COLORS[0]);
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = groups.find((group) => group.id === selectedId);
  const saving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) return;
    if (selectedId !== "new" && !groups.some((group) => group.id === selectedId)) {
      setSelectedId(groups[0]?.id ?? "new");
    }
  }, [groups, open, selectedId]);

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setDescription(selected.description ?? "");
      setColor(selected.color);
      setMemberIds(new Set(selected.members.map((member) => member.studentId)));
    } else {
      setName("");
      setDescription("");
      setColor(REWARD_GROUP_COLORS[groups.length % REWARD_GROUP_COLORS.length]);
      setMemberIds(new Set());
    }
    setSearch("");
    setConfirmDelete(false);
  }, [selectedId, selected?.id]);

  const filteredStudents = useMemo(
    () => students.filter((student) => student.name.toLowerCase().includes(search.trim().toLowerCase())),
    [search, students],
  );

  const toggleMember = (studentId: number) => {
    const next = new Set(memberIds);
    next.has(studentId) ? next.delete(studentId) : next.add(studentId);
    setMemberIds(next);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("اكتب اسم المجموعة");
      return;
    }
    try {
      let groupId = selected?.id;
      if (groupId) {
        await updateMutation.mutateAsync({ className, groupId, name: name.trim(), description: description.trim() || null, color, studentIds: [...memberIds] });
      } else {
        const created = await createMutation.mutateAsync({ className, name: name.trim(), description: description.trim() || null, color, sortOrder: groups.length, studentIds: [...memberIds] });
        groupId = created.id;
      }
      setSelectedId(groupId!);
      toast.success(selected ? "تم تحديث المجموعة" : "تم إنشاء المجموعة وتوزيع الطلاب");
    } catch (error: any) {
      toast.error(error.message || "تعذر حفظ المجموعة");
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteMutation.mutateAsync({ className, groupId: selected.id });
      setSelectedId("new");
      toast.success("تم حذف المجموعة دون التأثير على نقاط الطلاب");
    } catch (error: any) {
      toast.error(error.message || "تعذر حذف المجموعة");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex h-[92dvh] max-h-[850px] flex-col overflow-hidden rounded-[2rem] border-2 border-emerald-100 p-0 sm:max-w-5xl motion-reduce:animate-none">
        <DialogHeader className="shrink-0 border-b-2 border-emerald-800 bg-emerald-950 px-5 py-4 text-white sm:px-7">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-white">
            <UsersRound className="text-amber-400" /> مجموعات الصف
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-emerald-100/75">
            نظّم طلاب {className} في مجموعات ملوّنة، ثم حدد أي مجموعة من لوحة التحفيز بنقرة واحدة.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_1fr]">
          <aside className="flex gap-2 overflow-x-auto border-b-2 border-emerald-100 bg-emerald-50/40 p-3 md:flex-col md:overflow-y-auto md:border-b-0 md:border-l-2">
            <button type="button" onClick={() => setSelectedId("new")}
              className={cn("flex min-w-40 items-center gap-2 rounded-2xl border-2 px-4 py-3 text-right font-black transition-colors", selectedId === "new" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-dashed border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400")}>
              <Plus size={18} /> مجموعة جديدة
            </button>
            {isLoading ? <Loader2 className="m-5 animate-spin text-emerald-600" /> : groups.map((group) => (
              <button key={group.id} type="button" onClick={() => setSelectedId(group.id)}
                className={cn("min-w-44 rounded-2xl border-2 bg-white p-3 text-right transition-all hover:shadow-sm", selectedId === group.id && "shadow-md")}
                style={{ borderColor: selectedId === group.id ? group.color : `${group.color}35` }}>
                <span className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                  <strong className="truncate text-sm font-black text-emerald-950">{group.name}</strong>
                </span>
                <span className="block text-xs font-bold text-slate-500">{group.members.length} طالب</span>
              </button>
            ))}
          </aside>

          <form onSubmit={save} className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black leading-6 text-amber-950">
                ١. اختر مجموعة موجودة أو أنشئ مجموعة جديدة. ٢. اضغط على أسماء الطلاب حتى تظهر عبارة «تمت الإضافة». ٣. اضغط زر الحفظ الأخضر.
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-emerald-950">
                    {selected ? <Pencil size={19} /> : <Plus size={19} />} {selected ? "تعديل المجموعة" : "إنشاء مجموعة"}
                  </h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {selected
                      ? "اختر الطلاب بالضغط على أسمائهم أدناه، ثم اضغط حفظ تغييرات المجموعة."
                      : "اكتب اسم المجموعة، اختر الطلاب بالضغط على أسمائهم، ثم أنشئ المجموعة."}
                  </p>
                </div>
                {selected && (
                  <button type="button" onClick={remove} disabled={deleteMutation.isPending}
                    className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition-colors", confirmDelete ? "border-rose-600 bg-rose-600 text-white" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100")}>
                    {deleteMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    {confirmDelete ? "اضغط مرة أخرى للتأكيد" : "حذف المجموعة"}
                  </button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-black text-emerald-950">اسم المجموعة</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="مثال: روّاد القراءة"
                    className="w-full rounded-xl border-2 border-emerald-100 px-4 py-3 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-black text-emerald-950">وصف أو هدف مختصر</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} placeholder="مثال: فريق تحديات القراءة"
                    className="w-full rounded-xl border-2 border-emerald-100 px-4 py-3 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-emerald-950">لون المجموعة</label>
                <div className="flex flex-wrap gap-2">
                  {REWARD_GROUP_COLORS.map((swatch) => (
                    <button key={swatch} type="button" onClick={() => setColor(swatch)} aria-label={`اختيار اللون ${swatch}`}
                      className={cn("flex h-10 w-10 items-center justify-center rounded-xl border-4 border-white shadow-sm ring-2 transition-transform hover:scale-105 motion-reduce:transform-none", color === swatch ? "scale-110 ring-emerald-900" : "ring-slate-200")}
                      style={{ backgroundColor: swatch }}>
                      {color === swatch && <Check size={18} className="text-white" strokeWidth={4} />}
                    </button>
                  ))}
                </div>
              </div>

              <section className="overflow-hidden rounded-2xl border-2 border-emerald-100">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/50 p-3">
                  <div>
                    <h4 className="font-black text-emerald-950">اختر طلاب المجموعة</h4>
                    <p className="text-xs font-bold text-emerald-900/55">تم اختيار {memberIds.size} من {students.length}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMemberIds(new Set(students.map((student) => student.id)))} className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm">تحديد الكل</button>
                    <button type="button" onClick={() => setMemberIds(new Set())} className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">مسح</button>
                  </div>
                  <div className="relative w-full">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن طالب..."
                      className="w-full rounded-xl border border-emerald-100 bg-white py-2 pr-9 pl-3 text-sm font-bold outline-none focus:border-emerald-400" />
                  </div>
                </div>
                <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
                  {filteredStudents.map((student) => {
                    const checked = memberIds.has(student.id);
                    return (
                      <button key={student.id} type="button" onClick={() => toggleMember(student.id)}
                        aria-pressed={checked}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-xl border-2 p-2.5 text-right shadow-sm transition-all",
                          checked
                            ? "border-emerald-600 bg-emerald-700 text-white ring-2 ring-emerald-200"
                            : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50",
                        )}>
                        <AvatarDisplay avatar={student.avatar} fallback={student.name.charAt(0)} size="sm" />
                        <span className={cn("min-w-0 flex-1 truncate text-sm font-black", checked ? "text-white" : "text-emerald-950")}>{student.name}</span>
                        <span className={cn(
                          "flex min-w-20 items-center justify-center gap-1 rounded-lg border-2 px-2 py-1 text-[10px] font-black",
                          checked ? "border-white/50 bg-white text-emerald-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
                        )}>
                          {checked && <Check size={13} strokeWidth={4} />}
                          {checked ? "تمت الإضافة" : "إضافة"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <button type="submit" disabled={saving}
                className="sticky bottom-0 z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 font-black text-white shadow-lg shadow-emerald-950/20 transition-colors hover:bg-emerald-800 disabled:opacity-50">
                {saving ? <Loader2 size={19} className="animate-spin" /> : <Save size={19} />}
                {selected ? `حفظ المجموعة (${memberIds.size} طالب)` : `إنشاء المجموعة (${memberIds.size} طالب)`}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RewardGroupChip({ group, active, onClick }: { group: RewardGroup; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("inline-flex shrink-0 items-center gap-2 rounded-xl border-2 bg-white px-3 py-2 text-xs font-black transition-all hover:-translate-y-0.5 motion-reduce:transform-none", active && "text-white shadow-md")}
      style={{ borderColor: group.color, backgroundColor: active ? group.color : "white", color: active ? "white" : group.color }}>
      <span className="h-2.5 w-2.5 rounded-full border border-white/60" style={{ backgroundColor: active ? "white" : group.color }} />
      {group.name}
      <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", active ? "bg-white/20" : "bg-slate-100 text-slate-600")}>{group.members.length}</span>
    </button>
  );
}