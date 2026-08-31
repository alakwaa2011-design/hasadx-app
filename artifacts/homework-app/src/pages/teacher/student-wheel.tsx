import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Layout } from "@/components/layout";
import { Button, Card, Input, Label } from "@/components/ui-elements";
import { ClassSelector, getRememberedTargetClass } from "@/components/teacher/class-selector";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Dices,
  History,
  ListRestart,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "framer-motion";
import { playNotificationSound } from "@/lib/game-sounds";
import { useWheelAudio } from "@/lib/wheel-audio";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Student {
  id: number;
  name: string;
  gradeLevel?: string | null;
  studentClass?: string | null;
}

interface Participant {
  id: string;
  name: string;
  source: 'class' | 'manual';
}

interface PickHistoryItem {
  id: string;
  participantId: string;
  name: string;
  time: Date;
  returnedToWheel?: boolean;
}

const normalizeName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const easeOutQuart = (value: number) => 1 - Math.pow(1 - value, 4);
const SPIN_DURATION_MS = 5000;

const randomIndex = (length: number) => {
  if (length <= 1) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % length;
};

const getSliceColor = (index: number, total: number) => {
  const colors = ["#2f684d", "#D9A521", "#1c4630", "#F5C842"];
  if (total % 2 === 0) {
    return colors[index % 2];
  } else if (total % 3 === 0) {
    return colors[index % 3];
  } else {
    let cIndex = index % colors.length;
    if (index === total - 1 && cIndex === 0) {
      cIndex = 1;
    }
    return colors[cIndex];
  }
};

export default function StudentWheelPage() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<'class' | 'manual'>('class');
  const [className, setClassName] = useState<string>(() => getRememberedTargetClass());
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState(false);

  const [singleName, setSingleName] = useState("");
  const [bulkNames, setBulkNames] = useState("");
  const [manualParticipants, setManualParticipants] = useState<Participant[]>([]);

  const [noRepeat, setNoRepeat] = useState(true);
  const [showAvailableList, setShowAvailableList] = useState(true);
  const [showPickedList, setShowPickedList] = useState(false);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<PickHistoryItem[]>([]);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<Participant | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem("hasad:student-wheel-sound") !== "false";
    } catch {
      return true;
    }
  });

  const audio = useWheelAudio(soundEnabled);

  useEffect(() => {
    try {
      localStorage.setItem("hasad:student-wheel-sound", String(soundEnabled));
    } catch (e) {}
  }, [soundEnabled]);

  useEffect(() => {
    setLoadingStudents(true);
    setStudentsError(false);
    fetch(`${API_BASE}/api/students`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("students_load_failed");
        return response.json();
      })
      .then((data) => setAllStudents(Array.isArray(data) ? data : []))
      .catch(() => {
        setStudentsError(true);
        toast.error(isAr ? "تعذّر تحميل قائمة الطلاب" : "Failed to load students");
      })
      .finally(() => setLoadingStudents(false));
  }, [isAr]);

  useEffect(() => () => {
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  // A new source starts a fresh fair round without deleting the visible history.
  useEffect(() => {
    setDisabledIds(new Set());
    setPickedIds(new Set());
    setShowAvailableList(true);
    setShowPickedList(false);
    setSelectedWinner(null);
    setShowWinner(false);
  }, [className, mode]);

  const activeRoster = useMemo(() => {
    if (!className) return [];
    return allStudents.filter(
      (s) => s.studentClass === className || s.gradeLevel === className
    );
  }, [className, allStudents]);

  const sourceParticipants = useMemo(() => {
    const participants = mode === 'class'
      ? activeRoster.map((s) => ({ id: String(s.id), name: s.name, source: 'class' as const }))
      : manualParticipants;

    // The wheel displays names, so duplicate visible names must share one slot
    // even when the backing student records have different IDs.
    const seenNames = new Set<string>();
    return participants.filter((participant) => {
      const normalized = normalizeName(participant.name);
      if (!normalized || seenNames.has(normalized)) return false;
      seenNames.add(normalized);
      return true;
    });
  }, [mode, activeRoster, manualParticipants]);

  const enabledParticipants = useMemo(
    () => sourceParticipants.filter((participant) => !disabledIds.has(participant.id)),
    [sourceParticipants, disabledIds],
  );

  const pickedNames = useMemo(() => {
    const names = new Set<string>();
    sourceParticipants.forEach((participant) => {
      if (pickedIds.has(participant.id)) names.add(normalizeName(participant.name));
    });
    return names;
  }, [sourceParticipants, pickedIds]);

  const currentParticipants = useMemo(
    () => enabledParticipants.filter(
      (participant) => !noRepeat || !pickedNames.has(normalizeName(participant.name)),
    ),
    [enabledParticipants, noRepeat, pickedNames],
  );

  const availableParticipants = useMemo(
    () => sourceParticipants.filter(
      (participant) => !noRepeat || !pickedIds.has(participant.id),
    ),
    [sourceParticipants, noRepeat, pickedIds],
  );

  const pickedParticipants = useMemo(
    () => sourceParticipants.filter(
      (participant) => noRepeat && pickedIds.has(participant.id),
    ),
    [sourceParticipants, noRepeat, pickedIds],
  );

  const addManualNames = (rawNames: string) => {
    const names = rawNames.split(/[\n,،;]+/).map((name) => name.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (names.length === 0) return;

    setManualParticipants((prev) => {
      const existingNames = new Set(prev.map((participant) => normalizeName(participant.name)));
      const uniqueNames = names.filter((name) => {
        const normalized = normalizeName(name);
        if (!normalized || existingNames.has(normalized)) return false;
        existingNames.add(normalized);
        return true;
      });
      return [
        ...prev,
        ...uniqueNames.map((name) => ({
          id: crypto.randomUUID(),
          name,
          source: 'manual' as const,
        })),
      ];
    });
  };

  const handleAddSingle = () => {
    if (!singleName.trim()) return;
    addManualNames(singleName);
    setSingleName("");
  };

  const handleAddBulk = () => {
    if (!bulkNames.trim()) return;
    addManualNames(bulkNames);
    setBulkNames("");
  };

  const handleSpin = () => {
    if (currentParticipants.length === 0 || spinning) return;

    setSpinning(true);
    setShowWinner(false);

    const numSlices = currentParticipants.length;
    const sliceAngle = 360 / numSlices;
    
    // Pick winner
    const winnerIndex = randomIndex(numSlices);
    const winner = currentParticipants[winnerIndex];

    const currentBase = rotation - (rotation % 360);
    const spins = 6 + randomIndex(3);
    // We want the center of the winning slice to align with the top (0 degrees).
    const targetRotation = currentBase + (spins * 360) - (winnerIndex * sliceAngle + sliceAngle / 2);
    const finalRotation = targetRotation;

    const startRotation = rotation;
    const startedAt = performance.now();
    audio.startTicking(SPIN_DURATION_MS);

    const animateSpin = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / SPIN_DURATION_MS);
      const easedProgress = easeOutQuart(progress);
      setRotation(startRotation + (finalRotation - startRotation) * easedProgress);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateSpin);
        return;
      }

      animationFrameRef.current = null;
      setSpinning(false);
      audio.stopTicking();
      setSelectedWinner(winner);
      setPickedIds((prev) => noRepeat ? new Set(prev).add(winner.id) : prev);
      setShowAvailableList(true);
      setShowPickedList(false);
      setHistory((prev) => [{
        id: crypto.randomUUID(),
        participantId: winner.id,
        name: winner.name,
        time: new Date(),
      }, ...prev]);

      // Match the challenge wheel: let the wheel settle before revealing the result.
      spinTimeoutRef.current = setTimeout(() => {
        setShowWinner(true);
        if (soundEnabled) playNotificationSound();
        spinTimeoutRef.current = null;
      }, 350);
    };

    animationFrameRef.current = requestAnimationFrame(animateSpin);
  };

  const returnParticipantToWheel = (participantId: string, historyId?: string) => {
    if (!pickedIds.has(participantId)) return;

    setPickedIds((prev) => {
      const next = new Set(prev);
      next.delete(participantId);
      return next;
    });
    setHistory((prev) => {
      let marked = false;
      return prev.map((item) => {
        if (
          !marked &&
          (historyId ? item.id === historyId : item.participantId === participantId) &&
          !item.returnedToWheel
        ) {
          marked = true;
          return { ...item, returnedToWheel: true };
        }
        return item;
      });
    });
    toast.success(isAr ? "تمت إعادة الاسم إلى العجلة" : "Name returned to the wheel");
  };

  const toggleDisabled = (id: string, currentlyDisabled: boolean) => {
    setDisabledIds((prev) => {
      const next = new Set(prev);
      if (currentlyDisabled) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startNewRound = () => {
    setPickedIds(new Set());
    setShowAvailableList(true);
    setShowPickedList(false);
    setSelectedWinner(null);
    setShowWinner(false);
    toast.success(isAr ? "بدأت دورة جديدة" : "New round started");
  };

  const renderParticipantRow = (participant: Participant, canRemove = false) => {
    const disabled = disabledIds.has(participant.id);
    const alreadyPicked = noRepeat && pickedIds.has(participant.id);
    const rowTestId = participant.source === "class"
      ? `row-student-${participant.id}`
      : `row-manual-participant-${participant.id}`;
    const checkboxTestId = participant.source === "class"
      ? `checkbox-student-${participant.id}`
      : `checkbox-manual-${participant.id}`;

    return (
      <div
        key={participant.id}
        data-testid={rowTestId}
        className={`flex items-center gap-3 p-2.5 rounded-lg group transition-colors border ${
          disabled ? 'bg-muted/30 border-transparent opacity-60' : 'bg-background border-border/60 hover:border-primary/30 shadow-sm'
        }`}
      >
        <input
          type="checkbox"
          checked={!disabled}
          onChange={() => toggleDisabled(participant.id, disabled)}
          data-testid={checkboxTestId}
          className="rounded-sm text-primary focus:ring-primary h-4 w-4 border-muted-foreground/30 cursor-pointer"
        />
        {alreadyPicked ? (
          <button
            type="button"
            onClick={() => returnParticipantToWheel(participant.id)}
            data-testid={
              participant.source === "class"
                ? `button-return-student-${participant.id}`
                : `button-return-manual-${participant.id}`
            }
            className="flex min-w-0 flex-1 items-center gap-2 text-start"
            title={isAr ? "إعادة الاسم إلى العجلة" : "Return name to wheel"}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
              {participant.name}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-1">
              <Check className="w-3 h-3" />
              {isAr ? "تم اختياره — اضغط للإعادة" : "Picked — click to return"}
            </span>
          </button>
        ) : (
          <span className={`min-w-0 flex-1 truncate text-sm font-bold ${disabled ? 'line-through' : 'text-foreground'}`}>
            {participant.name}
          </span>
        )}
        {canRemove && (
          <button
            onClick={() => setManualParticipants((prev) => prev.filter((item) => item.id !== participant.id))}
            data-testid={`button-remove-manual-${participant.id}`}
            className="opacity-0 group-hover:opacity-100 text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-all"
            title={isAr ? "حذف" : "Remove"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div dir={dir} className="container mx-auto px-3 sm:px-4 py-5 sm:py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setLocation("/teacher")}
            data-testid="button-back-dashboard"
            className="p-2.5 bg-muted/80 rounded-xl hover:bg-muted transition-colors text-foreground"
          >
            {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100/50 flex items-center justify-center border border-emerald-100/50">
              <Dices className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 data-testid="text-page-title" className="text-xl sm:text-2xl font-black text-foreground">
                {isAr ? "عجلة اختيار الطلاب" : "Student Selection Wheel"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {isAr ? "اختر طالباً بإنصاف وبضغطة واحدة" : "Pick a student fairly with one click"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          {/* LEFT: Controls */}
          <div className="w-full lg:w-1/3 flex flex-col gap-4">
            <div className="flex p-1.5 bg-muted/60 rounded-xl border border-border/50">
              <button
                onClick={() => setMode('class')}
                data-testid="button-tab-class"
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  mode === 'class' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isAr ? "من الفصل" : "From Class"}
              </button>
              <button
                onClick={() => setMode('manual')}
                data-testid="button-tab-manual"
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  mode === 'manual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isAr ? "قائمة يدوية" : "Manual List"}
              </button>
            </div>

            {mode === 'class' ? (
              <Card className="p-4 flex flex-col gap-4 shadow-sm" data-testid="card-class-mode">
                <ClassSelector
                  value={className}
                  onChange={setClassName}
                  accent="#225739"
                />
                
                <div className="flex-1 overflow-y-auto max-h-[350px] pr-2 space-y-1">
                  {loadingStudents ? (
                    <div className="py-8 text-center text-muted-foreground text-sm animate-pulse" data-testid="text-loading-students">
                      {isAr ? "جاري التحميل..." : "Loading..."}
                    </div>
                  ) : activeRoster.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm bg-muted/30 rounded-xl border border-dashed" data-testid="text-empty-roster">
                      {className 
                        ? (isAr ? "لا يوجد طلاب في هذا الفصل" : "No students in this class") 
                        : (isAr ? "اختر فصلاً لعرض الطلاب" : "Select a class to view students")}
                    </div>
                  ) : (
                     <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between mb-1 pb-2 border-b border-border/50">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider" data-testid="text-student-count">
                           {sourceParticipants.filter((participant) => participant.source === "class").length} {isAr ? "طالب" : "students"}
                        </span>
                        {(disabledIds.size > 0) && (
                          <button
                            onClick={() => setDisabledIds(new Set())}
                            data-testid="button-restore-all"
                            className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            {isAr ? "إعادة الجميع" : "Restore All"}
                          </button>
                        )}
                      </div>
                       <div className="rounded-xl border border-border/50 overflow-hidden">
                         <button
                           type="button"
                           onClick={() => setShowAvailableList((value) => !value)}
                           aria-expanded={showAvailableList}
                           data-testid="button-toggle-available-list"
                           className="flex w-full items-center justify-between gap-3 bg-muted/30 px-3 py-2.5 text-start hover:bg-muted/50 transition-colors"
                         >
                           <span className="text-xs font-black text-foreground">
                             {isAr ? `المتاحون (${availableParticipants.filter((p) => p.source === "class").length})` : `Available (${availableParticipants.filter((p) => p.source === "class").length})`}
                           </span>
                           <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAvailableList ? "rotate-180" : ""}`} />
                         </button>
                         {showAvailableList && (
                           <div className="flex flex-col gap-1.5 p-2">
                             {availableParticipants
                               .filter((participant) => participant.source === "class")
                               .map((participant) => renderParticipantRow(participant))}
                           </div>
                         )}
                       </div>
                       {pickedParticipants.some((participant) => participant.source === "class") && (
                         <div className="rounded-xl border border-border/50 overflow-hidden">
                           <button
                             type="button"
                             onClick={() => setShowPickedList((value) => !value)}
                             aria-expanded={showPickedList}
                             data-testid="button-toggle-picked-list"
                             className="flex w-full items-center justify-between gap-3 bg-primary/5 px-3 py-2.5 text-start hover:bg-primary/10 transition-colors"
                           >
                             <span className="text-xs font-black text-foreground">
                               {isAr ? `تم اختيارهم (${pickedParticipants.filter((p) => p.source === "class").length})` : `Picked (${pickedParticipants.filter((p) => p.source === "class").length})`}
                             </span>
                             <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPickedList ? "rotate-180" : ""}`} />
                           </button>
                           {showPickedList && (
                             <div className="flex flex-col gap-1.5 p-2">
                               {pickedParticipants
                                 .filter((participant) => participant.source === "class")
                                 .map((participant) => renderParticipantRow(participant))}
                             </div>
                           )}
                         </div>
                       )}
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-4 flex flex-col gap-4 shadow-sm" data-testid="card-manual-mode">
                <div>
                  <Label htmlFor="single-student-name" className="text-xs text-muted-foreground mb-1.5 inline-block">
                    {isAr ? "إضافة اسم فردي" : "Add one name"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="single-student-name"
                      value={singleName}
                      onChange={(event) => setSingleName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddSingle();
                        }
                      }}
                      data-testid="input-single-name"
                      placeholder={isAr ? "اكتب اسم الطالب" : "Enter student name"}
                      className="min-w-0 flex-1 py-2.5"
                    />
                    <Button
                      onClick={handleAddSingle}
                      disabled={!singleName.trim()}
                      data-testid="button-add-single"
                      className="px-4 py-2.5 shrink-0"
                      aria-label={isAr ? "إضافة الاسم" : "Add name"}
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="bulk-student-names" className="text-xs text-muted-foreground mb-1.5 inline-block">
                    {isAr ? "إضافة عدة أسماء بالنسخ واللصق" : "Paste multiple names"}
                  </Label>
                  <textarea
                    id="bulk-student-names"
                    value={bulkNames}
                    onChange={(event) => setBulkNames(event.target.value)}
                    data-testid="input-bulk-names"
                    className="w-full p-3 rounded-xl border-2 border-border/80 bg-background text-sm min-h-[100px] resize-none focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/50"
                    placeholder={isAr ? "الصق الأسماء هنا، اسم في كل سطر" : "Paste names here, one per line"}
                  />
                  <Button
                    onClick={handleAddBulk}
                    disabled={!bulkNames.trim()}
                    data-testid="button-add-bulk"
                    className="w-full mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="ms-2">{isAr ? "إضافة الأسماء للقائمة" : "Add names to list"}</span>
                  </Button>
                </div>

                 <div className="flex-1 overflow-y-auto max-h-[250px] pr-2 space-y-3">
                  {manualParticipants.length === 0 && (
                    <div className="py-6 text-center text-muted-foreground text-xs bg-muted/30 rounded-xl border border-dashed" data-testid="text-empty-manual">
                      {isAr ? "القائمة فارغة" : "List is empty"}
                    </div>
                  )}
                   <div className="rounded-xl border border-border/50 overflow-hidden">
                     <button
                       type="button"
                       onClick={() => setShowAvailableList((value) => !value)}
                       aria-expanded={showAvailableList}
                       data-testid="button-toggle-available-list"
                       className="flex w-full items-center justify-between gap-3 bg-muted/30 px-3 py-2.5 text-start hover:bg-muted/50 transition-colors"
                     >
                       <span className="text-xs font-black text-foreground">
                         {isAr ? `المتاحون (${availableParticipants.filter((p) => p.source === "manual").length})` : `Available (${availableParticipants.filter((p) => p.source === "manual").length})`}
                       </span>
                       <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAvailableList ? "rotate-180" : ""}`} />
                     </button>
                     {showAvailableList && (
                       <div className="flex flex-col gap-1.5 p-2">
                         {availableParticipants
                           .filter((participant) => participant.source === "manual")
                           .map((participant) => renderParticipantRow(participant, true))}
                       </div>
                     )}
                   </div>
                   {pickedParticipants.some((participant) => participant.source === "manual") && (
                     <div className="rounded-xl border border-border/50 overflow-hidden">
                       <button
                         type="button"
                         onClick={() => setShowPickedList((value) => !value)}
                         aria-expanded={showPickedList}
                         data-testid="button-toggle-picked-list"
                         className="flex w-full items-center justify-between gap-3 bg-primary/5 px-3 py-2.5 text-start hover:bg-primary/10 transition-colors"
                       >
                         <span className="text-xs font-black text-foreground">
                           {isAr ? `تم اختيارهم (${pickedParticipants.filter((p) => p.source === "manual").length})` : `Picked (${pickedParticipants.filter((p) => p.source === "manual").length})`}
                         </span>
                         <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPickedList ? "rotate-180" : ""}`} />
                       </button>
                       {showPickedList && (
                         <div className="flex flex-col gap-1.5 p-2">
                           {pickedParticipants
                             .filter((participant) => participant.source === "manual")
                             .map((participant) => renderParticipantRow(participant, true))}
                         </div>
                       )}
                     </div>
                   )}
                </div>
                {manualParticipants.length > 0 && (
                  <Button
                    onClick={() => {
                      setManualParticipants([]);
                      setDisabledIds(new Set());
                      setPickedIds(new Set());
                      setHistory([]);
                    }}
                    data-testid="button-clear-manual"
                    variant="ghost"
                    className="text-destructive text-sm mt-1 hover:bg-destructive/10"
                  >
                    {isAr ? "مسح القائمة بالكامل" : "Clear Entire List"}
                  </Button>
                )}
              </Card>
            )}

            <button
              type="button"
              role="switch"
              aria-checked={noRepeat}
              onClick={() => {
                setNoRepeat((value) => {
                  if (value) setPickedIds(new Set());
                  return !value;
                });
              }}
              data-testid="button-toggle-no-repeat"
              className="w-full text-start"
            >
              <Card className="p-4 shadow-sm hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 relative shrink-0 ${noRepeat ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <div className={`absolute top-1 start-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm ${noRepeat ? (isAr ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold text-foreground">{isAr ? "عدم التكرار" : "No Repeat"}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{isAr ? "استبعاد الطالب تلقائياً بعد اختياره" : "Automatically exclude student after being picked"}</span>
                </div>
              </div>
              </Card>
            </button>

            {noRepeat && enabledParticipants.length > 0 && currentParticipants.length === 0 && (
              <Card className="p-4 border-primary/30 bg-primary/5 shadow-sm" data-testid="status-round-complete">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ListRestart className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-foreground">{isAr ? "تم اختيار جميع الطلاب" : "Everyone has been picked"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{isAr ? "ابدأ دورة جديدة مع نفس القائمة" : "Start another round with the same list"}</p>
                  </div>
                  <Button onClick={startNewRound} data-testid="button-start-new-round" className="px-3 py-2 text-xs shrink-0">
                    <RefreshCw className="w-4 h-4" />
                    <span className="ms-1.5">{isAr ? "دورة جديدة" : "New round"}</span>
                  </Button>
                </div>
              </Card>
            )}

            {history.length > 0 && (
              <Card className="p-4 flex-1 min-h-[150px] flex flex-col shadow-sm" data-testid="card-history">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/50">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    {isAr ? "السجل" : "History"}
                  </h3>
                  <button onClick={() => setHistory([])} data-testid="button-clear-history" className="text-[11px] font-bold text-muted-foreground hover:text-destructive transition-colors">
                    {isAr ? "مسح" : "Clear"}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {history.map((h, i) => {
                      const canReturn = noRepeat && pickedIds.has(h.participantId) && !h.returnedToWheel;
                      return (
                      <button
                        key={h.id}
                        type="button"
                        disabled={!canReturn}
                        onClick={() => returnParticipantToWheel(h.participantId, h.id)}
                        data-testid={`row-history-${i}`}
                        className={`flex w-full justify-between items-center text-sm px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-start ${
                          canReturn ? "cursor-pointer hover:border-primary/40 hover:bg-primary/5" : "cursor-default"
                        }`}
                        title={canReturn ? (isAr ? "اضغط لإعادة الاسم إلى العجلة" : "Click to return the name to the wheel") : undefined}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-bold text-foreground">{h.name}</span>
                          {h.returnedToWheel && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              {isAr ? "أُعيد للعجلة" : "Returned"}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded shadow-sm">
                          {h.time.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    );
                    })}
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT: Wheel */}
          <div className="w-full lg:w-2/3 flex flex-col items-center justify-center p-2 sm:p-4 lg:p-8 min-h-[360px]">
            <div className="w-full max-w-[550px] flex items-center justify-between gap-3 mb-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-black" data-testid="text-active-participants-count">
                <Users className="w-4 h-4" />
                {currentParticipants.length} {isAr ? "متاح للدوران" : "ready to spin"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled((v) => !v)}
                  data-testid="button-toggle-wheel-sound"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={isAr ? (soundEnabled ? "كتم الصوت" : "تشغيل الصوت") : (soundEnabled ? "Mute" : "Unmute")}
                  aria-label={isAr ? (soundEnabled ? "كتم الصوت" : "تشغيل الصوت") : (soundEnabled ? "Mute" : "Unmute")}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                {pickedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={startNewRound}
                    data-testid="button-reset-round"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {isAr ? "إعادة الدورة" : "Reset round"}
                  </button>
                )}
              </div>
            </div>
            <div className="relative w-full max-w-[550px] aspect-square mx-auto">
              
              {/* Pointer */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 drop-shadow-xl" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="#F5C842">
                  <path d="M12 22L2 2h20L12 22z" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round"/>
                </svg>
              </div>
              
              {/* The SVG Wheel */}
              <div className="w-full h-full rounded-full overflow-hidden shadow-2xl relative bg-muted/20 border-8 border-white dark:border-muted">
                <svg 
                  viewBox="0 0 400 400" 
                  className="w-full h-full" 
                  style={{ 
                    transform: `rotate(${rotation}deg)`, 
                    transition: "none",
                  }}
                >
                  <circle cx="200" cy="200" r="198" fill="#e2e8f0" className="dark:fill-emerald-950" />
                  
                  {currentParticipants.length > 0 ? (
                    currentParticipants.map((p, i) => {
                      const numSlices = currentParticipants.length;
                      if (numSlices === 1) {
                        return (
                          <g key={i}>
                            <circle cx="200" cy="200" r="198" fill={getSliceColor(0, 1)} />
                            <text x="200" y="200" fill="#fff" fontSize="28" fontWeight="900" textAnchor="middle" alignmentBaseline="middle">{p.name}</text>
                          </g>
                        );
                      }

                      const angle = 360 / numSlices;
                      const startAngle = i * angle;
                      const endAngle = startAngle + angle;
                      const largeArc = angle > 180 ? 1 : 0;
                      
                      const startX = 200 + 198 * Math.cos((startAngle - 90) * Math.PI / 180);
                      const startY = 200 + 198 * Math.sin((startAngle - 90) * Math.PI / 180);
                      const endX = 200 + 198 * Math.cos((endAngle - 90) * Math.PI / 180);
                      const endY = 200 + 198 * Math.sin((endAngle - 90) * Math.PI / 180);
                      
                      const color = getSliceColor(i, numSlices);
                      const pathData = `M 200 200 L ${startX} ${startY} A 198 198 0 ${largeArc} 1 ${endX} ${endY} Z`;
                      
                      const midAngle = startAngle + angle / 2;
                      const textRadius = 125;
                      const textX = 200 + textRadius * Math.cos((midAngle - 90) * Math.PI / 180);
                      const textY = 200 + textRadius * Math.sin((midAngle - 90) * Math.PI / 180);
                      
                      const displayName = numSlices > 40 ? p.name.substring(0, 6) + '..' : (numSlices > 20 ? p.name.substring(0, 12) + '..' : p.name);
                      
                      return (
                        <g key={i}>
                          <path d={pathData} fill={color} stroke="#ffffff" strokeWidth={numSlices > 30 ? "0.5" : "1.5"} strokeOpacity="0.8" />
                          <text 
                            x={textX} 
                            y={textY} 
                            fill="#ffffff" 
                            fontSize={numSlices > 30 ? "10" : numSlices > 15 ? "14" : "18"} 
                            fontWeight="800" 
                            textAnchor="middle" 
                            alignmentBaseline="middle"
                            transform={`rotate(${midAngle - 90} ${textX} ${textY})`}
                            style={{ textShadow: "0px 1px 3px rgba(0,0,0,0.4)" }}
                          >
                            {displayName}
                          </text>
                        </g>
                      );
                    })
                  ) : (
                    <text x="200" y="200" fill="#94a3b8" fontSize="16" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
                      {isAr ? "لا يوجد مشاركين" : "No participants"}
                    </text>
                  )}
                  
                  {/* Center Hub */}
                  <circle cx="200" cy="200" r="30" fill="#ffffff" className="dark:fill-slate-800" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.25))" />
                  <circle cx="200" cy="200" r="18" fill="#225739" />
                  <circle cx="200" cy="200" r="6" fill="#F5C842" />
                </svg>

                {/* Winner Overlay */}
                <AnimatePresence>
                  {showWinner && selectedWinner && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.2 } }}
                      className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    >
                      <motion.div 
                        initial={{ scale: 0.5, y: 20 }}
                        animate={{ scale: 1, y: 0, transition: { type: "spring", damping: 12, stiffness: 100 } }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="bg-background px-8 py-10 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-[85%] border-4"
                        style={{ borderColor: "#F5C842" }}
                      >
                        <span className="text-[11px] font-black text-primary/80 uppercase tracking-widest mb-3 bg-primary/10 px-3 py-1 rounded-full">
                          {isAr ? "تم اختيار" : "SELECTED"}
                        </span>
                        <h2 data-testid="text-selected-student" className="text-3xl sm:text-4xl font-black text-foreground leading-tight mb-8">
                          {selectedWinner.name}
                        </h2>
                        
                        <div className="flex w-full flex-col gap-2">
                          <Button
                            data-testid="button-close-winner"
                            onClick={() => {
                              setShowWinner(false);
                              setSelectedWinner(null);
                            }}
                            className="w-full text-base py-3 shadow-lg shadow-primary/20"
                          >
                            <Check className="me-2 h-4 w-4" />
                            {isAr ? "اعتماد الاختيار" : "Confirm selection"}
                          </Button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Spin Button */}
              <button 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-28 h-28 rounded-full bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 font-black text-2xl sm:text-3xl shadow-2xl border-4 border-emerald-100 dark:border-emerald-900 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center tracking-wide"
                onClick={handleSpin}
                disabled={spinning || currentParticipants.length === 0}
                data-testid="button-spin-wheel"
                style={{ filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.15))" }}
              >
                {spinning ? (isAr ? "يدور" : "SPINNING") : (isAr ? "دوّر" : "SPIN")}
              </button>

            </div>
            {studentsError && mode === "class" && (
              <p className="mt-5 text-sm text-destructive font-bold" data-testid="status-students-error">
                {isAr ? "تعذّر تحميل الطلاب. حدّث الصفحة وحاول مجددًا." : "Students could not be loaded. Refresh and try again."}
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
