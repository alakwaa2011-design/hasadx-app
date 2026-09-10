import { useState, useEffect } from "react";
import { useTimerEngine } from "@/lib/use-timer-engine";
import { timerStore, TimerMode, TimerPresentation } from "@/lib/timer-store";
import { Play, Pause, RotateCcw, Maximize, Volume2, VolumeX, Settings2, Flag, X, Minimize2 } from "lucide-react";
import { formatTime } from "./timer-utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { playTimerSound, initAudioContext } from "@/lib/timer-sounds";

function CircularTimer({ remainingMs, targetMs, isOvertime, timeStr, size = "md" }: { remainingMs: number, targetMs: number, isOvertime: boolean, timeStr: string, size?: "md" | "lg" }) {
  const progress = Math.max(0, Math.min(1, remainingMs / targetMs));
  const textClass = size === "lg" 
    ? "text-[clamp(3.5rem,12vw,7rem)]" 
    : "text-[clamp(2.5rem,12vw,4.5rem)]";

  return (
    <div className="relative w-full aspect-square flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/50" />
        <g className="text-muted-foreground/40">
          {Array.from({ length: 60 }).map((_, i) => (
             <line key={i} x1="50" y1="4" x2="50" y2={i % 5 === 0 ? "9" : "6"} stroke="currentColor" strokeWidth={i % 5 === 0 ? "1" : "0.5"} transform={`rotate(${i * 6} 50 50)`} />
          ))}
        </g>
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
          className={`${isOvertime ? 'text-destructive' : 'text-primary'} transition-colors duration-75`}
          strokeDasharray="289.026"
          strokeDashoffset={289.026 - (289.026 * progress)} 
        />
      </svg>
      <div className={`z-10 flex flex-col items-center justify-center`}>
        <div className={`font-black tabular-nums tracking-tighter leading-none ${isOvertime ? 'text-destructive' : 'text-foreground'} ${textClass}`} dir="ltr">
          {isOvertime ? "+" : ""}{timeStr}
        </div>
      </div>
    </div>
  );
}

function BarTimer({ remainingMs, targetMs, isOvertime, timeStr, isAr, size = "md" }: { remainingMs: number, targetMs: number, isOvertime: boolean, timeStr: string, isAr: boolean, size?: "md" | "lg" }) {
  const progress = Math.max(0, Math.min(1, remainingMs / targetMs));
  const textClass = size === "lg" 
    ? "text-[clamp(4rem,15vw,9rem)]" 
    : "text-[clamp(3rem,10vw,5.5rem)]";
  
  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6">
       <div className={`font-black tabular-nums tracking-tighter text-center ${isOvertime ? 'text-destructive' : 'text-foreground'} ${textClass} leading-none`} dir="ltr">
         {isOvertime ? "+" : ""}{timeStr}
       </div>
       <div className={`relative w-full bg-muted/40 rounded-2xl overflow-hidden border border-border shadow-inner ${size === "lg" ? "h-16 sm:h-20" : "h-10 sm:h-14"}`}>
         <div 
           className={`h-full ${isOvertime ? 'bg-destructive' : 'bg-primary'} transition-colors duration-75`}
           style={{ width: `${progress * 100}%` }}
         />
         <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] bg-[length:24px_24px] pointer-events-none opacity-[0.03]" />
         
         <div className={`absolute inset-0 flex items-center justify-between px-4 sm:px-6 pointer-events-none font-black mix-blend-difference text-white/90 ${size === "lg" ? "text-xl md:text-3xl" : "text-sm sm:text-lg"}`}>
            <span>{isAr ? "الضبط" : "Start"}</span>
            <span className="opacity-50">50%</span>
            <span>{isAr ? "النهاية" : "End"}</span>
         </div>
       </div>
    </div>
  );
}

function LapItem({ lap, index, totalLaps, isAr, updateLapName }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(lap.name);
  
  const handleSave = () => {
    if (editName.trim() && editName !== lap.name) {
      updateLapName(lap.id, editName.trim());
    } else {
      setEditName(lap.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(lap.name);
      setIsEditing(false);
    }
  };

  return (
    <div 
      className="bg-background border border-border rounded-lg p-3 text-sm flex flex-col gap-1 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => { if (!isEditing) setIsEditing(true); }}
    >
       <div className="flex justify-between items-center text-xs font-bold gap-2">
         <div className="flex items-center gap-2 flex-1 min-w-0">
           <span className="text-muted-foreground shrink-0">#{totalLaps - index}</span>
           {isEditing ? (
             <Input 
               autoFocus
               value={editName}
               onChange={(e) => setEditName(e.target.value)}
               onBlur={handleSave}
               onKeyDown={handleKeyDown}
               className="h-6 text-xs w-full max-w-[150px] px-2 py-0 m-0 focus-visible:ring-1 focus-visible:ring-primary"
               onClick={(e) => e.stopPropagation()}
             />
           ) : (
             <span className="text-foreground truncate flex-1" title={lap.name}>{lap.name}</span>
           )}
         </div>
         <span className="text-foreground font-mono shrink-0" dir="ltr">{formatTime(lap.totalMs, true)}</span>
       </div>
       <div className="flex justify-between items-center text-xs">
         <span className="text-muted-foreground">{isAr ? "المدة:" : "Split:"}</span>
         <span className="font-mono text-muted-foreground" dir="ltr">{formatTime(lap.splitMs, true)}</span>
       </div>
    </div>
  );
}

export function TimerWidgetCore({ isFullPage = false }: { isFullPage?: boolean }) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const { 
    state, elapsedMs, remainingMs, isOvertime, 
    start, pause, reset, setMode, setTarget, addTime, addLap, updateLapName 
  } = useTimerEngine();
  
  const [setupMode, setSetupMode] = useState(false);
  const [tempHours, setTempHours] = useState(0);
  const [tempMinutes, setTempMinutes] = useState(5);
  const [tempSeconds, setTempSeconds] = useState(0);
  const [lapNameInput, setLapNameInput] = useState("");

  const displayMs = state.mode === "countdown" ? remainingMs : elapsedMs;
  const timeStr = formatTime(displayMs, state.mode === "stopwatch");
  
  const handleStartSetup = () => {
    setSetupMode(true);
    const totalS = Math.floor(state.targetMs / 1000);
    setTempHours(Math.floor(totalS / 3600));
    setTempMinutes(Math.floor((totalS % 3600) / 60));
    setTempSeconds(totalS % 60);
  };

  const handleApplySetup = () => {
    const ms = (tempHours * 3600 + tempMinutes * 60 + tempSeconds) * 1000;
    setTarget(ms > 0 ? ms : 60000);
    setSetupMode(false);
  };
  
  const applyPreset = (m: number) => {
    setTarget(m * 60 * 1000);
    setSetupMode(false);
  };
  
  const handleStudentDisplay = () => {
    timerStore.setState({ studentDisplayActive: true });
    // Attempt fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // Just fail silently on fullscreen rejection
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && state.studentDisplayActive) {
        timerStore.setState({ studentDisplayActive: false });
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.studentDisplayActive) {
        timerStore.setState({ studentDisplayActive: false });
      }
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [state.studentDisplayActive]);

  // Student Display Mode overlay
  if (state.studentDisplayActive) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center p-4 sm:p-8 overflow-hidden" style={{ direction: isAr ? "rtl" : "ltr" }}>
        
        {state.taskName && (
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mt-4 mb-8 text-center max-w-4xl opacity-90 text-balance px-4 shrink-0" style={{ lineHeight: 1.2 }}>
            {state.taskName}
          </h2>
        )}
        
        {/* Progress Visuals */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl mb-32 px-4 min-h-0">
          {state.mode === "countdown" && state.presentation === "circular" && (
             <div className="w-full max-w-[280px] sm:max-w-[400px] md:max-w-[500px]">
               <CircularTimer remainingMs={remainingMs} targetMs={state.targetMs} isOvertime={isOvertime} timeStr={timeStr} size="lg" />
             </div>
          )}
          
          {(state.mode === "stopwatch" || state.presentation === "digital") && (
            <div className={`font-black tabular-nums tracking-tighter ${isOvertime ? 'text-destructive' : 'text-foreground'} text-[clamp(5rem,20vw,14rem)] leading-none`} dir="ltr">
              {isOvertime ? "+" : ""}{timeStr}
            </div>
          )}
          
          {state.mode === "countdown" && state.presentation === "bar" && (
            <div className="w-full max-w-4xl">
              <BarTimer remainingMs={remainingMs} targetMs={state.targetMs} isOvertime={isOvertime} timeStr={timeStr} isAr={isAr} size="lg" />
            </div>
          )}
        </div>

        {/* Floating Controls at bottom */}
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-6 z-50 px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { initAudioContext(); state.isRunning ? pause() : start(); }}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
            >
              {state.isRunning ? <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-current" /> : <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-2 rtl:mr-2 rtl:ml-0" />}
            </button>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
            <Button 
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(()=>{});
                } else {
                  timerStore.setState({ studentDisplayActive: false });
                }
              }}
              variant="secondary"
              className="rounded-full shadow-lg h-12 px-6 font-bold text-sm sm:text-base flex-1 sm:flex-none whitespace-nowrap"
            >
              <Minimize2 className="w-4 h-4 ml-2 rtl:mr-2 rtl:ml-0" />
              {isAr ? "تصغير / عودة" : "Minimize / Return"}
            </Button>

            <Button 
              onClick={() => {
                timerStore.setState({ studentDisplayActive: false });
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(()=>{});
                }
              }}
              variant="destructive"
              className="rounded-full shadow-lg h-12 px-6 font-bold text-sm sm:text-base flex-1 sm:flex-none whitespace-nowrap"
            >
              <X className="w-4 h-4 ml-2 rtl:mr-2 rtl:ml-0" />
              {isAr ? "إنهاء العرض" : "End Display"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Normal Page View
  return (
    <div className="flex flex-col h-full" style={{ direction: isAr ? "rtl" : "ltr" }}>
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <Tabs value={state.mode} onValueChange={(v) => setMode(v as TimerMode)} className="w-full sm:w-[300px]">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="countdown" className="text-base font-bold">{isAr ? "مؤقت تنازلي" : "Countdown"}</TabsTrigger>
            <TabsTrigger value="stopwatch" className="text-base font-bold">{isAr ? "ساعة إيقاف" : "Stopwatch"}</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Button variant="outline" size="lg" onClick={handleStudentDisplay} className="w-full sm:w-auto gap-2 font-bold rounded-full">
          <Maximize className="w-4 h-4" />
          {isAr ? "شاشة الطالب" : "Student Display"}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1">
        {/* Left Column: Timer Display */}
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 rounded-3xl p-4 sm:p-8 border border-border w-full overflow-hidden">
          {setupMode && state.mode === "countdown" ? (
            <div className="flex flex-col items-center gap-8 w-full max-w-sm">
              <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-4 text-3xl md:text-5xl font-black w-full" dir="ltr">
                <div className="flex flex-col items-center">
                  <input 
                    type="number" value={tempHours}
                    onChange={(e) => setTempHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-12 sm:w-16 md:w-20 bg-transparent text-center border-b-4 border-transparent hover:border-primary/30 focus:border-primary focus:outline-none transition-colors"
                    min="0"
                  />
                  <span className="text-xs sm:text-sm font-bold text-muted-foreground mt-2">{isAr ? "ساعة" : "h"}</span>
                </div>
                <span className="mb-6 sm:mb-8">:</span>
                <div className="flex flex-col items-center">
                  <input 
                    type="number" value={tempMinutes}
                    onChange={(e) => setTempMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-12 sm:w-16 md:w-20 bg-transparent text-center border-b-4 border-transparent hover:border-primary/30 focus:border-primary focus:outline-none transition-colors"
                    min="0"
                  />
                  <span className="text-xs sm:text-sm font-bold text-muted-foreground mt-2">{isAr ? "دقيقة" : "m"}</span>
                </div>
                <span className="mb-6 sm:mb-8">:</span>
                <div className="flex flex-col items-center">
                  <input 
                    type="number" value={tempSeconds}
                    onChange={(e) => setTempSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-12 sm:w-16 md:w-20 bg-transparent text-center border-b-4 border-transparent hover:border-primary/30 focus:border-primary focus:outline-none transition-colors"
                    min="0"
                  />
                  <span className="text-xs sm:text-sm font-bold text-muted-foreground mt-2">{isAr ? "ثانية" : "s"}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {[1, 5, 10, 15, 30].map(m => (
                  <Button key={m} variant="secondary" onClick={() => applyPreset(m)} className="rounded-full font-bold">
                    {m} {isAr ? "د" : "m"}
                  </Button>
                ))}
              </div>

              <Button size="lg" onClick={handleApplySetup} className="rounded-full px-12 text-lg font-bold w-full max-w-[200px] mt-4">
                {isAr ? "تطبيق" : "Apply"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              <div className="w-full max-w-md flex flex-col items-center justify-center mb-8">
                {state.mode === "countdown" && state.presentation === "circular" && (
                   <div className="w-full max-w-[280px] sm:max-w-[320px]">
                     <CircularTimer remainingMs={remainingMs} targetMs={state.targetMs} isOvertime={isOvertime} timeStr={timeStr} size="md" />
                   </div>
                )}
                
                {state.mode === "countdown" && state.presentation === "bar" && (
                   <BarTimer remainingMs={remainingMs} targetMs={state.targetMs} isOvertime={isOvertime} timeStr={timeStr} isAr={isAr} size="md" />
                )}

                {(state.mode === "stopwatch" || (state.mode === "countdown" && state.presentation === "digital")) && (
                   <div className={`py-8 sm:py-12 text-[15vw] sm:text-7xl lg:text-8xl font-black tabular-nums tracking-tighter ${isOvertime ? 'text-destructive' : 'text-foreground'}`} dir="ltr">
                     {isOvertime ? "+" : ""}{timeStr}
                   </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {state.mode === "countdown" && !state.isRunning && remainingMs === state.targetMs && (
                  <Button variant="outline" size="icon" className="w-14 h-14 rounded-full" onClick={handleStartSetup} title={isAr ? "إعداد الوقت" : "Setup Time"} aria-label={isAr ? "إعداد الوقت" : "Setup Time"}>
                    <Settings2 className="w-6 h-6" />
                  </Button>
                )}
                
                <Button 
                  onClick={() => { initAudioContext(); state.isRunning ? pause() : start(); }}
                  className="w-20 h-20 rounded-full [&_svg]:w-10 [&_svg]:h-10 transition-transform hover:scale-105"
                  title={state.isRunning ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "تشغيل" : "Play")}
                  aria-label={state.isRunning ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "تشغيل" : "Play")}
                >
                  {state.isRunning ? <Pause className="fill-current" /> : <Play className="fill-current ml-1 rtl:mr-1 rtl:ml-0" />}
                </Button>
                
                <Button variant="outline" size="icon" className="w-14 h-14 rounded-full" onClick={reset} title={isAr ? "إعادة ضبط" : "Reset"} aria-label={isAr ? "إعادة ضبط" : "Reset"}>
                  <RotateCcw className="w-6 h-6" />
                </Button>
              </div>

              {state.mode === "countdown" && state.isRunning && (
                <div className="flex gap-2 mt-6">
                  <Button variant="secondary" onClick={() => addTime(60000)} className="rounded-full font-bold">
                    {isAr ? "+1 دقيقة" : "+1m"}
                  </Button>
                  <Button variant="secondary" onClick={() => addTime(5 * 60000)} className="rounded-full font-bold">
                    {isAr ? "+5 دقائق" : "+5m"}
                  </Button>
                </div>
              )}

              {state.mode === "stopwatch" && state.isRunning && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <Button onClick={() => { addLap(lapNameInput); setLapNameInput(""); }} variant="secondary" className="rounded-full px-6 font-bold gap-2">
                    <Flag className="w-4 h-4" />
                    {isAr ? "تسجيل جولة" : "Lap"}
                  </Button>
                  <Input 
                    value={lapNameInput}
                    onChange={(e) => setLapNameInput(e.target.value)}
                    placeholder={isAr ? "اسم الجولة/المجموعة (اختياري)" : "Lap/Group name (optional)"}
                    className="w-full max-w-[16rem] text-center rounded-full h-9 text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Settings & Laps */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
          <div className="bg-muted/30 p-5 rounded-2xl border border-border">
            <Label className="text-sm font-bold mb-3 block">{isAr ? "اسم المهمة (اختياري)" : "Task Name (optional)"}</Label>
            <Input 
              value={state.taskName} 
              onChange={(e) => timerStore.setState({ taskName: e.target.value })} 
              placeholder={isAr ? "مثال: القراءة الصامتة" : "e.g. Silent Reading"}
              className="bg-background"
            />
          </div>

          {state.mode === "countdown" && (
             <div className="bg-muted/30 p-5 rounded-2xl border border-border flex flex-col gap-5">
                <div>
                  <Label className="text-sm font-bold mb-3 block">{isAr ? "شكل العرض" : "Presentation"}</Label>
                  <div className="flex bg-background rounded-lg p-1 border border-border">
                    {(["digital", "circular", "bar"] as TimerPresentation[]).map(p => (
                      <button
                        key={p}
                        onClick={() => timerStore.setState({ presentation: p })}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${state.presentation === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        {isAr ? (p==='digital'?'رقمي':p==='circular'?'دائري':'شريط') : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">{isAr ? "السماح بوقت إضافي" : "Allow overtime"}</Label>
                  <Switch 
                    checked={state.overtimeEnabled} 
                    onCheckedChange={(c) => timerStore.setState({ overtimeEnabled: c })} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">{isAr ? "إشعار المتصفح" : "Browser Notify"}</Label>
                  <Switch 
                    checked={state.notifyBrowser} 
                    onCheckedChange={(c) => {
                      if (c && "Notification" in window && Notification.permission !== "granted") {
                        Notification.requestPermission().then(p => {
                          if (p === "granted") timerStore.setState({ notifyBrowser: true });
                        });
                      } else {
                        timerStore.setState({ notifyBrowser: c });
                      }
                    }} 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-bold">{isAr ? "صوت الانتهاء" : "Completion Sound"}</Label>
                    <button onClick={() => timerStore.setState({ soundMuted: !state.soundMuted })} className="text-muted-foreground hover:text-foreground">
                      {state.soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <select 
                      value={state.soundSelection}
                      onChange={(e) => timerStore.setState({ soundSelection: e.target.value })}
                      className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="bell">{isAr ? "جرس كلاسيكي" : "Classic Bell"}</option>
                      <option value="chime">{isAr ? "رنين ناعم" : "Soft Chime"}</option>
                      <option value="gong">{isAr ? "قرع عميق" : "Deep Gong"}</option>
                    </select>
                    <Button variant="outline" size="icon" onClick={() => playTimerSound(state.soundSelection, state.soundVolume)} className="shrink-0" disabled={state.soundMuted} title={isAr ? "تجربة الصوت" : "Test sound"} aria-label={isAr ? "تجربة الصوت" : "Test sound"}>
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                  <Slider 
                    value={[state.soundVolume * 100]} 
                    min={10} max={100} step={10} 
                    onValueChange={(v) => timerStore.setState({ soundVolume: v[0] / 100 })}
                    disabled={state.soundMuted}
                  />
                </div>
             </div>
          )}

          {state.mode === "stopwatch" && state.laps.length > 0 && (
             <div className="bg-muted/30 p-5 rounded-2xl border border-border flex-1 overflow-hidden flex flex-col">
                <Label className="text-sm font-bold mb-3 flex items-center justify-between">
                  <span>{isAr ? "الجولات" : "Laps"}</span>
                  <span className="text-xs text-muted-foreground font-normal">{state.laps.length}</span>
                </Label>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {state.laps.map((lap, i) => (
                    <LapItem 
                      key={lap.id} 
                      lap={lap} 
                      index={i} 
                      totalLaps={state.laps.length} 
                      isAr={isAr} 
                      updateLapName={updateLapName} 
                    />
                  ))}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
