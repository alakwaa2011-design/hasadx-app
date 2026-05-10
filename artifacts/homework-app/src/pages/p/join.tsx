import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";
const KEY = "hasad:presKey";

interface Stored { sessionId: number; studentKey: string; name: string; joinToken: string }

interface PinInfo {
  sessionId: number;
  mode: "class" | "guest";
  classRoster: { id: number; name: string }[] | null;
  language: "ar" | "en";
}

function loadStored(): Stored | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

/* Student PIN entry then name (or roster) selection. The PIN gates a
   public info lookup that tells us whether the session is class- or
   guest-mode, so the second step renders a roster picker in class
   mode and free-text input in guest mode. The deck language travels
   with the PIN-info response so the screen can render in AR or EN
   before the student authenticates. */
export default function PresentationJoin() {
  const [, setLocation] = useLocation();
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [info, setInfo] = useState<PinInfo | null>(null);
  const [pickedStudentId, setPickedStudentId] = useState<number | null>(null);
  const [step, setStep] = useState<"pin" | "name">("pin");
  const [busy, setBusy] = useState(false);

  /* Until we know the deck language we render in Arabic (the platform
     default). Once `info` arrives we flip per the deck. */
  const isAr = info ? info.language !== "en" : true;
  const dir = isAr ? "rtl" : "ltr";

  useEffect(() => {
    const stored = loadStored();
    const m = window.location.hash.match(/pin=(\d{6})/);
    /* If a fresh QR scan brings us in with `#pin=NEW`, the new PIN is
       always the source of truth — even if we previously joined a
       different session. Resolve the PIN to a session id first; if it
       differs from what we have in storage, drop the stale entry so
       the student joins the new session cleanly. Without this, the
       saved-session redirect below would silently send them back to
       the OLD session every scan. */
    if (m) {
      const freshPin = m[1];
      setPin(freshPin);
      (async () => {
        try {
          const r = await fetch(`${API_BASE}/api/p/by-pin/${freshPin}/info`);
          if (r.ok) {
            const j = (await r.json()) as PinInfo;
            if (stored?.sessionId && stored.sessionId !== j.sessionId) {
              try { localStorage.removeItem(KEY); } catch { /* ignore */ }
            } else if (stored?.sessionId === j.sessionId && stored.studentKey) {
              /* Same session as last time — auto-resume directly into
                 play instead of reasking for the name. */
              setLocation(`/p/play/${stored.sessionId}`);
              return;
            }
          }
        } catch { /* network errors fall through to manual flow */ }
        void submitPin(freshPin);
      })();
      return;
    }
    /* No fresh PIN in the URL — keep the existing auto-resume so a
       student who briefly closed their browser doesn't have to scan
       the QR again. */
    if (stored?.sessionId && stored.studentKey) {
      setLocation(`/p/play/${stored.sessionId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLocation]);

  async function submitPin(pinArg?: string) {
    const p = pinArg ?? pin;
    if (!/^\d{6}$/.test(p)) {
      toast.error(isAr ? "PIN من 6 أرقام" : "PIN must be 6 digits");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/p/by-pin/${p}/info`);
      const j = await r.json();
      if (!r.ok) {
        /* Server validation messages are Arabic-only; only surface
           them when we're in Arabic mode to avoid leaking AR text
           into the EN flow. */
        const fallback = isAr ? "تعذّر العثور على الجلسة" : "Session not found";
        toast.error(isAr ? (j?.message ?? fallback) : fallback);
        return;
      }
      setInfo(j as PinInfo);
      setStep("name");
    } catch {
      toast.error(isAr ? "خطأ في الشبكة" : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function submitName() {
    if (!info) return;
    const isClass = info.mode === "class";
    if (isClass && !pickedStudentId) {
      toast.error(isAr ? "اختر اسمك من القائمة" : "Pick your name from the list");
      return;
    }
    if (!isClass && !name.trim()) {
      toast.error(isAr ? "الاسم مطلوب" : "Name is required");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { pin };
      if (isClass) {
        body.classStudentId = pickedStudentId;
        const picked = info.classRoster?.find((s) => s.id === pickedStudentId);
        body.name = picked?.name ?? "";
      } else {
        body.name = name.trim();
      }
      const r = await fetch(`${API_BASE}/api/p/sessions/by-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        const fallback = isAr ? "تعذّر الانضمام" : "Could not join";
        toast.error(isAr ? (j?.message ?? fallback) : fallback);
        return;
      }
      const stored: Stored = { sessionId: j.sessionId, studentKey: j.studentKey, name: j.name, joinToken: j.joinToken };
      localStorage.setItem(KEY, JSON.stringify(stored));
      setLocation(`/p/play/${j.sessionId}`);
    } catch {
      toast.error(isAr ? "خطأ في الشبكة" : "Network error");
    } finally {
      setBusy(false);
    }
  }

  const isClass = info?.mode === "class";

  const title = isAr ? "الانضمام للعرض المباشر" : "Join the live presentation";
  const helper =
    step === "pin"
      ? (isAr ? "أدخل الرمز المعروض على الشاشة" : "Enter the code shown on screen")
      : isClass
        ? (isAr ? "اختر اسمك من قائمة الفصل" : "Pick your name from the class list")
        : (isAr ? "ما اسمك؟" : "What's your name?");
  const continueLabel = isAr ? "متابعة" : "Continue";
  const enterLabel = isAr ? "ادخل" : "Enter";
  const changePinLabel = isAr ? "تغيير الرمز" : "Change PIN";
  const namePlaceholder = isAr ? "اسمك" : "Your name";
  const emptyRosterLabel = isAr ? "لا يوجد طلاب في هذا الفصل" : "No students in this class";

  return (
    <div dir={dir} className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#225739,#143523)" }}>
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6">
        <h1 className="text-2xl font-black text-center mb-1" style={{ color: "#225739" }}>{title}</h1>
        <p className="text-center text-sm text-slate-500 mb-6">{helper}</p>

        {step === "pin" && (
          <>
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-4xl font-black tracking-[0.4em] tabular-nums h-16"
              placeholder="000000"
            />
            <Button onClick={() => submitPin()} disabled={busy} className="w-full mt-4 h-12 text-lg" style={{ background: "#D9A521", color: "#1c1003" }}>
              {busy ? "..." : continueLabel}
            </Button>
          </>
        )}

        {step === "name" && isClass && (
          <>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y">
              {(info?.classRoster ?? []).length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">{emptyRosterLabel}</div>
              ) : (
                info!.classRoster!.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPickedStudentId(s.id)}
                    className={`w-full text-start px-4 py-3 text-base hover:bg-emerald-50 ${pickedStudentId === s.id ? "bg-emerald-100 font-bold" : ""}`}
                  >
                    {s.name}
                  </button>
                ))
              )}
            </div>
            <Button onClick={submitName} disabled={busy || !pickedStudentId} className="w-full mt-4 h-12 text-lg" style={{ background: "#225739" }}>
              {busy ? "..." : enterLabel}
            </Button>
            <button onClick={() => { setStep("pin"); setInfo(null); setPickedStudentId(null); }} className="w-full mt-2 text-sm text-slate-500 underline">
              {changePinLabel}
            </button>
          </>
        )}

        {step === "name" && !isClass && (
          <>
            <Input
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-center text-xl h-12"
              placeholder={namePlaceholder}
            />
            <Button onClick={submitName} disabled={busy} className="w-full mt-4 h-12 text-lg" style={{ background: "#225739" }}>
              {busy ? "..." : enterLabel}
            </Button>
            <button onClick={() => { setStep("pin"); setInfo(null); }} className="w-full mt-2 text-sm text-slate-500 underline">
              {changePinLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
