import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/layout";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, DragOverlay, closestCenter, PointerSensor,
  useSensor, useSensors, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Users, Plus, ArrowRight, Pencil, Trash2, X, Phone,
  GripVertical, ChevronDown, ChevronRight, ChevronLeft,
  UserPlus, Check, AlertTriangle, Search, ArrowLeft,
  BookOpen, ListPlus, FileSpreadsheet, FileText, Upload, Loader2,
  ClipboardList, KeyRound, Eye, EyeOff, RefreshCw,
  Layers, UserCheck, TrendingUp, Mail, User,
} from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Student {
  id: number;
  name: string;
  gradeLevel: string | null;
  studentClass: string | null;
  parentPhone: string | null;
  parentName: string | null;
  parentEmail: string | null;
  notes: string | null;
  accountUsername: string | null;
  createdAt: string;
}

const UNGROUPED = "__ungrouped__";


const CLASS_COLORS = [
  { bg: "bg-teal-500", light: "bg-teal-500/10", border: "border-teal-200 dark:border-teal-800", text: "text-teal-700 dark:text-teal-400", ring: "ring-teal-400" },
  { bg: "bg-indigo-500", light: "bg-indigo-500/10", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-400", ring: "ring-indigo-400" },
  { bg: "bg-rose-500", light: "bg-rose-500/10", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-400", ring: "ring-rose-400" },
  { bg: "bg-amber-500", light: "bg-amber-500/10", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", ring: "ring-amber-400" },
  { bg: "bg-purple-500", light: "bg-purple-500/10", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-400", ring: "ring-purple-400" },
  { bg: "bg-cyan-500", light: "bg-cyan-500/10", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-400", ring: "ring-cyan-400" },
  { bg: "bg-orange-500", light: "bg-orange-500/10", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-400", ring: "ring-orange-400" },
  { bg: "bg-green-500", light: "bg-green-500/10", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-400", ring: "ring-green-400" },
];

function getGroupKey(student: Student) {
  return student.gradeLevel || UNGROUPED;
}

/* ─── Draggable Student Row ─────────────────────────────── */
function StudentRow({
  student, idx, onEdit, onDelete, onMove, onResetPassword, folders, colorIdx, isOverlay = false,
}: {
  student: Student;
  idx: number;
  onEdit: (s: Student) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, toFolder: string) => void;
  onResetPassword: (s: Student) => void;
  folders: string[];
  colorIdx: number;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `student-${student.id}` });

  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const currentFolder = student.gradeLevel || UNGROUPED;
  const otherFolders = folders.filter((f) => f !== currentFolder);
  const color = CLASS_COLORS[colorIdx % CLASS_COLORS.length];

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? {} : style}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-card border shadow-sm group transition-all
        ${isDragging ? `border-2 ${color.ring} ring-2 shadow-lg` : "border-border hover:border-primary/30 hover:shadow"}`}
    >
      {!isOverlay && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none flex-shrink-0"
        >
          <GripVertical size={13} />
        </button>
      )}

      <span className="flex-shrink-0 text-[10px] font-bold text-muted-foreground/60 w-5 text-center">{idx}</span>
      <span className="flex-1 text-sm font-medium text-foreground truncate">{student.name}</span>

      {student.parentPhone && (
        <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
          <Phone size={11} />{student.parentPhone}
        </span>
      )}
      {student.parentEmail && (
        <span title={student.parentEmail} className="hidden sm:flex items-center gap-1 text-xs text-emerald-600">
          <Mail size={11} />
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {otherFolders.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setMoveOpen((v) => !v)}
              title="نقل إلى صف آخر"
              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 text-xs font-medium flex items-center gap-1"
            >
              <ArrowRight size={13} />
            </button>
            {moveOpen && (
              <div className="absolute left-0 top-8 z-50 bg-card border border-border rounded-xl shadow-xl min-w-40 py-1">
                <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium border-b border-border">نقل إلى صف:</p>
                {otherFolders.map((f) => (
                  <button
                    key={f}
                    onClick={() => { onMove(student.id, f); setMoveOpen(false); }}
                    className="w-full text-right px-3 py-2 text-sm text-foreground hover:bg-muted truncate"
                  >
                    {f === UNGROUPED ? "بلا صف" : f}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Link
          href={`/teacher/students/${student.id}/timeline`}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 inline-flex items-center"
          title="سجل التطور"
          aria-label="سجل التطور"
        >
          <TrendingUp size={13} />
        </Link>
        <button
          onClick={() => onResetPassword(student)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10"
          title="إعادة تعيين كلمة المرور"
        >
          <KeyRound size={13} />
        </button>
        <button
          onClick={() => onEdit(student)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-teal-600 hover:bg-teal-500/10"
          title="تعديل"
        >
          <Pencil size={13} />
        </button>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
            title="حذف"
          >
            <Trash2 size={13} />
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-red-50 rounded-lg px-1.5 py-0.5">
            <button
              onClick={() => { onDelete(student.id); setConfirmDelete(false); }}
              className="p-0.5 rounded bg-red-500 text-white hover:bg-red-600"
            >
              <Check size={11} />
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="p-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Class Block ──────────────────────────────────────── */
function ClassBlock({
  className: folderName, students, allFolders, isExpanded, onToggle, colorIdx,
  onRename, onDeleteClass, onEditStudent, onDeleteStudent, onMoveStudent,
  onAddStudent, onBulkAdd, onResetPassword, groupName, allGroups, onAssignGroup, onAttendance,
}: {
  className: string;
  students: Student[];
  allFolders: string[];
  isExpanded: boolean;
  onToggle: () => void;
  colorIdx: number;
  onRename: (old: string, newName: string) => void;
  onDeleteClass: (name: string) => void;
  onEditStudent: (s: Student) => void;
  onDeleteStudent: (id: number) => void;
  onMoveStudent: (id: number, to: string) => void;
  onAddStudent: (folder: string) => void;
  onBulkAdd: (folder: string) => void;
  onResetPassword: (s: Student) => void;
  groupName?: string;
  allGroups?: string[];
  onAssignGroup?: (className: string, groupName: string | null) => void;
  onAttendance?: (className: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `folder-${folderName}` });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(folderName);
  const renameRef = useRef<HTMLInputElement>(null);
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  const isUngrouped = folderName === UNGROUPED;
  const color = CLASS_COLORS[colorIdx % CLASS_COLORS.length];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const startRename = () => {
    setRenameVal(folderName);
    setIsRenaming(true);
    setTimeout(() => renameRef.current?.focus(), 50);
  };

  const submitRename = () => {
    if (renameVal.trim() && renameVal.trim() !== folderName) {
      onRename(folderName, renameVal.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <div className={`rounded-2xl bg-card overflow-hidden transition-all duration-200
        ${isDragging
          ? "shadow-2xl ring-2 ring-primary/40 opacity-70 scale-[0.99]"
          : "shadow-sm hover:shadow-md border border-border hover:border-border/80"}`}
      >
        {/* Colored accent bar at top */}
        <div className={`h-1.5 ${color.bg}`} />

        {/* Card body */}
        <div className="px-5 py-4">

          {/* Top row: drag + icon + name + toggle */}
          <div className="flex items-center gap-3">

            {/* Drag handle */}
            {!isUngrouped && (
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 touch-none flex-shrink-0 transition-colors"
                title="اسحب لإعادة الترتيب"
              >
                <GripVertical size={18} />
              </button>
            )}

            {/* Class icon */}
            <div className={`w-11 h-11 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <BookOpen size={19} className="text-white" />
            </div>

            {/* Class name + count */}
            <div className="flex-1 min-w-0">
              {isRenaming ? (
                <input
                  ref={renameRef}
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename();
                    if (e.key === "Escape") setIsRenaming(false);
                  }}
                  onBlur={submitRename}
                  className={`w-full font-black text-lg bg-background text-foreground border-2 border-primary/60 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary/30`}
                  autoFocus
                />
              ) : (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-black text-lg leading-tight ${color.text}`}>
                      {isUngrouped ? "بلا صف" : folderName}
                    </span>
                    {groupName && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                        <Layers size={10} />
                        {groupName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">{students.length}</span> طالب
                  </p>
                </div>
              )}
            </div>

            {/* Toggle button */}
            <button
              onClick={onToggle}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              title={isExpanded ? "طيّ الصف" : "عرض الطلاب"}
            >
              {isExpanded ? <ChevronDown size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Action strip — separated by a divider */}
          {!isUngrouped && !isRenaming && (
            <div className="mt-3.5 pt-3.5 border-t border-border/60 flex flex-wrap items-center gap-2">

              {/* Primary actions */}
              <Link
                href={`/teacher/class-grades/${encodeURIComponent(folderName)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                title="كشف الدرجات"
              >
                <ClipboardList size={13} />
                الدرجات
              </Link>

              {onAttendance && (
                <button
                  onClick={() => onAttendance(folderName)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 text-xs font-semibold border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
                  title="تسجيل الحضور"
                >
                  <UserCheck size={13} />
                  حضور
                </button>
              )}

              {/* Group picker */}
              {onAssignGroup && (
                <div className="relative">
                  <button
                    onClick={() => setShowGroupMenu(v => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                      ${groupName
                        ? "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`}
                    title="تعيين مجموعة"
                  >
                    <Layers size={13} />
                    {groupName || "مجموعة"}
                  </button>
                  {showGroupMenu && (
                    <div className="absolute start-0 top-10 z-[200] bg-card border border-border rounded-xl shadow-xl min-w-48 py-1 text-sm max-h-64 overflow-y-auto">
                      <p className="px-3 py-1.5 text-xs text-muted-foreground font-semibold border-b border-border sticky top-0 bg-card">تعيين إلى مجموعة:</p>
                      {(allGroups ?? []).map(g => (
                        <button key={g}
                          onClick={() => { onAssignGroup(folderName, g); setShowGroupMenu(false); }}
                          className={`w-full text-right px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2
                            ${groupName === g ? "text-violet-600 font-bold" : "text-foreground"}`}
                        >
                          {groupName === g && <Check size={12} className="shrink-0" />}
                          {g}
                        </button>
                      ))}
                      {groupName && (
                        <button
                          onClick={() => { onAssignGroup(folderName, null); setShowGroupMenu(false); }}
                          className="w-full text-right px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-xs border-t border-border mt-1"
                        >
                          إزالة من المجموعة
                        </button>
                      )}
                      {(allGroups ?? []).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">لا توجد مجموعات — أنشئ مجموعة أولاً</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Add student */}
              <button
                onClick={() => onAddStudent(folderName)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${color.light} ${color.text} ${color.border} hover:opacity-80`}
                title="إضافة طالب"
              >
                <UserPlus size={13} />
                إضافة طالب
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Secondary: rename + delete */}
              <div className="flex items-center gap-1">
                <button
                  onClick={startRename}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  title="تغيير اسم الصف"
                >
                  <Pencil size={14} />
                </button>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="حذف الصف"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-card rounded-xl px-2.5 py-1.5 border border-red-200 dark:border-red-900 shadow-sm">
                    <span className="text-xs text-red-500 font-semibold">حذف الصف؟</span>
                    <button
                      onClick={() => { onDeleteClass(folderName); setShowDeleteConfirm(false); }}
                      className="p-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="p-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ungrouped quick add */}
          {isUngrouped && (
            <div className="mt-3 pt-3 border-t border-border/60 flex gap-2">
              <button
                onClick={() => onAddStudent(UNGROUPED)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 text-xs font-semibold border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition-colors"
              >
                <UserPlus size={13} />
                إضافة طالب
              </button>
            </div>
          )}
        </div>

        {/* Expanded student list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border/50"
            >
              {(() => {
                const sortedClassStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, "ar"));
                return (
                  <SortableContext
                    items={sortedClassStudents.map((s) => `student-${s.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="px-5 py-4 space-y-2 bg-muted/20">
                      {sortedClassStudents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users size={32} className="mx-auto mb-2 opacity-30" />
                          <p className="text-sm">لا يوجد طلاب في هذا الصف بعد</p>
                        </div>
                      ) : (
                        sortedClassStudents.map((s, sIdx) => (
                          <StudentRow
                            key={s.id}
                            student={s}
                            idx={sIdx + 1}
                            onEdit={onEditStudent}
                            onDelete={onDeleteStudent}
                            onMove={onMoveStudent}
                            onResetPassword={onResetPassword}
                            folders={allFolders}
                            colorIdx={colorIdx}
                          />
                        ))
                      )}

                      {!isUngrouped && (
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => onAddStudent(folderName)}
                            className={`flex-1 py-2.5 text-xs font-semibold ${color.text} bg-card hover:bg-muted rounded-xl border-2 border-dashed ${color.border} transition-all flex items-center justify-center gap-1.5`}
                          >
                            <UserPlus size={14} />
                            إضافة طالب
                          </button>
                          <button
                            onClick={() => onBulkAdd(folderName)}
                            className="flex-1 py-2.5 text-xs font-semibold text-muted-foreground bg-card hover:bg-muted rounded-xl border-2 border-dashed border-border transition-all flex items-center justify-center gap-1.5"
                          >
                            <ListPlus size={14} />
                            إضافة بالجملة
                          </button>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function StudentsPage() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const BackArrowIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  /* class-group mapping: className -> groupName */
  const [classGroupMap, setClassGroupMap] = useState<Record<string, string>>({});
  /* new-group dialog */
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupTargetClasses, setGroupTargetClasses] = useState<string[]>([]);

  /* attendance panel */
  const [attendanceClass, setAttendanceClass] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceTab, setAttendanceTab] = useState<"register" | "report">("register");
  type AttendanceStatus = "present" | "absent" | "late" | "excused";
  const [attendanceMap, setAttendanceMap] = useState<Record<number, AttendanceStatus>>({});
  const [attendanceReport, setAttendanceReport] = useState<Array<{ date: string; studentId: number; status: string }>>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  const [renameLoading, setRenameLoading] = useState(false);

  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  const [showStudentForm, setShowStudentForm] = useState(false);
  const [studentFormFolder, setStudentFormFolder] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({ name: "", parentPhone: "", parentName: "", parentEmail: "", notes: "", accountUsername: "" });
  const [saving, setSaving] = useState(false);

  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkFolder, setBulkFolder] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resetPasswordStudent, setResetPasswordStudent] = useState<Student | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchStudents = useCallback(async () => {
    try {
      const [studentsRes, classesRes] = await Promise.all([
        fetch(`${API_BASE}/api/students`, { credentials: "include", cache: "no-store" }),
        fetch(`${API_BASE}/api/teacher/classes`, { credentials: "include", cache: "no-store" }),
      ]);
      if (studentsRes.status === 401) { setLocation("/login"); return; }
      const data: Student[] = await studentsRes.json();
      setStudents(data);
      const persistedClassesData: Array<{ name: string; groupName?: string | null }> = classesRes.ok
        ? await classesRes.json()
        : [];
      const persistedClasses: string[] = persistedClassesData.map(c => c.name);
      // Build groupMap from classes response
      const map: Record<string, string> = {};
      persistedClassesData.forEach(c => { if (c.groupName) map[c.name] = c.groupName; });
      setClassGroupMap(map);
      const fromStudents = data.map((s) => s.gradeLevel).filter((g): g is string => !!g);
      const namedSet = new Set<string>([...persistedClasses, ...fromStudents]);
      setFolderOrder((prev) => {
        const preserved = prev.filter((f) => f === UNGROUPED || namedSet.has(f));
        const newOnes = [...namedSet].filter((g) => !prev.includes(g));
        const all = [...preserved, ...newOnes];
        const named = all.filter((f) => f !== UNGROUPED).sort((a, b) => a.localeCompare(b, "ar"));
        const hasUngrouped = data.some((s) => !s.gradeLevel);
        return hasUngrouped ? [...named, UNGROUPED] : named;
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  /* ── Derived data ── */
  const folders = folderOrder.filter((f) =>
    f === UNGROUPED
      ? students.some((s) => !s.gradeLevel)
      : true
  );

  const studentsInFolder = (folder: string) => {
    const list = students
      .filter((s) => (s.gradeLevel || UNGROUPED) === folder)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    if (!search) return list;
    return list.filter((s) => s.name.includes(search));
  };

  /* ── Drag handlers ── */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    const sid = String(event.active.id);
    if (sid.startsWith("student-")) {
      const id = parseInt(sid.replace("student-", ""));
      setActiveStudent(students.find((s) => s.id === id) || null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeStr = String(active.id);
    const overStr = String(over.id);
    if (!activeStr.startsWith("student-")) return;
    const studentId = parseInt(activeStr.replace("student-", ""));
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    let targetFolder: string | null = null;
    if (overStr.startsWith("folder-")) {
      targetFolder = overStr.replace("folder-", "");
    } else if (overStr.startsWith("student-")) {
      const overId = parseInt(overStr.replace("student-", ""));
      const overStudent = students.find((s) => s.id === overId);
      if (overStudent) targetFolder = overStudent.gradeLevel || UNGROUPED;
    }
    if (targetFolder && targetFolder !== (student.gradeLevel || UNGROUPED)) {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, gradeLevel: targetFolder === UNGROUPED ? null : targetFolder, studentClass: targetFolder === UNGROUPED ? null : targetFolder }
            : s
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveStudent(null);
    if (!over) return;
    const activeStr = String(active.id);
    const overStr = String(over.id);
    if (activeStr.startsWith("folder-") && overStr.startsWith("folder-")) {
      const fromFolder = activeStr.replace("folder-", "");
      const toFolder = overStr.replace("folder-", "");
      setFolderOrder((prev) => {
        const fromIdx = prev.indexOf(fromFolder);
        const toIdx = prev.indexOf(toFolder);
        return arrayMove(prev, fromIdx, toIdx);
      });
      return;
    }
    if (activeStr.startsWith("student-")) {
      const studentId = parseInt(activeStr.replace("student-", ""));
      const student = students.find((s) => s.id === studentId);
      if (!student) return;
      const newFolder = student.gradeLevel || UNGROUPED;
      try {
        await fetch(`${API_BASE}/api/students/${studentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            gradeLevel: newFolder === UNGROUPED ? null : newFolder,
            studentClass: newFolder === UNGROUPED ? null : newFolder,
          }),
        });
      } catch {
        toast.error("فشل حفظ التغيير");
        fetchStudents();
      }
    }
  };

  /* ── Actions ── */
  const handleDeleteAll = async () => {
    setDeleteAllLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/students/all`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setStudents([]);
        setFolderOrder([]);
        setExpandedFolders(new Set());
        toast.success("تم حذف جميع الطلاب");
      } else {
        toast.error("حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setDeleteAllLoading(false);
      setShowDeleteAll(false);
    }
  };

  const handleDeleteClass = async (folder: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/students/group/${encodeURIComponent(folder)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        if (folder !== UNGROUPED) {
          await fetch(`${API_BASE}/api/teacher/classes/${encodeURIComponent(folder)}`, {
            method: "DELETE",
            credentials: "include",
          }).catch(() => {});
        }
        setStudents((prev) => prev.filter((s) => (s.gradeLevel || UNGROUPED) !== folder));
        setFolderOrder((prev) => prev.filter((f) => f !== folder));
        toast.success("تم حذف الصف");
      } else {
        toast.error("حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ");
    }
  };

  const handleRenameClass = async (oldName: string, newName: string) => {
    if (folderOrder.includes(newName) && newName !== oldName) {
      toast.error("يوجد صف بهذا الاسم");
      return;
    }
    setRenameLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/teacher/classes/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oldName, newName }),
      });
      if (res.ok) {
        setStudents((prev) =>
          prev.map((s) =>
            (s.gradeLevel || UNGROUPED) === oldName
              ? { ...s, gradeLevel: newName, studentClass: newName }
              : s
          )
        );
        setFolderOrder((prev) => prev.map((f) => (f === oldName ? newName : f)));
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          if (next.has(oldName)) { next.delete(oldName); next.add(newName); }
          return next;
        });
        toast.success("تم تغيير اسم الصف");
      } else {
        toast.error("حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setRenameLoading(false);
    }
  };

  const handleAddClass = async () => {
    const name = newClassName.trim();
    if (!name) return;
    if (folderOrder.includes(name)) { toast.error("الصف موجود بالفعل"); return; }
    try {
      const res = await fetch(`${API_BASE}/api/teacher/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { toast.error("حدث خطأ"); return; }
      setFolderOrder((prev) => {
        const named = prev.filter((f) => f !== UNGROUPED);
        const hasUngrouped = prev.includes(UNGROUPED);
        const next = [...named, name].sort((a, b) => a.localeCompare(b, "ar"));
        return hasUngrouped ? [...next, UNGROUPED] : next;
      });
      setExpandedFolders((prev) => new Set([...prev, name]));
      setShowAddClass(false);
      setNewClassName("");
      toast.success(`تم إنشاء صف "${name}"`);
    } catch {
      toast.error("حدث خطأ");
    }
  };

  /* ── Assign/move class to group ── */
  const handleAssignGroup = async (className: string, groupName: string | null) => {
    try {
      const res = await fetch(`${API_BASE}/api/teacher/classes/group`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ className, groupName }),
      });
      if (res.ok) {
        setClassGroupMap(prev => {
          const next = { ...prev };
          if (groupName) next[className] = groupName;
          else delete next[className];
          return next;
        });
        if (groupName) toast.success(`تم تعيين "${className}" ضمن "${groupName}"`);
      } else {
        toast.error("حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ");
    }
  };

  const handleAssignGroupMulti = async (classNames: string[], groupName: string) => {
    for (const cn of classNames) {
      await handleAssignGroup(cn, groupName);
    }
    toast.success(`تم تعيين ${classNames.length} صف ضمن "${groupName}"`);
  };

  /* ── Attendance ── */
  const openAttendance = async (className: string) => {
    setAttendanceClass(className);
    setAttendanceTab("register");
    const currentDate = attendanceDate;
    try {
      const res = await fetch(
        `${API_BASE}/api/attendance?gradeLevel=${encodeURIComponent(className)}&date=${currentDate}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const rows: Array<{ studentId: number; status: string }> = await res.json();
        const map: Record<number, AttendanceStatus> = {};
        rows.forEach(r => { map[r.studentId] = r.status as AttendanceStatus; });
        setAttendanceMap(map);
      }
      // Load report (last 30 days)
      const from = new Date(); from.setDate(from.getDate() - 30);
      const fromStr = from.toISOString().slice(0, 10);
      const repRes = await fetch(
        `${API_BASE}/api/attendance?gradeLevel=${encodeURIComponent(className)}&from=${fromStr}`,
        { credentials: "include" }
      );
      if (repRes.ok) setAttendanceReport(await repRes.json());
    } catch { /* ignore */ }
  };

  const loadAttendanceForDate = async (className: string, date: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/attendance?gradeLevel=${encodeURIComponent(className)}&date=${date}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const rows: Array<{ studentId: number; status: string }> = await res.json();
        const map: Record<number, AttendanceStatus> = {};
        rows.forEach(r => { map[r.studentId] = r.status as AttendanceStatus; });
        setAttendanceMap(map);
      }
    } catch { /* ignore */ }
  };

  const saveAttendance = async () => {
    if (!attendanceClass) return;
    const classStudents = studentsInFolder(attendanceClass);
    if (classStudents.length === 0) return;
    setSavingAttendance(true);
    try {
      const records = classStudents.map(s => ({
        studentId: s.id,
        status: attendanceMap[s.id] ?? "present",
      }));
      const res = await fetch(`${API_BASE}/api/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: attendanceDate, records }),
      });
      if (res.ok) toast.success("تم حفظ الحضور ✓");
      else toast.error("فشل حفظ الحضور");
    } catch {
      toast.error("خطأ في الحفظ");
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleSaveStudent = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = editingStudent
        ? `${API_BASE}/api/students/${editingStudent.id}`
        : `${API_BASE}/api/students`;
      const method = editingStudent ? "PUT" : "POST";
      const folder = studentFormFolder === UNGROUPED ? null : studentFormFolder || null;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          gradeLevel: folder,
          studentClass: folder,
          parentPhone: form.parentPhone.trim() || null,
          parentName: form.parentName.trim() || null,
          parentEmail: form.parentEmail.trim() || null,
          notes: form.notes.trim() || null,
          accountUsername: form.accountUsername.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(editingStudent ? "تم التحديث" : "تمت الإضافة");
        setShowStudentForm(false);
        setEditingStudent(null);
        setForm({ name: "", parentPhone: "", parentName: "", parentEmail: "", notes: "", accountUsername: "" });
        fetchStudents();
      } else {
        toast.error(data.message || "حدث خطأ");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/students/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s.id !== id));
        toast.success("تم حذف الطالب");
      } else {
        toast.error("حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ");
    }
  };

  const handleMoveStudent = async (id: number, toFolder: string) => {
    const folder = toFolder === UNGROUPED ? null : toFolder;
    try {
      const res = await fetch(`${API_BASE}/api/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gradeLevel: folder, studentClass: folder }),
      });
      if (res.ok) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, gradeLevel: folder, studentClass: folder } : s
          )
        );
        toast.success("تم النقل");
      } else {
        toast.error("حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ");
    }
  };

  const openResetPassword = (student: Student) => {
    setResetPasswordStudent(student);
    setResetNewPassword("");
    setResetShowPassword(false);
    setResetDone(false);
  };

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setResetNewPassword(pw);
    setResetShowPassword(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordStudent || resetNewPassword.length < 4) return;
    setResetSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/teacher/reset-student-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentId: resetPasswordStudent.id,
          newPassword: resetNewPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetDone(true);
        toast.success("تم تغيير كلمة المرور بنجاح");
      } else {
        toast.error(data.message || "حدث خطأ");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setResetSaving(false);
    }
  };

  const handleBulkAdd = async () => {
    const names = bulkText
      .split("\n")
      .map((n) => n.replace(/^\d+[\.\-\)\s]+/, "").trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setBulkSaving(true);
    const folder = bulkFolder === UNGROUPED ? null : bulkFolder || null;
    try {
      const res = await fetch(`${API_BASE}/api/students/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          students: names.map((name) => ({ name, gradeLevel: folder, studentClass: folder })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`تمت إضافة ${data.length} طالب`);
        setBulkText("");
        setShowBulkForm(false);
        fetchStudents();
      } else {
        toast.error("حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setBulkSaving(false);
    }
  };

  const openAddStudent = (folder: string) => {
    setStudentFormFolder(folder);
    setEditingStudent(null);
    setForm({ name: "", parentPhone: "", parentName: "", parentEmail: "", notes: "", accountUsername: "" });
    setShowStudentForm(true);
  };

  const openEditStudent = (s: Student) => {
    setStudentFormFolder(s.gradeLevel || UNGROUPED);
    setEditingStudent(s);
    setForm({ name: s.name, parentPhone: s.parentPhone || "", parentName: s.parentName || "", parentEmail: s.parentEmail || "", notes: s.notes || "", accountUsername: s.accountUsername || "" });
    setShowStudentForm(true);
  };

  const openBulkAdd = (folder: string) => {
    setBulkFolder(folder);
    setBulkText("");
    setImportedCount(null);
    setShowBulkForm(true);
  };

  const handleFileImport = async (file: File) => {
    setImportLoading(true);
    setImportedCount(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (bulkFolder && bulkFolder !== UNGROUPED) {
        formData.append("gradeLevel", bulkFolder);
        formData.append("studentClass", bulkFolder);
      }
      const res = await fetch(`${API_BASE}/api/students/import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "حدث خطأ أثناء الاستيراد");
        return;
      }
      if (data.saved === 0) {
        toast.warning(data.message || "لم يتم العثور على أسماء في الملف");
        return;
      }
      setImportedCount(data.saved);
      toast.success(data.message || `تم استيراد ${data.saved} طالب`);
      setShowBulkForm(false);
      fetchStudents();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const totalCount = students.length;
  const namedFolders = folders.filter((f) => f !== UNGROUPED);
  const hasUngrouped = folders.includes(UNGROUPED);
  const allGroups = [...new Set(Object.values(classGroupMap))].sort((a, b) => a.localeCompare(b, "ar"));

  return (
    <Layout>
      <div className="min-h-screen bg-background pb-16" dir="rtl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Hero — Hasad brand: deep green #1E4D35 + gold #E8A80E accent */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl text-white shadow-xl mb-6"
            style={{ background: "linear-gradient(135deg, #1E4D35 0%, #225739 60%, #1a4530 100%)" }}
          >
            {/* Gold glows */}
            <div className="absolute -top-24 -end-24 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(232,168,14,0.25) 0%, rgba(232,168,14,0) 70%)" }} />
            <div className="absolute -bottom-20 -start-20 w-64 h-64 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(232,168,14,0.10) 0%, rgba(232,168,14,0) 70%)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 24px)" }} />

            <div className="relative px-6 sm:px-8 py-6 sm:py-7">
              <div className="flex items-center gap-4">
                {/* Back button */}
                <button
                  onClick={() => setLocation("/teacher")}
                  className="shrink-0 p-2.5 rounded-xl transition-all text-white"
                  style={{ background: "rgba(232,168,14,0.15)", border: "1px solid rgba(232,168,14,0.3)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,168,14,0.28)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,168,14,0.15)"; }}
                >
                  <BackArrowIcon size={20} />
                </button>

                {/* Gold icon */}
                <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "#E8A80E", color: "#1E4D35", boxShadow: "0 4px 20px rgba(232,168,14,0.40)" }}>
                  <Users size={24} />
                </div>

                {/* Title + subtitle */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-black leading-tight" style={{ letterSpacing: "-0.5px" }}>
                    إدارة الصفوف والطلاب
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {namedFolders.length > 0 ? `${namedFolders.length} صف · ${totalCount} طالب` : "ابدأ بإنشاء صفك الأول"}
                  </p>
                </div>

                {/* Stats chips — visible on sm+ */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  {namedFolders.length > 0 && (
                    <div className="flex flex-col items-center px-5 py-2.5 rounded-xl" style={{ background: "rgba(232,168,14,0.15)", border: "1px solid rgba(232,168,14,0.25)" }}>
                      <span className="text-2xl font-black" style={{ color: "#E8A80E" }}>{namedFolders.length}</span>
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>صف</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center px-5 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    <span className="text-2xl font-black text-white">{totalCount}</span>
                    <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>طالب</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2.5 mb-6">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث عن طالب..."
                className="w-full pr-10 pl-4 py-2.5 text-sm border border-border rounded-xl bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddClass(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-md"
                style={{ background: "#1E4D35", color: "#fff", boxShadow: "0 4px 14px rgba(30,77,53,0.30)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#163a28"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1E4D35"; }}
              >
                <Plus size={16} />
                <span>صف جديد</span>
              </button>

              <button
                onClick={() => setShowAddGroup(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 text-white text-sm font-semibold rounded-xl hover:bg-violet-600 transition-colors shadow-md shadow-violet-200/40"
              >
                <Layers size={16} />
                <span className="hidden sm:inline">مجموعة</span>
              </button>

              {totalCount > 0 && (
                <button
                  onClick={() => setShowDeleteAll(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 text-red-500 text-sm rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-900"
                  title="حذف جميع الطلاب"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              جارٍ التحميل...
            </div>
          ) : namedFolders.length === 0 && !hasUngrouped ? (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50 via-amber-50/60 to-orange-50/40 dark:from-amber-950/30 dark:via-amber-950/15 dark:to-orange-950/10 p-10 text-center"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-200/60 dark:from-amber-900/40 dark:to-amber-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <BookOpen size={40} className="text-amber-500" />
              </div>
              <p className="text-foreground font-black text-lg mb-1">لا توجد صفوف بعد</p>
              <p className="text-sm text-muted-foreground mb-5">أنشئ صفاً وابدأ بإضافة الطلاب</p>
              <button
                onClick={() => setShowAddClass(true)}
                className="inline-flex items-center gap-1.5 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm font-bold shadow-md shadow-primary/20"
              >
                <Plus size={16} />
                إنشاء صف جديد
              </button>
            </motion.div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={folders.map((f) => `folder-${f}`)}
                strategy={verticalListSortingStrategy}
              >
                {/* Group classes by groupName */}
                {(() => {
                  const ungroupedClasses = namedFolders.filter(f => !classGroupMap[f]);
                  const groupedClasses = allGroups.map(grp => ({
                    name: grp,
                    classes: namedFolders.filter(f => classGroupMap[f] === grp),
                  })).filter(g => g.classes.length > 0);
                  

                  return (
                    <>
                      {/* Groups with headers — each group shows classes in 2-col grid on md+ */}
                      {groupedClasses.map(group => (
                        <div key={group.name} className="mb-6">
                          {/* Group header */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                              <Layers size={15} className="text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                              <span className="font-bold text-base text-foreground">{group.name}</span>
                              <span className="mr-2 text-xs text-muted-foreground">{group.classes.length} صف · {group.classes.reduce((acc, f) => acc + studentsInFolder(f).length, 0)} طالب</span>
                            </div>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                          {/* 2-col grid on md+ */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.classes.map(folder => {
                              const idx = namedFolders.indexOf(folder);
                              return (
                                <ClassBlock
                                  key={folder}
                                  className={folder}
                                  students={studentsInFolder(folder)}
                                  allFolders={folders}
                                  isExpanded={expandedFolders.has(folder)}
                                  colorIdx={idx}
                                  groupName={classGroupMap[folder]}
                                  allGroups={allGroups}
                                  onAssignGroup={handleAssignGroup}
                                  onAttendance={openAttendance}
                                  onToggle={() => setExpandedFolders(prev => { const next = new Set(prev); next.has(folder) ? next.delete(folder) : next.add(folder); return next; })}
                                  onRename={handleRenameClass}
                                  onDeleteClass={handleDeleteClass}
                                  onEditStudent={openEditStudent}
                                  onDeleteStudent={handleDeleteStudent}
                                  onMoveStudent={handleMoveStudent}
                                  onAddStudent={openAddStudent}
                                  onBulkAdd={openBulkAdd}
                                  onResetPassword={openResetPassword}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Ungrouped classes */}
                      {ungroupedClasses.length > 0 && groupedClasses.length > 0 && (
                        <div className="flex items-center gap-3 mb-3 mt-4">
                          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <BookOpen size={14} className="text-muted-foreground" />
                          </div>
                          <span className="font-semibold text-sm text-muted-foreground">بدون مجموعة</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ungroupedClasses.map((folder) => {
                          const idx = namedFolders.indexOf(folder);
                          return (
                            <ClassBlock
                              key={folder}
                              className={folder}
                              students={studentsInFolder(folder)}
                              allFolders={folders}
                              isExpanded={expandedFolders.has(folder)}
                              colorIdx={idx}
                              groupName={classGroupMap[folder]}
                              allGroups={allGroups}
                              onAssignGroup={handleAssignGroup}
                              onAttendance={openAttendance}
                              onToggle={() => setExpandedFolders(prev => { const next = new Set(prev); next.has(folder) ? next.delete(folder) : next.add(folder); return next; })}
                              onRename={handleRenameClass}
                              onDeleteClass={handleDeleteClass}
                              onEditStudent={openEditStudent}
                              onDeleteStudent={handleDeleteStudent}
                              onMoveStudent={handleMoveStudent}
                              onAddStudent={openAddStudent}
                              onBulkAdd={openBulkAdd}
                              onResetPassword={openResetPassword}
                            />
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* Ungrouped section at bottom */}
                {hasUngrouped && (
                  <ClassBlock
                    key={UNGROUPED}
                    className={UNGROUPED}
                    students={studentsInFolder(UNGROUPED)}
                    allFolders={folders}
                    isExpanded={expandedFolders.has(UNGROUPED)}
                    colorIdx={namedFolders.length}
                    onToggle={() => {
                      setExpandedFolders((prev) => {
                        const next = new Set(prev);
                        next.has(UNGROUPED) ? next.delete(UNGROUPED) : next.add(UNGROUPED);
                        return next;
                      });
                    }}
                    onRename={handleRenameClass}
                    onDeleteClass={handleDeleteClass}
                    onEditStudent={openEditStudent}
                    onDeleteStudent={handleDeleteStudent}
                    onMoveStudent={handleMoveStudent}
                    onAddStudent={openAddStudent}
                    onBulkAdd={openBulkAdd}
                    onResetPassword={openResetPassword}
                  />
                )}
              </SortableContext>

              <DragOverlay>
                {activeStudent && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border-2 border-teal-400 shadow-xl rotate-1">
                    <GripVertical size={13} className="text-muted-foreground/50" />
                    <span className="text-sm font-medium">{activeStudent.name}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* ── Modals ─────────────────────────────────── */}

        {/* Delete All Confirm */}
        <AnimatePresence>
          {showDeleteAll && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setShowDeleteAll(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="bg-card text-card-foreground rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle size={24} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">حذف جميع الطلاب والصفوف</h3>
                    <p className="text-sm text-muted-foreground">لا يمكن التراجع عن هذا الإجراء</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  هل أنت متأكد من حذف <strong>{totalCount} طالب</strong> وجميع الصفوف؟
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAll}
                    disabled={deleteAllLoading}
                    className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleteAllLoading ? "جارٍ الحذف..." : "حذف الكل"}
                  </button>
                  <button
                    onClick={() => setShowDeleteAll(false)}
                    className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Class Modal */}
        <AnimatePresence>
          {showAddClass && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setShowAddClass(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="bg-card text-card-foreground rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                    <BookOpen size={16} className="text-primary-foreground" />
                  </div>
                  إضافة صف جديد
                </h3>
                <input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
                  autoFocus
                  className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="مثال: الصف الأول أ"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleAddClass}
                    disabled={!newClassName.trim()}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shadow-primary/20"
                  >
                    إنشاء
                  </button>
                  <button
                    onClick={() => setShowAddClass(false)}
                    className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Student Form Modal */}
        <AnimatePresence>
          {showStudentForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setShowStudentForm(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="bg-card text-card-foreground rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
                  {editingStudent ? <Pencil size={18} className="text-primary" /> : <UserPlus size={18} className="text-primary" />}
                  {editingStudent ? "تعديل بيانات الطالب" : "إضافة طالب"}
                </h3>
                {studentFormFolder && studentFormFolder !== UNGROUPED && (
                  <p className="text-xs text-muted-foreground mb-4">الصف: <span className="font-semibold text-foreground">{studentFormFolder}</span></p>
                )}

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">اسم الطالب *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      autoFocus
                      className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="الاسم الكامل"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                      <Phone size={12} /> رقم ولي الأمر
                    </label>
                    <input
                      value={form.parentPhone}
                      onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                      className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="اختياري"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                        <User size={12} className="text-emerald-600" /> اسم ولي الأمر
                      </label>
                      <input
                        value={form.parentName}
                        onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                        className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        placeholder="اختياري"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                        <Mail size={12} className="text-emerald-600" /> إيميل ولي الأمر
                      </label>
                      <input
                        value={form.parentEmail}
                        onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                        type="email"
                        dir="ltr"
                        className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        placeholder="example@mail.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                      <KeyRound size={12} className="text-violet-500" />
                      اسم المستخدم في المنصة
                    </label>
                    <input
                      value={form.accountUsername}
                      onChange={(e) => setForm({ ...form, accountUsername: e.target.value.replace(/\s/g, "") })}
                      dir="ltr"
                      className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      placeholder="مثال: ahmed_2024 (اختياري)"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      اسم المستخدم الذي يستخدمه الطالب لتسجيل الدخول — يُستخدم لإعادة تعيين كلمة المرور
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">ملاحظات</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                      placeholder="اختياري"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveStudent}
                    disabled={saving || !form.name.trim()}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shadow-primary/20"
                  >
                    {saving ? "جارٍ الحفظ..." : editingStudent ? "تحديث" : "إضافة"}
                  </button>
                  <button
                    onClick={() => setShowStudentForm(false)}
                    className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Add Modal */}
        <AnimatePresence>
          {showBulkForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setShowBulkForm(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="bg-card text-card-foreground rounded-2xl p-6 max-w-md w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
                  <ListPlus size={18} className="text-primary" />
                  إضافة أسماء بالجملة
                </h3>
                {bulkFolder && bulkFolder !== UNGROUPED && (
                  <p className="text-xs text-muted-foreground mb-3">الصف: <span className="font-semibold text-foreground">{bulkFolder}</span></p>
                )}

                {/* File import buttons */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Upload size={12} />
                    استيراد من ملف
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = ".xlsx,.xls,.csv";
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={importLoading}
                      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 border-dashed border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all text-green-700 disabled:opacity-50"
                    >
                      <FileSpreadsheet size={20} />
                      <span className="text-xs font-medium">Excel / CSV</span>
                    </button>
                    <button
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = ".docx,.doc";
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={importLoading}
                      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all text-blue-700 disabled:opacity-50"
                    >
                      <FileText size={20} />
                      <span className="text-xs font-medium">Word</span>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileImport(file);
                    }}
                  />
                  {importLoading && (
                    <div className="flex items-center justify-center gap-2 mt-3 py-2 bg-muted rounded-xl text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin text-primary" />
                      <span>جارٍ قراءة الملف واستخراج الأسماء...</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                    Excel: يأخذ عمود الأسماء تلقائياً · Word: يقرأ السطور
                  </p>
                </div>

                <div className="relative mb-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-2 text-xs text-muted-foreground">أو أدخل الأسماء يدوياً</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-2">ضع كل اسم في سطر منفصل</p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={6}
                  className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none mb-4"
                  placeholder={"أحمد محمد\nسارة علي\nمحمد خالد"}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleBulkAdd}
                    disabled={bulkSaving || !bulkText.trim()}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shadow-primary/20"
                  >
                    {bulkSaving ? "جارٍ الإضافة..." : "إضافة"}
                  </button>
                  <button
                    onClick={() => setShowBulkForm(false)}
                    className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reset Password Modal */}
        <AnimatePresence>
          {resetPasswordStudent && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setResetPasswordStudent(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                className="bg-card text-card-foreground rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
                    <KeyRound size={22} className="text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">إعادة تعيين كلمة المرور</h3>
                    <p className="text-sm text-muted-foreground">{resetPasswordStudent.name}</p>
                  </div>
                  <button
                    onClick={() => setResetPasswordStudent(null)}
                    className="mr-auto p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <X size={16} />
                  </button>
                </div>

                {!resetPasswordStudent?.accountUsername ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                        لم يُربط حساب منصة بعد
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        لإعادة تعيين كلمة المرور، يجب أولاً ربط حساب الطالب على المنصة. افتح بيانات الطالب وأضف اسم المستخدم في حقل "اسم المستخدم في المنصة".
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          const s = resetPasswordStudent!;
                          setResetPasswordStudent(null);
                          openEditStudent(s);
                        }}
                        className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Pencil size={15} />
                        تعديل بيانات الطالب
                      </button>
                      <button
                        onClick={() => setResetPasswordStudent(null)}
                        className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                ) : !resetDone ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        حساب المنصة المرتبط
                      </label>
                      <div
                        className="w-full border border-border bg-muted/50 text-foreground rounded-xl px-3 py-2.5 text-sm flex items-center gap-2"
                        dir="ltr"
                      >
                        <span className="flex-1 font-mono">{resetPasswordStudent.accountUsername}</span>
                        <span className="text-[10px] text-violet-500 font-semibold bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-md">مرتبط</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        لتغيير الحساب المرتبط، عدّل بيانات الطالب
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        كلمة المرور الجديدة
                      </label>
                      <div className="relative">
                        <input
                          type={resetShowPassword ? "text" : "password"}
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="4 أحرف على الأقل"
                          dir="ltr"
                          className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setResetShowPassword((v) => !v)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {resetShowPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={generatePassword}
                            title="توليد كلمة مرور"
                            className="p-1 text-violet-500 hover:text-violet-700 transition-colors"
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={handleResetPassword}
                        disabled={resetSaving || resetNewPassword.length < 4}
                        className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {resetSaving ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <KeyRound size={15} />
                        )}
                        تغيير كلمة المرور
                      </button>
                      <button
                        onClick={() => setResetPasswordStudent(null)}
                        className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                      <Check size={28} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground mb-1">تم تغيير كلمة المرور</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        أخبر الطالب بكلمة المرور الجديدة
                      </p>
                      <div
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-widest select-all"
                        style={{ background: "hsl(40 20% 94%)", color: "#1a4731" }}
                        dir="ltr"
                      >
                        {resetShowPassword ? resetNewPassword : "••••••••"}
                        <button
                          onClick={() => setResetShowPassword((v) => !v)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {resetShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setResetPasswordStudent(null)}
                      className="w-full py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                    >
                      إغلاق
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Add Group Modal ── */}
        <AnimatePresence>
          {showAddGroup && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setShowAddGroup(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="bg-card text-card-foreground rounded-2xl p-6 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl"><Layers size={20} className="text-violet-600" /></div>
                  <h3 className="font-bold text-foreground">مجموعة / مرحلة جديدة</h3>
                </div>

                <label className="block text-xs font-semibold text-muted-foreground mb-1">اسم المجموعة</label>
                <input
                  autoFocus
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder='مثال: صفوف الخامس'
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4"
                />

                <label className="block text-xs font-semibold text-muted-foreground mb-2">اختر الصفوف التي تريد إضافتها (يمكن اختيار أكثر من صف):</label>
                <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto border border-border rounded-xl p-2">
                  {namedFolders.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">لا توجد صفوف بعد</p>
                  )}
                  {namedFolders.map(f => (
                    <label key={f} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={groupTargetClasses.includes(f)}
                        onChange={e => {
                          if (e.target.checked) setGroupTargetClasses(prev => [...prev, f]);
                          else setGroupTargetClasses(prev => prev.filter(x => x !== f));
                        }}
                        className="w-4 h-4 accent-violet-500"
                      />
                      <span className="text-sm">{f}</span>
                      {classGroupMap[f] && (
                        <span className="text-[10px] text-violet-500 bg-violet-50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded-full">{classGroupMap[f]}</span>
                      )}
                    </label>
                  ))}
                </div>
                {groupTargetClasses.length > 0 && (
                  <p className="text-xs text-violet-600 mb-3 font-medium">✓ تم تحديد {groupTargetClasses.length} صف</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (!newGroupName.trim()) return;
                      if (groupTargetClasses.length > 0) {
                        await handleAssignGroupMulti(groupTargetClasses, newGroupName.trim());
                      } else {
                        toast.success(`تم إنشاء المجموعة "${newGroupName.trim()}" — عيّن الصفوف إليها من زر "مجموعة" في كل صف`);
                      }
                      setNewGroupName(""); setGroupTargetClasses([]); setShowAddGroup(false);
                    }}
                    disabled={!newGroupName.trim()}
                    className="flex-1 py-2.5 bg-violet-500 text-white rounded-xl font-bold hover:bg-violet-600 transition-colors disabled:opacity-50"
                  >
                    إنشاء {groupTargetClasses.length > 0 ? `وإضافة ${groupTargetClasses.length} صف` : ""}
                  </button>
                  <button
                    onClick={() => { setShowAddGroup(false); setNewGroupName(""); setGroupTargetClasses([]); }}
                    className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Attendance Modal ── */}
        <AnimatePresence>
          {attendanceClass && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
              onClick={() => setAttendanceClass(null)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                className="bg-card text-card-foreground rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center gap-3 p-4 border-b border-border">
                  <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-xl shrink-0"><UserCheck size={18} className="text-sky-600" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground text-sm">الحضور والغياب — {attendanceClass}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">يمكنك تسجيل حضور أي يوم سابق باختيار التاريخ</p>
                  </div>
                  <button onClick={() => setAttendanceClass(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted shrink-0">
                    <X size={16} />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                  <button
                    onClick={() => setAttendanceTab("register")}
                    className={`flex-1 py-2.5 text-xs font-bold transition-colors ${attendanceTab === "register" ? "text-sky-600 border-b-2 border-sky-500 bg-sky-50/50 dark:bg-sky-950/20" : "text-muted-foreground hover:bg-muted/50"}`}
                  >
                    📋 تسجيل الحضور
                  </button>
                  <button
                    onClick={() => setAttendanceTab("report")}
                    className={`flex-1 py-2.5 text-xs font-bold transition-colors ${attendanceTab === "report" ? "text-amber-600 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : "text-muted-foreground hover:bg-muted/50"}`}
                  >
                    📊 سجل الغياب
                  </button>
                </div>

                {attendanceTab === "register" && (
                  <>
                    {/* Date navigator */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
                      <button
                        onClick={() => {
                          const d = new Date(attendanceDate); d.setDate(d.getDate() - 1);
                          const s = d.toISOString().slice(0, 10);
                          setAttendanceDate(s);
                          if (attendanceClass) loadAttendanceForDate(attendanceClass, s);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        title="اليوم السابق"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <input
                        type="date"
                        value={attendanceDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={e => {
                          setAttendanceDate(e.target.value);
                          if (attendanceClass) loadAttendanceForDate(attendanceClass, e.target.value);
                        }}
                        className="flex-1 text-center text-sm font-bold bg-transparent border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
                      />
                      <button
                        onClick={() => {
                          const d = new Date(attendanceDate); d.setDate(d.getDate() + 1);
                          const s = d.toISOString().slice(0, 10);
                          if (s <= new Date().toISOString().slice(0, 10)) {
                            setAttendanceDate(s);
                            if (attendanceClass) loadAttendanceForDate(attendanceClass, s);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground disabled:opacity-30"
                        title="اليوم التالي"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const today = new Date().toISOString().slice(0, 10);
                          setAttendanceDate(today);
                          if (attendanceClass) loadAttendanceForDate(attendanceClass, today);
                        }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-600 hover:bg-sky-200 transition-colors"
                      >
                        اليوم
                      </button>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] text-muted-foreground bg-muted/10">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block"/> حاضر</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"/> غائب</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"/> متأخر</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"/> بعذر</span>
                      <span className="mr-auto text-sky-500 font-medium">
                        غائب: {Object.values(attendanceMap).filter(v => v === "absent").length} طالب
                      </span>
                    </div>

                    {/* Student list */}
                    <div className="overflow-y-auto flex-1 p-3 space-y-1">
                      {studentsInFolder(attendanceClass).map((s, idx) => {
                        const status = attendanceMap[s.id] ?? "present";
                        const STATUS_OPTIONS: Array<{ value: "present"|"absent"|"late"|"excused"; label: string; color: string }> = [
                          { value: "present", label: "حاضر", color: "bg-green-500" },
                          { value: "absent", label: "غائب", color: "bg-red-500" },
                          { value: "late", label: "متأخر", color: "bg-amber-500" },
                          { value: "excused", label: "بعذر", color: "bg-blue-500" },
                        ];
                        return (
                          <div key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors
                            ${status === "absent" ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
                            : status === "late" ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                            : status === "excused" ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                            : "bg-background border-border/50 hover:border-border"}`}>
                            <span className="text-xs text-muted-foreground w-5 text-center font-bold shrink-0">{idx + 1}</span>
                            <span className="flex-1 text-sm font-medium">{s.name}</span>
                            <div className="flex items-center gap-1">
                              {STATUS_OPTIONS.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => setAttendanceMap(prev => ({ ...prev, [s.id]: opt.value }))}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    status === opt.value
                                      ? `${opt.color} text-white shadow-sm scale-105`
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {studentsInFolder(attendanceClass).length === 0 && (
                        <p className="text-center py-8 text-muted-foreground text-sm">لا يوجد طلاب في هذا الصف</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border flex gap-3">
                      <button
                        onClick={saveAttendance}
                        disabled={savingAttendance}
                        className="flex-1 py-2.5 bg-sky-500 text-white rounded-xl font-bold hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {savingAttendance ? <><Loader2 size={14} className="animate-spin"/> حفظ...</> : <><Check size={14}/> حفظ الحضور</>}
                      </button>
                      <button
                        onClick={() => setAttendanceClass(null)}
                        className="px-4 py-2.5 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                      >
                        إغلاق
                      </button>
                    </div>
                  </>
                )}

                {attendanceTab === "report" && (
                  <div className="overflow-y-auto flex-1 p-4">
                    <p className="text-xs text-muted-foreground mb-3">سجل الغياب والتأخر — آخر 30 يوماً</p>
                    {(() => {
                      const classStudents = studentsInFolder(attendanceClass);
                      const absentRecords = attendanceReport
                        .filter(r => r.status === "absent" || r.status === "late" || r.status === "excused");
                      if (absentRecords.length === 0) {
                        return (
                          <div className="text-center py-10 text-muted-foreground">
                            <div className="text-4xl mb-2">✅</div>
                            <p className="font-bold">لا توجد غيابات مسجّلة</p>
                            <p className="text-xs mt-1">سجّل الحضور اليومي من تبويب "تسجيل الحضور"</p>
                          </div>
                        );
                      }
                      // Group by student
                      const byStudent: Record<number, Array<{ date: string; status: string }>> = {};
                      absentRecords.forEach(r => {
                        if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
                        byStudent[r.studentId].push({ date: r.date, status: r.status });
                      });
                      return (
                        <div className="space-y-3">
                          {Object.entries(byStudent)
                            .sort((a, b) => b[1].length - a[1].length)
                            .map(([sid, records]) => {
                              const student = classStudents.find(s => s.id === Number(sid));
                              if (!student) return null;
                              const absences = records.filter(r => r.status === "absent").length;
                              const late = records.filter(r => r.status === "late").length;
                              const excused = records.filter(r => r.status === "excused").length;
                              return (
                                <div key={sid} className="rounded-xl border border-border bg-background p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-bold text-sm">{student.name}</span>
                                    <span className="mr-auto flex items-center gap-1.5">
                                      {absences > 0 && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-full font-bold">غائب {absences}×</span>}
                                      {late > 0 && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-2 py-0.5 rounded-full font-bold">متأخر {late}×</span>}
                                      {excused > 0 && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-full font-bold">بعذر {excused}×</span>}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {records.sort((a, b) => b.date.localeCompare(a.date)).map((r, i) => (
                                      <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                                        ${r.status === "absent" ? "bg-red-50 dark:bg-red-950/30 text-red-500"
                                        : r.status === "late" ? "bg-amber-50 dark:bg-amber-950/30 text-amber-500"
                                        : "bg-blue-50 dark:bg-blue-950/30 text-blue-500"}`}>
                                        {r.date}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </Layout>
  );
}
