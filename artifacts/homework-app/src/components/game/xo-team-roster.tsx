import { Circle, Crown, WifiOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { XoTeamName, normalizeXoTeamName } from "@/components/game/xo-display";

type RosterPlayer = { id: string; name: string; team: "x" | "o"; connected: boolean };

interface XoTeamRosterProps {
  players: RosterPlayer[];
  teamNames?: { x: string; o: string };
  activePlayerId?: string | null;
  myPlayerId?: string | null;
  started: boolean;
  ar: boolean;
}

const TONE = {
  x: {
    badge: "bg-blue-600 text-white",
    panel: "border-blue-200/70",
    title: "text-blue-700",
    chip: "border-blue-100 bg-blue-50/70",
  },
  o: {
    badge: "bg-amber-500 text-white",
    panel: "border-amber-200/80",
    title: "text-amber-700",
    chip: "border-amber-100 bg-amber-50/70",
  },
} as const;

export function XoTeamRoster({ players, teamNames, activePlayerId, myPlayerId, started, ar }: XoTeamRosterProps) {
  const lang = ar ? "ar" : "en";
  const teams = ["x", "o"] as const;

  return (
    <section
      data-testid="xo-team-roster"
      dir={ar ? "rtl" : "ltr"}
      aria-label={ar ? "الفرق واللاعبون" : "Teams and players"}
      className="w-full rounded-2xl border border-white/15 bg-white/[0.96] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.18)] sm:p-4"
    >
      <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold leading-relaxed text-emerald-800">
        {started
          ? ar
            ? "يتناوب ممثل كل فريق تلقائيًا بين أعضائه."
            : "Each team's representative rotates automatically among its members."
          : ar
            ? "يتم توزيع اللاعبين على الفريقين تلقائيًا بشكل متوازن، ويتناوب التمثيل بينهم عند البدء."
            : "Players are split across both teams automatically and evenly; representation rotates once the game starts."}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {teams.map((t) => {
          const members = players.filter((p) => p.team === t);
          const online = members.filter((p) => p.connected).length;
          const tone = TONE[t];
          const Icon = t === "x" ? X : Circle;
          const display = normalizeXoTeamName(teamNames?.[t], t, lang);
          return (
            <div key={t} data-testid={`xo-team-${t}`} aria-label={display} className={cn("rounded-xl border bg-white p-2.5", tone.panel)}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tone.badge)}>
                    <Icon className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <XoTeamName name={teamNames?.[t]} team={t} lang={lang} className={cn("truncate text-sm font-black", tone.title)} />
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground" data-testid={`xo-team-count-${t}`}>
                  {ar ? `${online} متصل من ${members.length}` : `${online} of ${members.length} online`}
                </span>
              </div>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-3 text-center text-xs font-bold text-muted-foreground">
                  {ar ? "بانتظار انضمام لاعبين إلى هذا الفريق" : "Waiting for players to join this team"}
                </p>
              ) : (
                <ul className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                  {members.map((p) => {
                    const isActive = p.id === activePlayerId;
                    const isMe = p.id === myPlayerId;
                    return (
                      <li
                        key={p.id}
                        data-testid={`xo-player-${p.id}`}
                        className={cn(
                          "flex min-h-9 items-center gap-2 rounded-lg border px-2 py-1 text-xs font-bold",
                          tone.chip,
                          isActive && "ring-2 ring-[#d6b65c]",
                          !p.connected && "opacity-60",
                        )}
                      >
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", p.connected ? "bg-emerald-600" : "bg-slate-400")}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
                        {isMe && (
                          <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                            {ar ? "أنت" : "You"}
                          </span>
                        )}
                        {isActive && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#d6b65c] px-1.5 py-0.5 text-[10px] text-emerald-950">
                            <Crown className="h-3 w-3" aria-hidden="true" />
                            {ar ? "الممثل الحالي" : "Representative"}
                          </span>
                        )}
                        {!p.connected && (
                          <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                            <WifiOff className="h-3 w-3" aria-hidden="true" />
                            {ar ? "غير متصل" : "Offline"}
                          </span>
                        )}
                        {p.connected && <span className="sr-only">{ar ? "متصل" : "Online"}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
