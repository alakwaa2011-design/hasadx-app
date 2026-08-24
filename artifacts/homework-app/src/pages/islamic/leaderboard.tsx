import { useEffect, useState } from "react";
import { api, IslamicShell, IslamicCard, BackLink, ISLAMIC_GOLD } from "./_shared";
import { useI18n } from "@/lib/i18n";

type Period = "daily" | "weekly" | "monthly" | "all";

export default function IslamicLeaderboard() {
  const { t } = useI18n();
  const [board, setBoard] = useState<"points" | "active">("points");
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<{ top: Array<Record<string, unknown>>; me: Record<string, unknown> | null } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<typeof data>(`/islamic/leaderboard?board=${board}&period=${period}`).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [board, period]);

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? ISLAMIC_GOLD : "rgba(254,252,232,0.3)"}`,
    background: active ? ISLAMIC_GOLD : "transparent",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
  });

  function shareWhatsapp() {
    if (!data?.me) return;
    const meName = (data.me as { name?: string }).name || "—";
    const points = (data.me as { points?: number; questions?: number }).points ?? (data.me as { questions?: number }).questions ?? 0;
    const message = t.islamic.basic === "Basic"
      ? `I am ${meName} on the Hasad challenge leaderboard with ${points} points!`
      : `أنا ${meName} في لوحة متصدرين مسابقات حصاد بـ ${points} نقطة!`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  return (
    <IslamicShell title={t.islamic.leaderboards}>
      <BackLink />
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setBoard("points")} style={pillStyle(board === "points")}>{t.islamic.topPoints}</button>
        <button onClick={() => setBoard("active")} style={pillStyle(board === "active")}>{t.islamic.mostActive}</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(["daily", "weekly", "monthly", "all"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={pillStyle(period === p)}>
            {p === "daily" ? t.islamic.daily : p === "weekly" ? t.islamic.weekly : p === "monthly" ? t.islamic.monthly : t.islamic.allTime}
          </button>
        ))}
      </div>

      {loading && <IslamicCard><p style={{ textAlign: "center" }}>…</p></IslamicCard>}

      {data && (
        <>
          <IslamicCard>
              {data.top.length === 0 ? <p style={{ textAlign: "center", opacity: 0.7 }}>{t.islamic.noLeaders}</p> : data.top.map((r, i) => {
              const o = r as Record<string, unknown>;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: i < data.top.length - 1 ? "1px solid rgba(217,119,6,0.15)" : "none" }}>
                  <div style={{ fontWeight: 900, color: i < 3 ? ISLAMIC_GOLD : "#fefce8", fontSize: 18 }}>#{i + 1}</div>
                  <div style={{ fontWeight: 600 }}>{(o.name as string) || "—"}</div>
                  <div style={{ textAlign: "left", fontSize: 13 }}>
                    {board === "points" ? (
                      <>
                         <div style={{ color: ISLAMIC_GOLD, fontWeight: 700 }}>{(o.points as number) || 0} {t.islamic.questions === "questions" ? "points" : "نقطة"}</div>
                        <div style={{ opacity: 0.8 }}>{(o.certs as number) || 0} 🏆</div>
                      </>
                    ) : (
                      <>
                         <div style={{ color: ISLAMIC_GOLD, fontWeight: 700 }}>{(o.questions as number) || 0} {t.islamic.questions}</div>
                         <div style={{ opacity: 0.8 }}>{(o.sessions as number) || 0} {t.islamic.session}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </IslamicCard>

          {data.me && (
            <IslamicCard glow style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>{t.islamic.yourRank}</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>
                    {board === "points" ? `${(data.me as { points?: number }).points || 0} ${t.islamic.questions === "questions" ? "points" : "نقطة"}` : `${(data.me as { questions?: number }).questions || 0} ${t.islamic.questions}`}
                  </div>
                </div>
                <button onClick={shareWhatsapp} style={{ padding: "8px 16px", borderRadius: 10, background: "#25D366", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  {t.islamic.shareWhatsApp}
                </button>
              </div>
            </IslamicCard>
          )}
        </>
      )}
    </IslamicShell>
  );
}
