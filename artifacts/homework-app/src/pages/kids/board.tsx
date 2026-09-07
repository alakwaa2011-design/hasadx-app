import React, { useState } from "react";
import { Radio, CheckCircle2, Play } from "lucide-react";
import { useLocation } from "wouter";
import { useKidsBoardEvent, useKidsBoardJoin } from "@/hooks/use-kids";

export default function KidsBoard() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [board, setBoard] = useState<{ id: string; title: string; activityId: string; activityTitle: string } | null>(null);
  const join = useKidsBoardJoin();
  const sendEvent = useKidsBoardEvent();

  const joinBoard = () => join.mutate(code, {
    onSuccess: ({ board: joined }) => {
      const active = { id: String(joined.id), title: joined.title, activityId: String(joined.activity_id), activityTitle: joined.activity_title };
      setBoard(active);
      sendEvent.mutate({ boardId: active.id, eventType: "joined" });
    },
  });

  if (board) return (
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
      <Radio className="mx-auto h-14 w-14 text-sky-600" />
      <h2 className="mt-4 text-2xl font-bold">{board.title}</h2>
      <p className="mt-2 text-slate-500">نشاط اليوم: <strong className="text-slate-800">{board.activityTitle}</strong></p>
      <button
        onClick={() => {
          sendEvent.mutate({ boardId: board.id, eventType: "ready" });
          setLocation(`/kids/activity/${board.activityId}`);
        }}
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-600 p-5 text-xl font-bold text-white"
      >
        <Play className="h-6 w-6 fill-current" /> ابدأ النشاط
      </button>
      {sendEvent.isSuccess && <p className="mt-5 flex items-center justify-center gap-2 font-bold text-emerald-700"><CheckCircle2 /> وصل ردك للمعلمة</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
      <Radio className="mx-auto h-14 w-14 text-sky-600" />
      <h2 className="mt-4 text-2xl font-bold">لوحة المعلمة</h2>
      <p className="mt-2 text-slate-500">اكتب الرمز المكوّن من 6 أرقام.</p>
      <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className="mt-6 w-full rounded-2xl border-2 border-sky-200 p-4 text-center text-3xl font-bold tracking-[0.4em]" placeholder="000000" />
      <button onClick={joinBoard} disabled={code.length !== 6 || join.isPending} className="mt-5 w-full rounded-2xl bg-sky-600 p-4 text-xl font-bold text-white disabled:opacity-50">انضم</button>
      {join.isError && <p className="mt-4 font-bold text-red-600">تحقق من الرمز وحاول مرة أخرى.</p>}
    </div>
  );
}