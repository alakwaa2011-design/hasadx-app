import { useState, useRef, useEffect } from "react";
import { useTimerEngine } from "@/lib/use-timer-engine";
import { timerStore, TimerMode, TimerPresentation } from "@/lib/timer-store";
import { Play, Pause, RotateCcw, Maximize, BellRing, Volume2, VolumeX, Plus, Settings2, Check, Flag } from "lucide-react";
import { formatTime } from "./timer-utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { playTimerSound, initAudioContext } from "@/lib/timer-sounds";

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
        // If fullscreen is rejected (e.g. not a user gesture or not supported in iframe)
        timerStore.setState({ studentDisplayActive: false });
        if (typeof alert !== "undefined") {
          alert(isAr ? "لم نتمكن من فتح وضع ملء الشاشة. يرجى المحاولة مرة أخرى." : "Could not open fullscreen mode. Please try again.");
        }
      });
    } else {
      timerStore.setState({ studentDisplayActive: false });
      if (typeof alert !== "undefined") {
        alert(isAr ? "متصفحك لا يدعم وضع ملء الشاشة." : "Your browser does not support fullscreen mode.");
      }
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
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8">
        <button 
          onClick={() => {
            timerStore.setState({ studentDisplayActive: false });
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(()=>{});
            }
          }}
          className="absolute top-6 end-6 px-6 py-3 bg-muted text-foreground rounded-full font-bold hover:bg-muted/80 transition-colors"
        >
          {isAr ? "إنهاء العرض" : "Exit Display"}
        </button>
        
        {state.taskName && (
          <h2 className="text-4xl md:text-6xl font-black text-foreground mb-12 text-center max-w-4xl opacity-80">
            {state.taskName}
          </h2>
        )}
        
        {/* Progress Visuals based on presentation */}
        {state.mode === "countdown" && state.presentation === "circular" && (
           <div className="relative w-64 h-64 md:w-96 md:h-96 mb-12">
             <svg className="w-full h-full transform -rotate-90 pointer-events-none">
               <circle cx="50%" cy="50%" r="45%" fill="none" stroke="currentColor" strokeWidth="4%" className="text-muted" />
               <circle cx="50%" cy="50%" r="45%" fill="none" stroke="currentColor" strokeWidth="4%" 
                 className={`${isOvertime ? 'text-red-500' : 'text-primary'} transition-all duration-1000 ease-linear`}
                 strokeDasharray="283" 
                 strokeDashoffset={283 - (283 * (Math.max(0, remainingMs) / state.targetMs))} 
                 pathLength="283"
               />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center">
                <div className={`text-6xl md:text-8xl font-black tabular-nums ${isOvertime ? 'text-red-500' : 'text-foreground'}`}>
                  {isOvertime ? "+" : ""}{timeStr}
                </div>
             </div>
           </div>
        )}
        
        {(state.mode === "stopwatch" || state.presentation === "digital") && (
          <div className={`text-[15vw] leading-none font-black tabular-nums tracking-tighter mb-12 ${isOvertime ? 'text-red-500' : 'text-foreground'}`}>
            {isOvertime ? "+" : ""}{timeStr}
          </div>
        )}
        
        {state.mode === "countdown" && state.presentation === "bar" && (
          <div className="w-full max-w-3xl mb-12">
            <div className={`text-8xl md:text-9xl font-black tabular-nums tracking-tighter text-center mb-8 ${isOvertime ? 'text-red-500' : 'text-foreground'}`}>
              {isOvertime ? "+" : ""}{timeStr}
            </div>
            <div className="h-8 md:h-12 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${isOvertime ? 'bg-red-500' : 'bg-primary'} transition-all duration-1000 ease-linear`}
                style={{ width: `${Math.max(0, (remainingMs / state.targetMs) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={() => { initAudioContext(); state.isRunning ? pause() : start(); }}
            className="w-20 h-20 md:w-24 md:h-24 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:scale-105 transition-transform"
          >
            {state.isRunning ? <Pause className="w-10 h-10 md:w-12 md:h-12 fill-current" /> : <Play className="w-10 h-10 md:w-12 md:h-12 fill-current ml-2" />}
          </button>
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
              <div className="relative flex items-center justify-center mb-8 w-full max-w-md">
                {state.mode === "countdown" && state.presentation === "circular" && (
                   <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                     <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                     <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" 
                       className={`${isOvertime ? 'text-red-500' : 'text-primary'} transition-all duration-1000 ease-linear`}
                       strokeDasharray="283" 
                       strokeDashoffset={283 - (283 * (Math.max(0, remainingMs) / state.targetMs))} 
                     />
                   </svg>
                )}
                
                <div className={`py-12 text-[15vw] sm:text-7xl lg:text-8xl font-black tabular-nums tracking-tighter ${isOvertime ? 'text-red-500' : 'text-foreground'}`}>
                  {isOvertime ? "+" : ""}{timeStr}
                </div>
              </div>
              
              {state.mode === "countdown" && state.presentation === "bar" && (
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden mb-8 max-w-md">
                  <div 
                    className={`h-full ${isOvertime ? 'bg-red-500' : 'bg-primary'} transition-all duration-1000 ease-linear`}
                    style={{ width: `${Math.max(0, (remainingMs / state.targetMs) * 100)}%` }}
                  />
                </div>
              )}

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
                  {state.isRunning ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
                </Button>
                
                <Button variant="outline" size="icon" className="w-14 h-14 rounded-full" onClick={reset} title={isAr ? "إعادة ضبط" : "Reset"} aria-label={isAr ? "إعادة ضبط" : "Reset"}>
                  <RotateCcw className="w-6 h-6" />
                </Button>
              </div>

              {state.mode === "countdown" && state.isRunning && (
                <div className="flex gap-2 mt-6">
                  <Button variant="secondary" onClick={() => addTime(60000)} className="rounded-full font-bold">+1m</Button>
                  <Button variant="secondary" onClick={() => addTime(5 * 60000)} className="rounded-full font-bold">+5m</Button>
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
                  <Label className="text-sm font-bold">{isAr ? "إشعار المتصفح / اهتزاز" : "Browser Notify / Vibrate"}</Label>
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
                    <div key={lap.id} className="bg-background border border-border rounded-lg p-3 text-sm flex flex-col gap-1">
                       <div className="flex justify-between items-center text-xs text-muted-foreground font-bold">
                         <span>#{state.laps.length - i} {lap.name}</span>
                         <span className="text-foreground">{formatTime(lap.totalMs, true)}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs">
                         <span>{isAr ? "المدة:" : "Split:"}</span>
                         <span className="font-mono">{formatTime(lap.splitMs, true)}</span>
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
