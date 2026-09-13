import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as LucideIcons from "lucide-react";
import { useGetRewardTypes, useCreateRewardType, useUpdateRewardType } from "./api";
import { Loader2, Plus, Check, X, ArrowUp, ArrowDown, Edit2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatRewardPoints } from "./format";
import { useI18n } from "@/lib/i18n";
import { rewardText } from "./reward-i18n";

export const PRESET_ICONS = ["Star", "Heart", "ThumbsUp", "Zap", "Trophy", "Target", "Shield", "Flame", "Award", "Crown", "Lightbulb", "Rocket"];
export const PRESET_COLORS = ["#468064", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0891b2", "#f97316"];

export const IconRenderer = ({ name, className, style }: { name: string, className?: string, style?: React.CSSProperties }) => {
  const Icon = (LucideIcons as any)[name] || LucideIcons.Star;
  return <Icon className={className} style={style} />;
};

export function RewardTypesSettings({ open, onOpenChange }: { open: boolean, onOpenChange: (v: boolean) => void }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const { data: types, isLoading } = useGetRewardTypes();
  const createType = useCreateRewardType();
  const updateType = useUpdateRewardType();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isAdding, setIsAdding] = useState(false);

  // We will locally sort by order
  const sortedTypes = (types || []).sort((a: any, b: any) => a.order - b.order);

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setEditForm({ ...t });
    setIsAdding(false);
  };

  const startAdd = () => {
    setEditingId(null);
    setIsAdding(true);
    setEditForm({
      name: "",
      points: 1,
      icon: "Star",
      color: PRESET_COLORS[0],
      order: sortedTypes.length > 0 ? sortedTypes[sortedTypes.length - 1].order + 1 : 0,
      active: true,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
  };

  const saveEdit = () => {
    if (!editForm.name.trim()) { toast.error(r("يرجى إدخال اسم التحفيز", "Enter a reward name.")); return; }
    if (editForm.points < 1) { toast.error(r("قيمة التحفيز يجب أن تكون موجبة", "Reward points must be positive.")); return; }

    if (isAdding) {
      createType.mutate(editForm, {
        onSuccess: () => {
          toast.success(r("تمت الإضافة", "Added."));
          cancelEdit();
        },
        onError: () => toast.error(r("حدث خطأ أثناء الإضافة", "Could not add the reward.")),
      });
    } else {
      updateType.mutate(editForm, {
        onSuccess: () => {
          toast.success(r("تم الحفظ", "Saved."));
          cancelEdit();
        },
        onError: () => toast.error(r("حدث خطأ أثناء الحفظ", "Could not save the reward.")),
      });
    }
  };

  const moveOrder = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= sortedTypes.length) return;
    const current = sortedTypes[index];
    const swap = sortedTypes[index + direction];
    
    // Optimistic-like behavior via multiple updates or ideally backend handles reorder.
    // We will just patch both.
    updateType.mutate({ id: current.id, order: swap.order });
    updateType.mutate({ id: swap.id, order: current.order });
  };

  const toggleActive = (t: any) => {
    updateType.mutate({ id: t.id, active: !t.active }, {
      onSuccess: () => toast.success(t.active ? r("تم الإيقاف", "Disabled.") : r("تم التفعيل", "Enabled."))
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 bg-background/95 backdrop-blur-xl border-border overflow-hidden">
        <DialogHeader className="p-4 border-b border-border/50 bg-muted/20">
          <button type="button" onClick={() => onOpenChange(false)} className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
            <ArrowRight size={15} /> {r("رجوع", "Back")}
          </button>
          <DialogTitle className="text-lg font-bold">{r("إدارة أنواع التحفيز", "Manage reward types")}</DialogTitle>
        </DialogHeader>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
          {isLoading && <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>}
          
          {!isLoading && sortedTypes.map((t: any, index: number) => (
            <div key={t.id} className="flex flex-col gap-2 p-3 rounded-xl border border-border/50 bg-card shadow-sm">
              {editingId === t.id ? (
                <EditForm 
                  form={editForm} 
                  setForm={setEditForm} 
                  onSave={saveEdit} 
                  onCancel={cancelEdit} 
                  loading={updateType.isPending} 
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <button disabled={index === 0} onClick={() => moveOrder(index, -1)} className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"><ArrowUp size={14}/></button>
                    <button disabled={index === sortedTypes.length - 1} onClick={() => moveOrder(index, 1)} className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"><ArrowDown size={14}/></button>
                  </div>
                  
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: t.color }}>
                    <IconRenderer name={t.icon} className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate flex items-center gap-2">
                      {t.name}
                       {!t.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{r("متوقف", "Disabled")}</span>}
                    </div>
                     <div className="text-xs text-muted-foreground font-medium">+{formatRewardPoints(t.points)} {r("نقطة", "points")}</div>
                  </div>

                  <div className="flex items-center gap-1">
                     <button onClick={() => toggleActive(t)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title={t.active ? r("إيقاف", "Disable") : r("تفعيل", "Enable")}>
                      {t.active ? <Check size={16} className="text-primary" /> : <X size={16} className="text-destructive" />}
                    </button>
                     <button onClick={() => startEdit(t)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title={r("تعديل", "Edit")}>
                      <Edit2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAdding && (
             <div className="flex flex-col gap-2 p-3 rounded-xl border-2 border-primary/40 bg-primary/5 shadow-sm">
               <EditForm 
                  form={editForm} 
                  setForm={setEditForm} 
                  onSave={saveEdit} 
                  onCancel={cancelEdit} 
                  loading={createType.isPending} 
                />
             </div>
          )}

          {!isAdding && !editingId && (
            <button 
              onClick={startAdd}
              className="w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/30 transition-all flex items-center justify-center gap-2 font-medium text-sm"
            >
              <Plus size={18} />
               {r("إضافة تحفيز جديد", "Add new reward")}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ form, setForm, onSave, onCancel, loading }: { form: any, setForm: any, onSave: () => void, onCancel: () => void, loading: boolean }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex-1">
           <label className="text-xs font-bold text-muted-foreground mb-1 block">{r("الاسم", "Name")}</label>
          <input 
            type="text" 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
             placeholder={r("مثال: مشاركة متميزة", "Example: Excellent participation")}
            autoFocus
          />
        </div>
        <div className="w-20">
           <label className="text-xs font-bold text-muted-foreground mb-1 block">{r("النقاط", "Points")}</label>
          <input 
            type="number" 
            min="1"
            value={form.points} 
            onChange={e => setForm({...form, points: parseInt(e.target.value) || 1})}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none text-center font-mono"
          />
        </div>
      </div>

      <div>
         <label className="text-xs font-bold text-muted-foreground mb-1 block">{r("الأيقونة", "Icon")}</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_ICONS.map(icon => (
            <button
              key={icon}
              onClick={() => setForm({...form, icon})}
              className={cn(
                "p-2 rounded-lg border transition-all",
                form.icon === icon ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted text-muted-foreground"
              )}
            >
              <IconRenderer name={icon} className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <div>
         <label className="text-[10px] font-bold text-muted-foreground mb-1 block">{r("اللون", "Color")}</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setForm({...form, color})}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all",
                form.color === color ? "border-foreground scale-110 shadow-sm" : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-1">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 text-xs font-bold transition-colors">
           {r("إلغاء", "Cancel")}
        </button>
        <button onClick={onSave} disabled={loading} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-colors flex items-center gap-1">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
           {r("حفظ", "Save")}
        </button>
      </div>
    </div>
  );
}