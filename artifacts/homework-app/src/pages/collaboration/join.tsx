import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { useGetCollaborationJoinInfo, getGetCollaborationJoinInfoQueryKey, useJoinCollaborationBoard } from "@workspace/api-client-react";
import { errMessage, saveSession, loadSession } from "@/lib/collab";
import { inputCls, btnPrimary, GREEN, GOLD } from "@/components/collab/parts";

export default function CollaborationJoin() {
  const params = useParams<{ pin?: string }>();
  const [, nav] = useLocation();
  const [code, setCode] = useState(params.pin ?? "");
  const [pin, setPin] = useState(params.pin ?? "");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const info = useGetCollaborationJoinInfo(pin, { query: { queryKey: getGetCollaborationJoinInfoQueryKey(pin), enabled: pin.length >= 4, retry: false } });
  const join = useJoinCollaborationBoard();
  const board = info.data;
  const existing = board ? loadSession(board.id) : null;
  const go = async () => {
    if (!board) return;
    setErr(null);
    try {
      const r = await join.mutateAsync({ pin, data: { name: name.trim() } });
      saveSession(r.id, { token: r.token, participantId: r.participantId, name: r.name });
      nav(`/collaboration/board/${r.id}`);
    } catch (e) { setErr(errMessage(e)); }
  };
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4" dir="rtl" style={{ background: "linear-gradient(160deg,#173a28,#1E4D35 60%,#2f684d)" }}>
      <div className="w-full max-w-sm rounded-2xl bg-[#fbf8f0] p-5 shadow-2xl">
        <div className="text-center mb-4">
          <div className="font-black text-lg" style={{ color: GOLD }}>حصاد</div>
          <h1 className="text-xl font-black" style={{ color: GREEN }}>انضم إلى لوحة الصف</h1>
        </div>
        {!board ? (
          <form onSubmit={(e) => { e.preventDefault(); setPin(code.trim()); }}>
            <input className={`${inputCls} text-center text-xl font-black tracking-[0.3em]`} dir="ltr" value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} placeholder="رمز اللوحة" data-testid="input-pin" />
            {info.isError && pin && <p role="alert" className="text-sm text-rose-700 mt-2 text-center">{errMessage(info.error)}</p>}
            <button className={`${btnPrimary} w-full mt-3`} style={{ background: GREEN }} disabled={code.trim().length < 4 || info.isFetching}>{info.isFetching && <Loader2 className="w-4 h-4 animate-spin" />} متابعة</button>
          </form>
        ) : (
          <div>
            <div className="rounded-xl bg-white border border-border p-3 mb-3"><div className="font-extrabold">{board.title}</div><div className="text-xs text-muted-foreground mt-1">{board.prompt}</div></div>
            {existing && <button className={`${btnPrimary} w-full mb-3`} style={{ background: GOLD, color: "#12301f" }} onClick={() => nav(`/collaboration/board/${board.id}`)}>المتابعة باسم {existing.name}</button>}
            {board.status === "open" ? (
              <form onSubmit={(e) => { e.preventDefault(); void go(); }}>
                <input className={inputCls} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك" autoFocus data-testid="input-name" />
                {err && <p role="alert" className="text-sm text-rose-700 mt-2">{err}</p>}
                <button className={`${btnPrimary} w-full mt-3`} style={{ background: GREEN }} disabled={!name.trim() || join.isPending} data-testid="button-join">{join.isPending && <Loader2 className="w-4 h-4 animate-spin" />} دخول</button>
              </form>
            ) : <p className="text-sm text-center text-amber-800 bg-amber-100 rounded-lg p-3">هذه اللوحة غير مفتوحة للانضمام حالياً.</p>}
            <button className="block mx-auto mt-3 text-xs text-muted-foreground underline min-h-0" onClick={() => { setPin(""); setCode(""); }}>إدخال رمز آخر</button>
          </div>
        )}
      </div>
    </div>
  );
}
