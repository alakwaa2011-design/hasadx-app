import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { isMindMapValid, PALETTE, type MindMap, type MindMapBranch } from "./mindmap-shared";

interface MindMapEditorProps {
  map: MindMap;
  isAr: boolean;
  onChange: (map: MindMap) => void;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-700 dark:bg-[#0B100E] dark:text-slate-100";

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-black text-slate-500 dark:text-slate-400">{children}</span>;
}

function MoveButtons({
  index,
  count,
  onMove,
  isAr,
}: {
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  isAr: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
        title={isAr ? "تحريك لأعلى" : "Move up"}
        aria-label={isAr ? "تحريك لأعلى" : "Move up"}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
        title={isAr ? "تحريك لأسفل" : "Move down"}
        aria-label={isAr ? "تحريك لأسفل" : "Move down"}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

function BranchEditor({
  branch,
  index,
  count,
  isAr,
  onChange,
  onDelete,
  onMove,
}: {
  branch: MindMapBranch;
  index: number;
  count: number;
  isAr: boolean;
  onChange: (branch: MindMapBranch) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const updateChild = (childIndex: number, value: string) => {
    const children = [...branch.children];
    children[childIndex] = value;
    onChange({ ...branch, children });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-[#0B100E]/70" data-testid={`mindmap-branch-editor-${index}`}>
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-start"
          aria-expanded={expanded}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm" style={{ backgroundColor: `${branch.color}20` }}>
            {branch.icon || "•"}
          </span>
          <span className="truncate text-sm font-black text-slate-700 dark:text-slate-200">{branch.label || (isAr ? "فرع بدون عنوان" : "Untitled branch")}</span>
        </button>
        <MoveButtons index={index} count={count} onMove={onMove} isAr={isAr} />
        <button
          type="button"
          disabled={count <= 1}
          onClick={onDelete}
          className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-red-900/20"
          title={count <= 1 ? (isAr ? "يجب إبقاء فرع واحد على الأقل" : "Keep at least one branch") : (isAr ? "حذف الفرع" : "Delete branch")}
          aria-label={isAr ? "حذف الفرع" : "Delete branch"}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label>
              <FieldLabel>{isAr ? "عنوان الفرع" : "Branch title"}</FieldLabel>
              <input
                value={branch.label}
                onChange={(event) => onChange({ ...branch, label: event.target.value })}
                className={inputClass}
                maxLength={120}
                data-testid={`input-branch-label-${index}`}
              />
            </label>
            <label className="w-[74px]">
              <FieldLabel>{isAr ? "أيقونة" : "Icon"}</FieldLabel>
              <input
                value={branch.icon}
                onChange={(event) => onChange({ ...branch, icon: event.target.value.slice(0, 4) })}
                className={`${inputClass} text-center text-lg`}
                maxLength={4}
                aria-label={isAr ? "أيقونة الفرع" : "Branch icon"}
              />
            </label>
          </div>

          <div>
            <FieldLabel>
              <span className="inline-flex items-center gap-1"><Palette className="h-3.5 w-3.5" />{isAr ? "لون الفرع" : "Branch color"}</span>
            </FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {PALETTE.map((color) => (
                <button
                  key={color.bg}
                  type="button"
                  onClick={() => onChange({ ...branch, color: color.bg })}
                  className="h-7 w-7 rounded-full border-2 border-white shadow-sm ring-offset-2 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-800"
                  style={{ backgroundColor: color.bg, outline: branch.color.toUpperCase() === color.bg.toUpperCase() ? `2px solid ${color.bg}` : undefined }}
                  title={color.label}
                  aria-label={`${isAr ? "اختيار لون" : "Choose color"} ${color.label}`}
                />
              ))}
              <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800" title={isAr ? "لون مخصص" : "Custom color"}>
                <Palette className="h-3.5 w-3.5" />
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(branch.color) ? branch.color : "#2f684d"}
                  onChange={(event) => onChange({ ...branch, color: event.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={isAr ? "اختيار لون مخصص" : "Choose custom color"}
                />
              </label>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <FieldLabel>{isAr ? "العناصر التابعة" : "Child items"}</FieldLabel>
              <button
                type="button"
                onClick={() => onChange({ ...branch, children: [...branch.children, isAr ? "عنصر جديد" : "New item"] })}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:bg-[#15201B] dark:text-emerald-300 dark:hover:bg-emerald-900/30"
              >
                <Plus className="h-3.5 w-3.5" />{isAr ? "إضافة عنصر" : "Add item"}
              </button>
            </div>
            <div className="space-y-2">
              {branch.children.map((child, childIndex) => (
                <div key={childIndex} className="flex items-center gap-1.5">
                  <input
                    value={child}
                    onChange={(event) => updateChild(childIndex, event.target.value)}
                    className={`${inputClass} min-w-0`}
                    maxLength={180}
                    aria-label={`${isAr ? "العنصر" : "Item"} ${childIndex + 1}`}
                    data-testid={`input-child-${index}-${childIndex}`}
                  />
                  <MoveButtons
                    index={childIndex}
                    count={branch.children.length}
                    onMove={(direction) => onChange({ ...branch, children: moveItem(branch.children, childIndex, direction) })}
                    isAr={isAr}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...branch, children: branch.children.filter((_, itemIndex) => itemIndex !== childIndex) })}
                    className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    title={isAr ? "حذف العنصر" : "Delete item"}
                    aria-label={isAr ? "حذف العنصر" : "Delete item"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {branch.children.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-center text-xs font-bold text-slate-400 dark:border-slate-700">
                  {isAr ? "لا توجد عناصر تابعة — أضف عنصرًا عند الحاجة" : "No child items — add one when needed"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function MindMapEditor({ map, isAr, onChange }: MindMapEditorProps) {
  const updateBranch = (index: number, branch: MindMapBranch) => {
    const branches = [...map.branches];
    branches[index] = branch;
    onChange({ ...map, branches });
  };

  const addBranch = () => {
    onChange({
      ...map,
      branches: [
        ...map.branches,
        {
          label: isAr ? "فرع جديد" : "New branch",
          icon: "✨",
          color: PALETTE[map.branches.length % PALETTE.length].bg,
          children: [isAr ? "عنصر جديد" : "New item"],
        },
      ],
    });
  };

  const deleteBranch = (index: number) => {
    if (map.branches.length <= 1) {
      toast.error(isAr ? "يجب إبقاء فرع واحد على الأقل" : "Keep at least one branch");
      return;
    }
    onChange({ ...map, branches: map.branches.filter((_, branchIndex) => branchIndex !== index) });
  };

  return (
    <div className="space-y-4" dir={isAr ? "rtl" : "ltr"} data-testid="mindmap-editor">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10">
        <div className="mb-2 flex items-center gap-2 text-sm font-black text-emerald-800 dark:text-emerald-300">
          <Palette className="h-4 w-4" />
          {isAr ? "خصّص خريطتك" : "Customize your map"}
        </div>
        <p className="text-xs font-bold leading-relaxed text-emerald-800/70 dark:text-emerald-300/70">
          {isAr ? "عدّل النصوص والألوان وأضف ما تحتاجه، وستتحدث المعاينة تلقائيًا." : "Edit text and colors or add what you need. The preview updates automatically."}
        </p>
      </div>

      <label className="block">
        <FieldLabel>{isAr ? "العنوان المركزي" : "Central title"}</FieldLabel>
        <input
          value={map.center}
          onChange={(event) => onChange({ ...map, center: event.target.value })}
          className={`${inputClass} text-base`}
          maxLength={180}
          data-testid="input-map-center"
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{isAr ? "الفروع الرئيسية" : "Main branches"}</h3>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">{map.branches.length} {isAr ? "فروع" : "branches"}</p>
        </div>
        <button
          type="button"
          onClick={addBranch}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
          data-testid="btn-add-branch"
        >
          <Plus className="h-4 w-4" />{isAr ? "إضافة فرع" : "Add branch"}
        </button>
      </div>

      <div className="space-y-3">
        {map.branches.map((branch, index) => (
          <BranchEditor
            key={index}
            branch={branch}
            index={index}
            count={map.branches.length}
            isAr={isAr}
            onChange={(next) => updateBranch(index, next)}
            onDelete={() => deleteBranch(index)}
            onMove={(direction) => onChange({ ...map, branches: moveItem(map.branches, index, direction) })}
          />
        ))}
      </div>

      {!isMindMapValid(map) && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300" data-testid="mindmap-validation-warning">
          {isAr ? "أكمل العنوان المركزي وعناوين الفروع والعناصر قبل الحفظ." : "Complete the central title, branch titles, and child items before saving."}
        </p>
      )}
    </div>
  );
}