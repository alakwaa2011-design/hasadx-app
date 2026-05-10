import type {
  ArenaCustomQuestion, ArenaDifficulty, ArenaQuestion, ArenaSection, HelperId,
} from "@/data/arena-questions";

export type TeamSide = string;
export type ArenaCardSlot = 1 | 2;

export interface ArenaTeam {
  name: string;
  color: string;
  emoji: string;
  score: number;
  helpers: HelperId[];
  usedHelpers: HelperId[];
  players: string[];
}

export interface ArenaCardKey {
  subCategoryId: string;
  difficulty: ArenaDifficulty;
  slot: ArenaCardSlot;
}

export interface ArenaActiveQuestion {
  subCategoryId: string;
  difficulty: ArenaDifficulty;
  slot: ArenaCardSlot;
  questionIndex: number;
  question: ArenaQuestion;
  multiplier: number;
  answeringTeam: string;
  trapUsed: boolean;
  transferUsed: boolean;
  ghaneemaUsed: boolean;
  revealed: boolean;
  timeLeft: number;
  helpersUsedThisQ: HelperId[];
  shuraVisible: boolean;
}

export interface ArenaState {
  tournamentName: string;
  teams: Record<string, ArenaTeam>;
  teamOrder: string[];
  subCategoryIds: string[];
  customQuestions: ArenaCustomQuestion[];
  /**
   * Snapshot of sections sourced from the live database (admin-public + teacher-private)
   * captured at game-start so the play screen can resolve sub-category IDs without
   * re-fetching. Existing static ARENA_SECTIONS remain the primary source.
   */
  dbSections?: ArenaSection[];
  timerSeconds: number;
  currentTurn: string;
  usedCards: string[];
  pickedQuestions: Record<string, number[]>;
  active: ArenaActiveQuestion | null;
  rulesAck: boolean;
  startedAt: number;
}

const KEY = "hasad_arena_state_v4";
const LEGACY_KEYS = [
  "hasad_arena_state_v3",
  "hasad_arena_state_v2",
  "hasad_arena_state_v1",
];

function migrateTeam(t: Partial<ArenaTeam> | undefined): ArenaTeam {
  return {
    name: t?.name ?? "فريق",
    color: t?.color ?? "#16a34a",
    emoji: t?.emoji ?? "🦅",
    score: t?.score ?? 0,
    helpers: t?.helpers ?? [],
    usedHelpers: t?.usedHelpers ?? [],
    players: t?.players ?? [],
  };
}

export function loadArenaState(): ArenaState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ArenaState>;
      const teamOrder =
        parsed.teamOrder ??
        (parsed.teams ? Object.keys(parsed.teams) : ["T1", "T2"]);
      const teams: Record<string, ArenaTeam> = {};
      if (parsed.teams) {
        for (const [id, t] of Object.entries(parsed.teams)) {
          teams[id] = migrateTeam(t as Partial<ArenaTeam>);
        }
      }
      return {
        tournamentName: parsed.tournamentName ?? "",
        teams,
        teamOrder,
        subCategoryIds: parsed.subCategoryIds ?? [],
        customQuestions: parsed.customQuestions ?? [],
        dbSections: parsed.dbSections ?? [],
        timerSeconds: parsed.timerSeconds ?? 20,
        currentTurn: parsed.currentTurn ?? (teamOrder[0] ?? "T1"),
        usedCards: parsed.usedCards ?? [],
        pickedQuestions: parsed.pickedQuestions ?? {},
        active: parsed.active
          ? ({
              ...parsed.active,
              slot: (parsed.active.slot ?? 1) as ArenaCardSlot,
              ghaneemaUsed: parsed.active.ghaneemaUsed ?? false,
            } as ArenaActiveQuestion)
          : null,
        rulesAck: parsed.rulesAck ?? false,
        startedAt: parsed.startedAt ?? Date.now(),
      };
    }

    const rawV3 = localStorage.getItem("hasad_arena_state_v3");
    if (rawV3) {
      type V3Teams = { A?: Partial<ArenaTeam>; B?: Partial<ArenaTeam> };
      const v3 = JSON.parse(rawV3) as {
        teams?: V3Teams;
        subCategoryIds?: string[];
        customQuestions?: ArenaCustomQuestion[];
        timerSeconds?: number;
        currentTurn?: string;
        usedCards?: string[];
        pickedQuestions?: Record<string, number[]>;
        active?: Partial<ArenaActiveQuestion>;
        rulesAck?: boolean;
        startedAt?: number;
      };
      for (const k of LEGACY_KEYS) localStorage.removeItem(k);
      if (v3.teams) {
        const teams: Record<string, ArenaTeam> = {
          T1: migrateTeam(v3.teams.A),
          T2: migrateTeam(v3.teams.B),
        };
        return {
          tournamentName: "",
          teams,
          teamOrder: ["T1", "T2"],
          subCategoryIds: v3.subCategoryIds ?? [],
          customQuestions: v3.customQuestions ?? [],
          timerSeconds: 20,
          currentTurn: v3.currentTurn === "B" ? "T2" : "T1",
          usedCards: v3.usedCards ?? [],
          pickedQuestions: v3.pickedQuestions ?? {},
          active: v3.active
            ? ({
                ...v3.active,
                slot: (v3.active.slot ?? 1) as ArenaCardSlot,
                ghaneemaUsed: v3.active.ghaneemaUsed ?? false,
              } as ArenaActiveQuestion)
            : null,
          rulesAck: v3.rulesAck ?? false,
          startedAt: v3.startedAt ?? Date.now(),
        };
      }
    }

    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    return null;
  } catch {
    return null;
  }
}

export function saveArenaState(state: ArenaState | null) {
  try {
    if (state === null) {
      localStorage.removeItem(KEY);
      for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    } else {
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
}

export function cardKey(c: ArenaCardKey): string {
  return `${c.subCategoryId}:${c.difficulty}:${c.slot}`;
}

export function pickKey(subCategoryId: string, difficulty: ArenaDifficulty): string {
  return `${subCategoryId}:${difficulty}`;
}

export function otherSide(s: TeamSide): TeamSide {
  return s === "T1" ? "T2" : "T1";
}

export function getNextTeam(teamOrder: string[], currentTurn: string): string {
  const idx = teamOrder.indexOf(currentTurn);
  if (idx === -1) return teamOrder[0] ?? currentTurn;
  return teamOrder[(idx + 1) % teamOrder.length];
}

const SEEN_KEY = "hasad_arena_seen_v1";
type SeenMap = Record<string, number[]>;

export function getSeenIndices(subId: string, diff: ArenaDifficulty): number[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const m = JSON.parse(raw) as SeenMap;
    return m[`${subId}:${diff}`] ?? [];
  } catch {
    return [];
  }
}

export function markQuestionSeen(subId: string, diff: ArenaDifficulty, idx: number) {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const m: SeenMap = raw ? JSON.parse(raw) : {};
    const k = `${subId}:${diff}`;
    const arr = m[k] ?? [];
    if (!arr.includes(idx)) arr.push(idx);
    m[k] = arr;
    localStorage.setItem(SEEN_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function clearSeenBucket(subId: string, diff: ArenaDifficulty) {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return;
    const m = JSON.parse(raw) as SeenMap;
    delete m[`${subId}:${diff}`];
    localStorage.setItem(SEEN_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export interface ArenaReport {
  ts: number;
  subCategoryId: string;
  difficulty: ArenaDifficulty;
  question: string;
  answer: string;
  note: string;
  correctAnswer?: string;
}

const REPORTS_KEY = "hasad_arena_reports_v1";

export function saveArenaReport(r: Omit<ArenaReport, "ts">) {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    const list: ArenaReport[] = raw ? JSON.parse(raw) : [];
    list.unshift({ ...r, ts: Date.now() });
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export function getArenaReports(): ArenaReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? (JSON.parse(raw) as ArenaReport[]) : [];
  } catch {
    return [];
  }
}

const SHARE_KEY = "hasad_arena_share_code_v1";
export function getOrCreateShareCode(): string {
  try {
    const cur = localStorage.getItem(SHARE_KEY);
    if (cur) return cur;
    const c = Math.random().toString(36).slice(2, 8).toUpperCase();
    localStorage.setItem(SHARE_KEY, c);
    return c;
  } catch {
    return "ARENA";
  }
}

const WRITE_SECRET_KEY = "hasad_arena_write_secret_v1";
export function getOrCreateWriteSecret(): string {
  try {
    const cur = localStorage.getItem(WRITE_SECRET_KEY);
    if (cur) return cur;
    const s = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem(WRITE_SECRET_KEY, s);
    return s;
  } catch {
    return "secret";
  }
}
